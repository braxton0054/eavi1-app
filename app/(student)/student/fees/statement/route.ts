import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";
import {
  FEE_DOCUMENT_STUDENT,
  STATEMENT_INVOICE_SELECT,
  STATEMENT_PAYMENT_SELECT,
  feeDocStudentFromRow,
  statementTransactions,
} from "@/lib/dal/fee-documents";
import { formatDate } from "@/lib/format";
import { pdfResponse } from "@/lib/statements/document";
import { statementPdf } from "@/lib/statements/issue";

/**
 * The signed-in student's full fee statement. Invoices (including VOID), every invoice
 * line, and every signed payment/correction are read directly in the student's scope and
 * passed through the same builder the accounts office uses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const scope = await requireStudent();
  const [student, invoices, payments] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { id: scope.studentId },
      select: FEE_DOCUMENT_STUDENT,
    }),
    prisma.invoice.findMany({
      where: { studentId: scope.studentId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: STATEMENT_INVOICE_SELECT,
    }),
    prisma.payment.findMany({
      where: { studentId: scope.studentId },
      orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      select: STATEMENT_PAYMENT_SELECT,
    }),
  ]);

  if (!student?.enrollments[0]) {
    return NextResponse.json({ error: "No enrolment on record." }, { status: 404 });
  }

  const admissionNo = student.admissionNo;
  const statementNo = `FS-${admissionNo.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()}`;
  const file = await statementPdf({
    statementNo,
    generatedDate: formatDate(new Date()),
    preparedBy: "EAVI Accounts Office",
    student: feeDocStudentFromRow(student, statementNo),
    transactions: statementTransactions(invoices, payments),
  });

  return pdfResponse(request, file, `fee-statement-${admissionNo}`);
}
