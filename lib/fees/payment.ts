/**
 * Places one receipt against a student's unpaid fee periods.
 *
 * The money is not held in a new account: each period it settles gets an ordinary payment
 * row carrying the same receipt number, and the invoice status is recomputed the same way
 * a single-invoice payment is. The accounts module stays the only ledger.
 */

import type { Prisma } from "@/generated/prisma/client";
import { InvoiceStatus, PaymentMethod } from "@/generated/prisma/enums";
import { recomputeInvoice, sumAmounts } from "@/lib/fees/ledger";

export type AllocationOutcome =
  | { ok: true; applied: number; periods: number }
  | { ok: false; reason: "nothing-owed" }
  | { ok: false; reason: "overpay"; outstanding: number };

const cents = (value: number) => Math.round(value * 100) / 100;

export async function allocateStudentPayment(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string;
    amount: number;
    method: PaymentMethod;
    reference: string | null;
    paidAt: Date;
    receiptNo: string;
  },
): Promise<AllocationOutcome> {
  const invoices = await tx.invoice.findMany({
    where: {
      studentId: input.studentId,
      status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] },
    },
    // Oldest debt clears first; a bill with no due date goes last.
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    include: {
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const owed = invoices.reduce((total, invoice) => {
    const balance = sumAmounts(invoice.lines) - sumAmounts(invoice.payments);
    return total + Math.max(0, balance);
  }, 0);

  if (owed <= 0.005) return { ok: false, reason: "nothing-owed" };
  if (input.amount > owed + 0.005) {
    return { ok: false, reason: "overpay", outstanding: cents(owed) };
  }

  let left = input.amount;
  let periods = 0;

  for (const invoice of invoices) {
    if (left <= 0.005) break;

    const balance = sumAmounts(invoice.lines) - sumAmounts(invoice.payments);
    if (balance <= 0.005) continue;

    // Rounded to cents so a split receipt never leaves a fraction of a shilling behind.
    const portion = cents(Math.min(left, balance));

    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        studentId: input.studentId,
        amount: portion,
        method: input.method,
        reference: input.reference,
        receiptNo: input.receiptNo,
        paidAt: input.paidAt,
      },
    });

    left = cents(left - portion);
    periods += 1;
    await recomputeInvoice(tx, invoice.id);
  }

  return { ok: true, applied: cents(input.amount - left), periods };
}
