import { createHash } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { InvoiceLineKind, InvoiceStatus, ReceiptKind, ReceiptStatus } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/academics/audit";
import { recomputeInvoice, studentLedgerPosition } from "@/lib/fees/ledger";
import { fromCents, parsePaymentAmount, sumAmountCents, toCents } from "@/lib/fees/money";
import { createCreditReceipt, FinanceError, type Actor } from "@/lib/fees/receipts";
import { nextCreditNoteNumber } from "@/lib/fees/references";

async function lockInvoice(tx: Prisma.TransactionClient, invoiceId: string) {
  const identity = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { studentId: true } });
  if (!identity) throw new FinanceError("Invoice not found.", "conflict");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.studentId}, 0))`;
  return tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { lines: true, payments: true },
  });
}

/** Reverse or refund a whole receipt; original positive allocations remain untouched. */
export async function correctReceipt(
  tx: Prisma.TransactionClient,
  input: {
    receiptId: string;
    kind: "REVERSAL" | "REFUND";
    reason: string;
    effectiveAt: Date;
    reference: string | null;
    actor: Actor;
    idempotencyKey: string;
  },
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`idempotency:${input.idempotencyKey}`}, 0))`;
  const identity = await tx.receipt.findUnique({ where: { id: input.receiptId }, select: { studentId: true } });
  if (!identity) throw new FinanceError("Receipt not found.", "conflict");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identity.studentId}, 0))`;

  const requestHash = createHash("sha256").update(JSON.stringify({
    receiptId: input.receiptId,
    kind: input.kind,
    reason: input.reason,
    effectiveAt: input.effectiveAt.toISOString(),
    reference: input.reference,
  })).digest("hex");
  const existing = await tx.receipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.requestHash !== requestHash || existing.kind !== ReceiptKind.CREDIT_NOTE) {
      throw new FinanceError("This correction was already submitted with different details.", "conflict");
    }
    return { creditNoteNo: existing.number, amountCents: Math.abs(toCents(existing.amount)) };
  }

  const receipt = await tx.receipt.findUniqueOrThrow({
    where: { id: input.receiptId },
    include: { payments: { where: { entryType: "PAYMENT" }, include: { invoice: { select: { id: true, number: true } } } } },
  });
  if (receipt.kind !== ReceiptKind.RECEIPT || receipt.status !== ReceiptStatus.ISSUED || !receipt.method) {
    throw new FinanceError("This receipt is not available for correction.", "conflict");
  }
  if (input.kind === "REFUND" && !input.reference) {
    throw new FinanceError("Enter the refund reference or proof.", "invalid");
  }

  const originalIds = receipt.payments.map((row) => row.id);
  const prior = originalIds.length
    ? await tx.payment.findMany({
        where: { reversesPaymentId: { in: originalIds }, entryType: { in: ["REVERSAL", "REFUND"] } },
        select: { amount: true, reversesPaymentId: true },
      })
    : [];
  const correctedByPayment = new Map<string, number>();
  for (const row of prior) {
    if (!row.reversesPaymentId) continue;
    correctedByPayment.set(
      row.reversesPaymentId,
      (correctedByPayment.get(row.reversesPaymentId) ?? 0) + sumAmountCents([row]),
    );
  }

  const remaining = receipt.payments
    .map((row) => ({
      payment: row,
      cents: sumAmountCents([row]) + (correctedByPayment.get(row.id) ?? 0),
    }))
    .filter((row) => row.cents > 0);
  const totalCents = remaining.reduce((sum, row) => sum + row.cents, 0);
  if (totalCents === 0) throw new FinanceError("There is no uncorrected money on this receipt.", "conflict");

  const before = await studentLedgerPosition(tx, receipt.studentId, receipt.campusId);
  const credit = await createCreditReceipt(tx, {
    studentId: receipt.studentId,
    campusId: receipt.campusId,
    amountCents: totalCents,
    method: receipt.method,
    reference: input.reference ?? `${input.kind === "REFUND" ? "Refund" : "Reversal"} of ${receipt.number}`,
    paidAt: input.effectiveAt,
    actor: input.actor,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    requestHash,
    snapshot: { totalFees: before.totalFees, paidToDate: before.paidToDate, balance: before.balance },
  });

  for (const row of remaining) {
    await tx.payment.create({
      data: {
        receiptId: credit.id,
        invoiceId: row.payment.invoiceId,
        studentId: receipt.studentId,
        amount: fromCents(-row.cents),
        method: receipt.method,
        reference: credit.number,
        receiptNo: credit.number,
        entryType: input.kind,
        reversesPaymentId: row.payment.id,
        reason: input.reason,
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
        paidAt: input.effectiveAt,
      },
    });
    await recomputeInvoice(tx, row.payment.invoiceId);
  }

  const after = await studentLedgerPosition(tx, receipt.studentId, receipt.campusId);
  await tx.receipt.update({
    where: { id: credit.id },
    data: { totalFees: after.totalFees, paidToDate: after.paidToDate, balance: after.balance },
  });
  await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      status: input.kind === "REFUND" ? ReceiptStatus.REFUNDED : ReceiptStatus.REVERSED,
      ...(input.kind === "REFUND" ? { refundedAt: input.effectiveAt } : { reversedAt: input.effectiveAt }),
      reason: input.reason,
    },
  });
  await recordAudit({
    campusId: receipt.campusId,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: `receipt.${input.kind.toLowerCase()}`,
    entityType: "receipt",
    entityId: receipt.id,
    detail: { creditNoteNo: credit.number, amountCents: totalCents, reason: input.reason },
  }, tx);

  return { creditNoteNo: credit.number, amountCents: totalCents };
}

/** Append a negative charge and issue a linked credit-note document. */
export async function creditInvoice(
  tx: Prisma.TransactionClient,
  input: {
    invoiceId: string;
    amountCents: number;
    reason: string;
    effectiveAt: Date;
    actor: Actor;
    idempotencyKey: string;
  },
) {
  const amountCents = parsePaymentAmount(fromCents(input.amountCents));
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`idempotency:${input.idempotencyKey}`}, 0))`;
  const invoice = await lockInvoice(tx, input.invoiceId);

  const existing = await tx.invoiceLine.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (
      existing.invoiceId !== invoice.id || sumAmountCents([existing]) !== -amountCents ||
      existing.reason !== input.reason || existing.createdAt.getTime() !== input.effectiveAt.getTime() ||
      !existing.reference
    ) {
      throw new FinanceError("This credit-note submission was already used with different details.", "conflict");
    }
    return { creditNoteNo: existing.reference, amountCents };
  }

  if (invoice.status === InvoiceStatus.VOID) {
    throw new FinanceError("That invoice is not available for a credit note.", "conflict");
  }
  const billedCents = sumAmountCents(invoice.lines);
  if (amountCents > billedCents) {
    throw new FinanceError("A credit note cannot exceed the invoice's current billed total.", "overpay");
  }

  const creditNoteNo = await nextCreditNoteNumber(tx);
  const line = await tx.invoiceLine.create({
    data: {
      invoiceId: invoice.id,
      label: `Credit note ${creditNoteNo}`,
      amount: fromCents(-amountCents),
      kind: InvoiceLineKind.CREDIT_NOTE,
      reference: creditNoteNo,
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      createdById: input.actor.id,
      createdByEmail: input.actor.email,
      createdAt: input.effectiveAt,
    },
    select: { id: true },
  });
  await recomputeInvoice(tx, invoice.id);
  const after = await studentLedgerPosition(tx, invoice.studentId, invoice.campusId);
  await createCreditReceipt(tx, {
    studentId: invoice.studentId,
    campusId: invoice.campusId,
    amountCents,
    method: null,
    reference: creditNoteNo,
    paidAt: input.effectiveAt,
    actor: input.actor,
    reason: input.reason,
    idempotencyKey: input.idempotencyKey,
    requestHash: createHash("sha256").update(JSON.stringify({
      invoiceId: invoice.id, amountCents, reason: input.reason, effectiveAt: input.effectiveAt.toISOString(),
    })).digest("hex"),
    sourceInvoiceId: invoice.id,
    number: creditNoteNo,
    snapshot: { totalFees: after.totalFees, paidToDate: after.paidToDate, balance: after.balance },
  });
  await recordAudit({
    campusId: invoice.campusId,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "invoice.credit_note",
    entityType: "credit_note",
    entityId: line.id,
    detail: { invoiceId: invoice.id, creditNoteNo, amountCents, reason: input.reason },
  }, tx);
  return { creditNoteNo, amountCents };
}

