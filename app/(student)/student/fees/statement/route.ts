import { NextResponse } from "next/server";

import { getStudentCard, getStudentFees, getStudentProfile } from "@/lib/dal/student-portal";
import { feeDocStudent, statementTransactions } from "@/lib/dal/fee-documents";
import { formatDate } from "@/lib/format";
import { pdfResponse } from "@/lib/statements/document";
import { statementPdf } from "@/lib/statements/issue";

/**
 * The signed-in student's full fee statement.
 *
 * Built from the same invoices and payments the fees screen shows, on the college's own
 * A4 statement artwork, one page per screenful of transactions (23 rows, then 30). The
 * running balance and the totals come from the rows themselves, so the page cannot
 * disagree with the ledger it was read from.
 *
 * Nothing is stored: a statement is derived on demand, which is also why it can never be
 * an out-of-date copy of the account.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const [{ enrollment, invoices, payments }, { profile }, { card }] = await Promise.all([
    getStudentFees(),
    getStudentProfile(),
    getStudentCard(),
  ]);

  if (!enrollment) {
    return NextResponse.json({ error: "No enrolment on record." }, { status: 404 });
  }

  const admissionNo = profile?.admissionNo ?? "student";
  const statementNo = `FS-${admissionNo.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()}`;

  const file = await statementPdf({
    statementNo,
    generatedDate: formatDate(new Date()),
    preparedBy: "EAVI Accounts Office",
    student: feeDocStudent({
      fullName: profile?.user.fullName ?? "—",
      admissionNo,
      programName: enrollment.program.name,
      intakeName: enrollment.period?.name ?? null,
      campusName: profile?.campus.name ?? "—",
      phone: profile?.user.phone ?? null,
      enrolledAt: enrollment.enrolledAt,
      card: card ? { serial: card.serial, verifyToken: card.verifyToken } : null,
      fallbackCode: statementNo,
    }),
    transactions: statementTransactions(invoices, payments),
  });

  return pdfResponse(request, file, `fee-statement-${admissionNo}`);
}
