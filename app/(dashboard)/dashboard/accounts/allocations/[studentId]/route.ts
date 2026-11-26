import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { invoicePosition } from "@/lib/fees/ledger";
import { requireCollegeAdmin } from "@/lib/session";

/** Campus-scoped invoice positions used by the payment wizard and its shared planner. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { studentId } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: {
      id: true,
      admissionNo: true,
      campus: { select: { id: true, name: true } },
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
  if (!student) return NextResponse.json({ error: "Student not found on your campus." }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { studentId: student.id, campusId: student.campus.id, status: { not: "VOID" } },
    orderBy: [{ dueAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      number: true,
      periodYear: true,
      periodSemester: true,
      status: true,
      dueAt: true,
      createdAt: true,
      feePeriod: { select: { label: true } },
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const allocations = invoices.map((invoice) => {
    const position = invoicePosition(invoice.lines, invoice.payments);
    return {
      invoiceId: invoice.id,
      number: invoice.number,
      year: invoice.periodYear,
      semester: invoice.periodSemester,
      label: invoice.feePeriod?.label ??
        (invoice.periodYear && invoice.periodSemester
          ? `Year ${invoice.periodYear} · Semester ${invoice.periodSemester}`
          : invoice.number),
      dueAt: invoice.dueAt,
      createdAt: invoice.createdAt,
      billed: position.billedCents / 100,
      paid: position.paidCents / 100,
      outstanding: position.outstandingCents / 100,
      outstandingCents: position.outstandingCents,
      creditCents: position.creditCents,
      status: invoice.status,
      settled: position.outstandingCents === 0,
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
