import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { PaymentMethod, ReceiptKind } from "@/generated/prisma/enums";
import { recordAudit } from "@/lib/academics/audit";
import { studentLedgerPosition } from "@/lib/fees/ledger";
import { fromCents, MAX_MONEY_CENTS, toCents } from "@/lib/fees/money";
import { allocateStudentPayment, type AppliedAllocation } from "@/lib/fees/payment";
import { nextCreditNoteNumber, nextReceiptNumber } from "@/lib/fees/references";

export class FinanceError extends Error {
  constructor(message: string, readonly code: "overpay" | "duplicate" | "conflict" | "invalid") {
    super(message);
    this.name = "FinanceError";
  }
}

export type Actor = { id: string; email: string };
export type RecordReceiptInput = {
  studentId: string;
  campusId: number;
  amountCents: number;
  method: PaymentMethod;
  reference: string | null;
  paidAt: Date;
  actor: Actor;
  idempotencyKey: string;
  allocation: "SINGLE" | "STUDENT";
  invoiceId?: string;
  expectedAllocationFingerprint?: string;
};

export type LedgerSnapshot = {
  totalFees: string;
  paidToDate: string;
  balance: string;
};

const normalizeProviderReference = (reference: string | null) => {
  const normalized = reference ? reference.toUpperCase().replace(/[^A-Z0-9]/g, "") : "";
  return normalized || null;
};

function requestHash(input: RecordReceiptInput) {
  return createHash("sha256")
    .update(JSON.stringify({
      studentId: input.studentId,
      campusId: input.campusId,
      amountCents: input.amountCents,
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt.toISOString(),
      allocation: input.allocation,
      invoiceId: input.invoiceId ?? null,
      expectedAllocationFingerprint: input.expectedAllocationFingerprint ?? null,
    }))
    .digest("hex");
}

function isAllocationSnapshot(value: unknown): value is AppliedAllocation[] {
  return Array.isArray(value) && value.every((row) =>
    row && typeof row === "object" &&
    typeof row.invoiceId === "string" && typeof row.invoiceNumber === "string" &&
    Number.isSafeInteger(row.amountCents) && Number.isSafeInteger(row.balanceBeforeCents) &&
    Number.isSafeInteger(row.balanceAfterCents),
  );
}

