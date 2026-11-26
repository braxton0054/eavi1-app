import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
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
 * A student's complete fee statement, downloadable from the Accounts history. It uses the
 * same line-level transaction builder and PDF pipeline as the student portal, scoped to the
 * acting administrator's campus. Nothing is stored per download.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { studentId } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: FEE_DOCUMENT_STUDENT,
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found on your campus." }, { status: 404 });
  }

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        studentId: student.id,
        ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: STATEMENT_INVOICE_SELECT,
    }),
    prisma.payment.findMany({
      where: {
        studentId: student.id,
        ...(scope.campusId === null ? {} : { invoice: { campusId: scope.campusId } }),
      },
      orderBy: [{ paidAt: "asc" }, { id: "asc" }],
      select: STATEMENT_PAYMENT_SELECT,
    }),
  ]);

  const statementNo = `FS-${student.admissionNo.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()}`;
  const file = await statementPdf({
    statementNo,
    generatedDate: formatDate(new Date()),
    preparedBy: scope.fullName,
    student: feeDocStudentFromRow(student, statementNo),
    transactions: statementTransactions(invoices, payments),
  });

  return pdfResponse(request, file, `fee-statement-${student.admissionNo}`);
}
