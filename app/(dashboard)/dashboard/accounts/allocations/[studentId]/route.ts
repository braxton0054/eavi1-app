import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";

/**
 * What the payment wizard needs for ONE student: their active enrolment, and the
 * semester invoices that enrolment actually owes — each with its year, semester and
 * outstanding balance. The list is the authority: a semester that has no invoice on the
 * student's ledger cannot be selected, so a payment can never be aimed at a term the
 * student is not enrolled in.
 *
 * The caller must be a signed-in college admin; the student is narrowed to the acting
 * administrator's campus.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { studentId } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: {
      id: studentId,
      ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
    },
    select: {
      id: true,
      admissionNo: true,
      campus: { select: { name: true } },
      user: { select: { fullName: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { enrolledAt: "desc" },
        select: {
          program: { select: { name: true } },
          period: { select: { name: true } },
        },
      },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found on your campus." }, { status: 404 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { studentId: student.id, status: { in: ["OPEN", "PARTIAL"] } },
    orderBy: [{ periodYear: "asc" }, { periodSemester: "asc" }, { dueAt: "asc" }],
    select: {
      id: true,
      number: true,
      periodYear: true,
      periodSemester: true,
      status: true,
      dueAt: true,
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const allocations = invoices.map((invoice) => {
    const billed = invoice.lines.reduce((sum, line) => sum + Number(line.amount.toString()), 0);
    const paid = invoice.payments.reduce((sum, row) => sum + Number(row.amount.toString()), 0);
    return {
      invoiceId: invoice.id,
      number: invoice.number,
      year: invoice.periodYear,
      semester: invoice.periodSemester,
      label:
        invoice.periodYear && invoice.periodSemester
          ? `Year ${invoice.periodYear} · Semester ${invoice.periodSemester}`
          : invoice.number,
      dueAt: invoice.dueAt,
      billed,
      paid,
      outstanding: Math.max(0, billed - paid),
      status: invoice.status,
    };
  });

  return NextResponse.json({
    student: {
      id: student.id,
      name: student.user.fullName,
      admissionNo: student.admissionNo,
      campus: student.campus.name,
      program: student.enrollments[0]?.program.name ?? null,
      intake: student.enrollments[0]?.period.name ?? null,
    },
    allocations,
  });
}