async function allocationsFor(receiptId: string, tx: Prisma.TransactionClient): Promise<AppliedAllocation[]> {
  const receipt = await tx.receipt.findUniqueOrThrow({ where: { id: receiptId }, select: { allocationSnapshot: true } });
  if (isAllocationSnapshot(receipt.allocationSnapshot)) return receipt.allocationSnapshot;
  const rows = await tx.payment.findMany({
    where: { receiptId, entryType: "PAYMENT" },
    select: { invoiceId: true, amount: true, invoice: { select: { number: true } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((row) => ({
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice.number,
    amountCents: toCents(row.amount),
    balanceBeforeCents: toCents(row.amount),
    balanceAfterCents: 0,
  }));
}

/** The only runtime path that creates a posted receipt and its payment allocations. */
export async function recordReceipt(tx: Prisma.TransactionClient, input: RecordReceiptInput) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > MAX_MONEY_CENTS) {
    throw new FinanceError("Enter a valid payment amount.", "invalid");
  }
  if (input.allocation === "SINGLE" && !input.invoiceId) {
    throw new FinanceError("Choose an invoice for this payment.", "invalid");
  }
  const hash = requestHash(input);

  // Global locks close idempotency/provider races across students; the student lock serializes the ledger.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`idempotency:${input.idempotencyKey}`}, 0))`;
  const providerReference = input.method === PaymentMethod.MPESA
    ? normalizeProviderReference(input.reference)
    : null;
  if (input.method === PaymentMethod.MPESA && !providerReference) {
    throw new FinanceError("Enter the M-Pesa transaction reference.", "invalid");
  }
  if (providerReference) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`mpesa:${providerReference}`}, 0))`;
  }
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.studentId}, 0))`;

  const student = await tx.studentProfile.findUnique({ where: { id: input.studentId }, select: { campusId: true } });
  if (!student || student.campusId !== input.campusId) {
    throw new FinanceError("That student is not on this campus.", "conflict");
  }

  const existing = await tx.receipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.requestHash !== hash || existing.kind !== ReceiptKind.RECEIPT) {
      throw new FinanceError("This payment submission was already used with different details.", "conflict");
    }
    return {
      receiptId: existing.id,
      receiptNo: existing.number,
      amountCents: toCents(existing.amount),
      allocations: await allocationsFor(existing.id, tx),
    };
  }

  if (providerReference) {
    const duplicate = await tx.receipt.findFirst({ where: { providerReferenceNormalized: providerReference } });
    if (duplicate) throw new FinanceError("That M-Pesa reference has already been recorded.", "duplicate");
  }

  const before = await studentLedgerPosition(tx, input.studentId, input.campusId);
  const receiptNo = await nextReceiptNumber(tx);
  let receipt: { id: string; number: string };
  try {
    receipt = await tx.receipt.create({
      data: {
        number: receiptNo,
        numberNormalized: receiptNo.toUpperCase(),
        kind: ReceiptKind.RECEIPT,
        studentId: input.studentId,
        campusId: input.campusId,
        amount: fromCents(input.amountCents),
        method: input.method,
        reference: input.reference,
        providerReferenceNormalized: providerReference,
        paidAt: input.paidAt,
        idempotencyKey: input.idempotencyKey,
        requestHash: hash,
        createdById: input.actor.id,
        createdByEmail: input.actor.email,
        totalFees: before.totalFees,
        paidToDate: before.paidToDate,
        balance: before.balance,
      },
      select: { id: true, number: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FinanceError("That payment reference or submission has already been recorded.", "duplicate");
    }
    throw error;
  }

  const outcome = await allocateStudentPayment(tx, {
    studentId: input.studentId,
    campusId: input.campusId,
    amountCents: input.amountCents,
    method: input.method,
    reference: input.reference,
    paidAt: input.paidAt,
    receiptNo,
    receiptId: receipt.id,
    leadInvoiceId: input.invoiceId,
    singleInvoiceOnly: input.allocation === "SINGLE",
    expectedAllocationFingerprint: input.expectedAllocationFingerprint,
    createdById: input.actor.id,
    createdByEmail: input.actor.email,
  });
  if (!outcome.ok) {
    if (outcome.reason === "overpay") {
      throw new FinanceError(`That is more than the KES ${fromCents(outcome.outstandingCents)} this student owes.`, "overpay");
    }
    if (outcome.reason === "conflict") {
      throw new FinanceError("That invoice is no longer available for payment.", "conflict");
    }
    if (outcome.reason === "changed") {
      throw new FinanceError("The ledger changed after review. Refresh and review the allocation again.", "conflict");
    }
    throw new FinanceError("This student has no outstanding invoices.", "invalid");
  }

  const after = await studentLedgerPosition(tx, input.studentId, input.campusId);
  await tx.receipt.update({
    where: { id: receipt.id },
    data: {
      allocationSnapshot: outcome.allocations,
      totalFees: after.totalFees,
      paidToDate: after.paidToDate,
      balance: after.balance,
    },
  });
  await recordAudit({
    campusId: input.campusId,
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: "receipt.create",
    entityType: "receipt",
    entityId: receipt.id,
    detail: { receiptNo, amountCents: input.amountCents, allocations: outcome.allocations },
  }, tx);

  return { receiptId: receipt.id, receiptNo, amountCents: input.amountCents, allocations: outcome.allocations };
}

/** A negative receipt used as the document for a reversal, refund, or invoice credit note. */
export async function createCreditReceipt(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string;
    campusId: number;
    amountCents: number;
    method: PaymentMethod | null;
    reference: string | null;
    paidAt: Date;
    actor: Actor;
    reason: string;
    idempotencyKey: string;
    requestHash: string;
    sourceInvoiceId?: string;
    number?: string;
    snapshot: LedgerSnapshot;
  },
) {
  const number = input.number ?? await nextCreditNoteNumber(tx);
  return tx.receipt.create({
    data: {
      number,
      numberNormalized: number.toUpperCase(),
      kind: ReceiptKind.CREDIT_NOTE,
      studentId: input.studentId,
      campusId: input.campusId,
      amount: fromCents(-Math.abs(input.amountCents)),
      method: input.method,
      reference: input.reference,
      paidAt: input.paidAt,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      sourceInvoiceId: input.sourceInvoiceId,
      createdById: input.actor.id,
      createdByEmail: input.actor.email,
      reason: input.reason,
      totalFees: input.snapshot.totalFees,
      paidToDate: input.snapshot.paidToDate,
      balance: input.snapshot.balance,
    },
    select: { id: true, number: true },
  });
}
