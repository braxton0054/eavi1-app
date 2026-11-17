import { NextResponse } from "next/server";

import { getStudentCard, getStudentFees, getStudentProfile } from "@/lib/dal/student-portal";
import { feeDocStudent } from "@/lib/dal/fee-documents";
import { formatDate } from "@/lib/format";
import { pdfResponse } from "@/lib/statements/document";
import { receiptPdf } from "@/lib/statements/issue";

/**
 * One fee receipt for the signed-in student.
 *
 * A receipt number can settle several invoices — the ledger pays the oldest unpaid period
 * first — so every payment row carrying that number is part of the same document. The
 * student is the scope: no id is read from the request, so one student cannot open
 * another's receipt by guessing a number.
 *
 * Built on demand from the ledger (`lib/statements/fee-docs.ts` on the college's own
 * artwork) and never stored: repeat views cost a render, not a second copy in object
 * storage that could disagree with the payments table.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptNo: string }> },
) {
  const { receiptNo } = await params;
  const wanted = decodeURIComponent(receiptNo).trim().toLowerCase();

  const [{ enrollment, invoices, payments, totals }, { profile }, { card }] = await Promise.all([
    getStudentFees(),
    getStudentProfile(),
    getStudentCard(),
  ]);

  const rows = payments.filter((payment) => (payment.receiptNo ?? "").toLowerCase() === wanted);
  if (rows.length === 0) {
    return NextResponse.json({ error: "No receipt with that number on this account." }, { status: 404 });
  }

  const first = rows[0];
  const invoiceFor = (invoiceId: string) => invoices.find((invoice) => invoice.id === invoiceId) ?? null;

  const items = rows.map((row) => {
    const invoice = invoiceFor(row.invoiceId);
    const period =
      invoice && invoice.periodYear && invoice.periodSemester
        ? ` — Year ${invoice.periodYear}, Sem ${invoice.periodSemester}`
        : "";
    return {
      description: invoice ? `Invoice ${invoice.number}${period}` : "Fee payment",
      amount: Number(row.amount.toString()),
    };
  });

  const file = await receiptPdf({
    receiptNo: first.receiptNo ?? receiptNo,
    receiptDate: formatDate(first.paidAt),
    student: feeDocStudent({
      fullName: profile?.user.fullName ?? "—",
      admissionNo: profile?.admissionNo ?? "—",
      programName: enrollment?.program.name ?? null,
      intakeName: enrollment?.period?.name ?? null,
      campusName: profile?.campus.name ?? "—",
      phone: profile?.user.phone ?? null,
      enrolledAt: enrollment?.enrolledAt ?? null,
      card: card ? { serial: card.serial, verifyToken: card.verifyToken } : null,
      fallbackCode: first.receiptNo ?? receiptNo,
    }),
    items,
    amountPaid: rows.reduce((sum, row) => sum + Number(row.amount.toString()), 0),
    totalFees: totals.billed,
    paidToDate: totals.paid,
    balance: totals.balance,
    method: first.method,
    reference: first.reference,
    receivedBy: "EAVI Accounts Office",
  });

  return pdfResponse(request, file, `receipt-${first.receiptNo ?? receiptNo}`);
}
