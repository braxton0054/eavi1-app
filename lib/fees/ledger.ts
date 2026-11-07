/**
 * The two arithmetic rules every fee invoice follows: what is owed comes from its lines,
 * what has been paid from its payments, and the status is read back from those two. Nothing
 * types a status in, so an invoice can never disagree with its own rows.
 */

import type { Prisma } from "@/generated/prisma/client";
import { InvoiceStatus } from "@/generated/prisma/enums";

export type InvoiceReader = Pick<Prisma.TransactionClient, "invoice">;

/** Prisma hands back Decimal objects; only Number(String(v)) is safe for money. */
export function sumAmounts(rows: { amount: unknown }[]): number {
  return rows.reduce((total, row) => total + (Number(String(row.amount)) || 0), 0);
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

  const billed = sumAmounts(invoice.lines);
  const paid = sumAmounts(invoice.payments);

  const status =
    invoice.lines.length > 0 && billed - paid <= 0.005
      ? InvoiceStatus.PAID
      : paid > 0 && paid < billed
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.OPEN;

  await client.invoice.update({ where: { id: invoiceId }, data: { status } });
}
