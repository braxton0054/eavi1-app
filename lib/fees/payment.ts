/** Canonical payment allocation: selected invoice first, then oldest outstanding debt. */
import type { Prisma } from "@/generated/prisma/client";
import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";
import { allocationFingerprint, planPaymentAllocation, type PlannedAllocation } from "@/lib/fees/allocation";
import { recomputeInvoice, invoicePosition } from "@/lib/fees/ledger";
import { fromCents } from "@/lib/fees/money";

export type AppliedAllocation = PlannedAllocation;

export type AllocationOutcome =
  | { ok: true; appliedCents: number; periods: number; allocations: AppliedAllocation[] }
  | { ok: false; reason: "nothing-owed" | "overpay" | "conflict" | "changed"; outstandingCents: number };

export async function allocateStudentPayment(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string;
    campusId: number;
    amountCents: number;
    method: PaymentMethod;
    reference: string | null;
    paidAt: Date;
    receiptNo: string;
    receiptId: string;
    leadInvoiceId?: string;
    singleInvoiceOnly?: boolean;
    expectedAllocationFingerprint?: string;
    createdById?: string;
    createdByEmail?: string;
  },
): Promise<AllocationOutcome> {
  // A per-student ledger mutex serializes every payment, reversal, credit, and void.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.studentId}, 0))`;

  const invoices = await tx.invoice.findMany({
    where: { studentId: input.studentId, campusId: input.campusId, status: { not: InvoiceStatus.VOID } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      status: true,
      dueAt: true,
      createdAt: true,
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const plan = planPaymentAllocation(
    invoices.map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.number,
      status: invoice.status,
      dueAt: invoice.dueAt,
      createdAt: invoice.createdAt,
      outstandingCents: invoicePosition(invoice.lines, invoice.payments).outstandingCents,
    })),
    input.amountCents,
    { leadInvoiceId: input.leadInvoiceId, singleInvoiceOnly: input.singleInvoiceOnly },
  );
  if (!plan.ok) return plan;
  if (
    input.expectedAllocationFingerprint &&
    allocationFingerprint(plan.allocations) !== input.expectedAllocationFingerprint
  ) {
    return { ok: false, reason: "changed", outstandingCents: plan.outstandingCents };
  }

  for (const row of plan.allocations) {
    await tx.payment.create({
      data: {
        receiptId: input.receiptId,
        invoiceId: row.invoiceId,
        studentId: input.studentId,
        amount: fromCents(row.amountCents),
        method: input.method,
        reference: input.reference,
        receiptNo: input.receiptNo,
        paidAt: input.paidAt,
        entryType: "PAYMENT",
        createdById: input.createdById,
        createdByEmail: input.createdByEmail,
      },
    });
    await recomputeInvoice(tx, row.invoiceId);
  }

  return { ok: true, appliedCents: plan.appliedCents, periods: plan.allocations.length, allocations: plan.allocations };
}