export async function voidInvoiceWithReason(
  tx: Prisma.TransactionClient,
  input: { invoiceId: string; reason: string; actor: Actor },
) {
  const invoice = await lockInvoice(tx, input.invoiceId);
  if (invoice.status === InvoiceStatus.VOID) {
    throw new FinanceError("That invoice is already void.", "conflict");
  }
  if (sumAmountCents(invoice.payments) !== 0) {
    throw new FinanceError("Reverse or refund every payment before voiding this invoice.", "conflict");
  }
  const netBilled = sumAmountCents(invoice.lines);
  if (netBilled !== 0) {
    await tx.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        label: "Voided invoice",
        amount: fromCents(-netBilled),
        kind: InvoiceLineKind.VOID,
        reason: input.reason,
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
      },
    });
  }
  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: InvoiceStatus.VOID,
      voidedAt: new Date(),
      voidedById: input.actor.id,
      voidReason: input.reason,
      voidedFromStatus: invoice.status,
    },
  });
  await recordAudit({
    campusId: invoice.campusId,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "invoice.void",
    entityType: "invoice",
    entityId: invoice.id,
    detail: { reason: input.reason, netBilledCents: netBilled },
  }, tx);
}

export async function unvoidInvoice(tx: Prisma.TransactionClient, input: { invoiceId: string; reason: string; actor: Actor }) {
  const invoice = await lockInvoice(tx, input.invoiceId);
  if (invoice.status !== InvoiceStatus.VOID) {
    throw new FinanceError("Only a void invoice can be restored.", "conflict");
  }
  const activeVoidContra = invoice.lines
    .filter((line) => line.kind === InvoiceLineKind.VOID || line.kind === InvoiceLineKind.VOID_REVERSAL)
    .reduce((sum, line) => sum + sumAmountCents([line]), 0);
  if (activeVoidContra !== 0) {
    await tx.invoiceLine.create({
      data: {
        invoiceId: invoice.id,
        label: "Void reversal",
        amount: fromCents(-activeVoidContra),
        kind: InvoiceLineKind.VOID_REVERSAL,
        reason: input.reason,
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
      },
    });
  }
  await tx.invoice.update({
    where: { id: invoice.id },
    data: {
      status: invoice.voidedFromStatus ?? InvoiceStatus.OPEN,
      voidedAt: null,
      voidedById: null,
      voidReason: null,
      voidedFromStatus: null,
    },
  });
  await recomputeInvoice(tx, invoice.id);
  await recordAudit({
    campusId: invoice.campusId,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "invoice.unvoid",
    entityType: "invoice",
    entityId: invoice.id,
    detail: { reason: input.reason },
  }, tx);
}
