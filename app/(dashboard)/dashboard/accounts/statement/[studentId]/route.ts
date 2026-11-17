import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { site } from "@/lib/content/home";
import { formatDate } from "@/lib/format";
import { feeStatementPages, type FeeDocStudent, type FeeTx } from "@/lib/statements/fee-docs";

/**
 * A student's complete fee statement, downloadable from the Accounts history — the SAME
 * builder the student portal uses, scoped to the acting administrator's campus. Rendered
 * on demand from the ledger; nothing is stored per download.
 */

const MM_TO_PX = 300 / 25.4;
const MM_TO_PT = 72 / 25.4;

export async function GET(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
) {
  const scope = await requireCollegeAdmin();
  const { studentId } = await context.params;

  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: {
      id: true,
      admissionNo: true,
      campus: { select: { name: true } },
      user: { select: { fullName: true, phone: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { enrolledAt: "desc" },
        select: {
          enrolledAt: true,
          program: { select: { name: true } },
          period: { select: { name: true } },
        },
      },
      idCards: { orderBy: { createdAt: "desc" }, take: 1, select: { serial: true, verifyToken: true } },
    },
  });

  if (!student) {
    return NextResponse.json({ error: "Student not found on your campus." }, { status: 404 });
  }

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: student.id, status: { not: "VOID" } },
      orderBy: [{ periodYear: "asc" }, { periodSemester: "asc" }, { dueAt: "asc" }],
      select: { number: true, dueAt: true, periodYear: true, periodSemester: true, lines: { select: { amount: true } } },
    }),
    prisma.payment.findMany({
      where: { studentId: student.id },
      orderBy: { paidAt: "asc" },
      select: { receiptNo: true, reference: true, method: true, paidAt: true, amount: true },
    }),
  ]);

  const transactions: FeeTx[] = [
    ...invoices.map((invoice) => ({
      date: formatDate(invoice.dueAt ?? new Date(0)),
      ref: invoice.number,
      description:
        invoice.periodYear && invoice.periodSemester
          ? `Fees — Year ${invoice.periodYear}, Semester ${invoice.periodSemester}`
          : "Fees",
      charged: invoice.lines.reduce((sum, line) => sum + Number(line.amount.toString()), 0),
      paid: null,
    })),
    ...payments.map((payment) => ({
      date: formatDate(payment.paidAt),
      ref: payment.receiptNo ?? payment.reference ?? "—",
      description: `Payment${payment.method ? ` · ${payment.method}` : ""}`,
      charged: null,
      paid: Number(payment.amount.toString()),
    })),
  ];

  const statementNo = `FS-${student.admissionNo.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()}`;
  const card = student.idCards[0] ?? null;
  const docStudent: FeeDocStudent = {
    fullName: student.user.fullName,
    admissionNo: student.admissionNo,
    course: student.enrollments[0]?.program.name ?? "—",
    intake: student.enrollments[0]?.period.name ?? null,
    campus: student.campus.name,
    phone: student.user.phone ?? null,
    admissionDate: student.enrollments[0] ? formatDate(student.enrollments[0].enrolledAt) : "",
    verifyCode: card?.serial ?? statementNo,
    verifyUrl: card ? `${(site.url ?? "").replace(/\/$/, "")}/verify/${card.verifyToken}` : null,
  };

  const pages = feeStatementPages({
    statementNo,
    generatedDate: formatDate(new Date()),
    preparedBy: scope.fullName,
    student: docStudent,
    transactions,
  });

  const pdf = await PDFDocument.create();
  pdf.setTitle(`EAVI fee statement — ${student.admissionNo}`);
  pdf.setCreator("EAVI Portal");
  pdf.setProducer("EAVI Portal");

  for (const svg of pages) {
    const png = await sharp(Buffer.from(svg), { density: 300 })
      .resize(Math.round(210 * MM_TO_PX), Math.round(297 * MM_TO_PX), { fit: "fill" })
      .png()
      .toBuffer();
    const embedded = await pdf.embedPng(png);
    const page = pdf.addPage([210 * MM_TO_PT, 297 * MM_TO_PT]);
    page.drawImage(embedded, { x: 0, y: 0, width: 210 * MM_TO_PT, height: 297 * MM_TO_PT });
  }

  const file = Buffer.from(await pdf.save());
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${statementNo.toLowerCase()}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
