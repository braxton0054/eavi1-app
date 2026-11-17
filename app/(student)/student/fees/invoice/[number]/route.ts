import { NextResponse } from "next/server";

import { getStudentCard, getStudentFees, getStudentProfile } from "@/lib/dal/student-portal";
import { feeDocStudent } from "@/lib/dal/fee-documents";
import { formatDate } from "@/lib/format";
import { pdfResponse } from "@/lib/statements/document";
import { invoicePdf } from "@/lib/statements/issue";

/**
 * One fee invoice for the signed-in student — the college's money document design, filled
 * from a single invoice record (the decided mapping: invoice number in the reference slot,
 * the invoice's own lines, its payments applied, its total and its outstanding).
 *
 * There is no separate invoice artwork: the receipt design doubles as the invoice, so the
 * office prints one layout whether money is coming in or is being billed. The student is
 * the scope, exactly as on the receipt.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const wanted = decodeURIComponent(number).trim().toLowerCase();

  const [{ enrollment, invoices, payments }, { profile }, { card }] = await Promise.all([
    getStudentFees(),
    getStudentProfile(),
    getStudentCard(),
  ]);

  const invoice = invoices.find((row) => row.number.toLowerCase() === wanted);
  if (!invoice) {
    return NextResponse.json({ error: "No invoice with that number on this account." }, { status: 404 });
  }

  const applied = payments.filter((payment) => payment.invoiceId === invoice.id);

  const file = await invoicePdf({
    invoiceNo: invoice.number,
    invoiceDate: formatDate(invoice.dueAt ?? invoice.createdAt),
    student: feeDocStudent({
      fullName: profile?.user.fullName ?? "—",
      admissionNo: profile?.admissionNo ?? "—",
      programName: enrollment?.program.name ?? null,
      intakeName: enrollment?.period?.name ?? null,
      campusName: profile?.campus.name ?? "—",
      phone: profile?.user.phone ?? null,
      enrolledAt: enrollment?.enrolledAt ?? null,
      card: card ? { serial: card.serial, verifyToken: card.verifyToken } : null,
      fallbackCode: invoice.number,
    }),
    items: invoice.lines.map((line) => ({ description: line.label, amount: Number(line.amount.toString()) })),
    total: invoice.amount,
    paid: applied.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0),
    balance: invoice.amount - applied.reduce((sum, payment) => sum + Number(payment.amount.toString()), 0),
    receivedBy: "EAVI Accounts Office",
  });

  return pdfResponse(request, file, `invoice-${invoice.number}`);
}
