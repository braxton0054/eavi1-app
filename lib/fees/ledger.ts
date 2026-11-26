/** Exact, shared arithmetic for every fee invoice and correction. */
import type { Prisma } from "@/generated/prisma/client";
import { InvoiceStatus } from "@/generated/prisma/enums";
import { fromCents, sumAmountCents } from "@/lib/fees/money";

export type InvoiceReader = Pick<Prisma.TransactionClient, "invoice">;

/** Display-safe number derived from exact minor units, never a running float sum. */
export function sumAmounts(rows: { amount: unknown }[]): number {
  return sumAmountCents(rows) / 100;
}

export function invoicePosition(lines: { amount: unknown }[], payments: { amount: unknown }[]) {
  const billedCents = sumAmountCents(lines);
  const paidCents = sumAmountCents(payments);
  const balanceCents = billedCents - paidCents;
  return {
    billedCents,
    paidCents,
    balanceCents,
    outstandingCents: Math.max(0, balanceCents),
    creditCents: Math.max(0, -balanceCents),
  };
}

export async function studentLedgerPosition(client: InvoiceReader, studentId: string, campusId?: number) {
  const invoices = await client.invoice.findMany({
    where: {
      studentId,
      status: { not: InvoiceStatus.VOID },
      ...(campusId === undefined ? {} : { campusId }),
    },
    select: { lines: { select: { amount: true } }, payments: { select: { amount: true } } },
  });
  const billedCents = sumAmountCents(invoices.flatMap((invoice) => invoice.lines));
  const paidCents = sumAmountCents(invoices.flatMap((invoice) => invoice.payments));
  const balanceCents = billedCents - paidCents;
  return {
    billedCents,
    paidCents,
    balanceCents,
    totalFees: fromCents(billedCents),
    paidToDate: fromCents(paidCents),
    balance: fromCents(balanceCents),
  };
}

export async function recomputeInvoice(client: InvoiceReader, invoiceId: string): Promise<void> {
  const invoice = await client.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      status: true,
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });
  if (!invoice || invoice.status === InvoiceStatus.VOID) return;

  const { billedCents, paidCents } = invoicePosition(invoice.lines, invoice.payments);
  const balanceCents = billedCents - paidCents;
  const status =
    invoice.lines.length > 0 && balanceCents < 0
      ? InvoiceStatus.CREDIT
      : invoice.lines.length > 0 && balanceCents === 0
        ? InvoiceStatus.PAID
        : paidCents > 0 && paidCents < billedCents
          ? InvoiceStatus.PARTIAL
          : InvoiceStatus.OPEN;

  await client.invoice.update({ where: { id: invoiceId }, data: { status } });
}
