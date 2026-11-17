import { prisma } from "@/lib/prisma";
import { formatDate, toNumber } from "@/lib/format";
import { site } from "@/lib/content/home";
import { verifyUrl } from "@/lib/cards/qr";
import type { FeeDocLine, FeeDocStudent, FeeTx } from "@/lib/statements/fee-docs";

/**
 * Reads one fee document's records: a receipt number's payment rows, or one invoice.
 *
 * The documents themselves are built from these rows on demand (`lib/statements/fee-docs.ts`),
 * so there is nothing to keep in sync and no copy of a bill to go stale. Every read is
 * scoped to the campus of the person asking; `campusId: null` means the whole college, and
 * only a super admin holds that scope.
 */

/** The student block every fee document prints, shaped once here rather than per caller. */
export const FEE_DOCUMENT_STUDENT = {
  id: true,
  admissionNo: true,
  user: { select: { fullName: true, phone: true } },
  campus: { select: { name: true } },
  enrollments: {
    where: { status: "ACTIVE" as const },
    take: 1,
    orderBy: { enrolledAt: "desc" as const },
    select: {
      enrolledAt: true,
      program: { select: { name: true } },
      period: { select: { name: true } },
    },
  },
  idCards: { orderBy: { createdAt: "desc" as const }, take: 1, select: { serial: true, verifyToken: true } },
} as const;

type StudentRow = {
  id: string;
  admissionNo: string;
  user: { fullName: string; phone: string | null };
  campus: { name: string };
  enrollments: Array<{
    enrolledAt: Date;
    program: { name: string };
    period: { name: string } | null;
  }>;
  idCards: Array<{ serial: string; verifyToken: string }>;
};

/**
 * The student header, with the QR pointing at the same verification page the cards use.
 *
 * The code under the QR is the card's serial when the student has one, and the document's
 * own reference otherwise — so a printed receipt can always be traced back by hand.
 */
export function feeDocStudent(input: {
  fullName: string;
  admissionNo: string;
  programName: string | null;
  intakeName: string | null;
  campusName: string;
  phone: string | null;
  enrolledAt: Date | null;
  card: { serial: string; verifyToken: string } | null;
  fallbackCode: string;
}): FeeDocStudent {
  return {
    fullName: input.fullName,
    admissionNo: input.admissionNo,
    course: input.programName ?? "—",
    intake: input.intakeName,
    campus: input.campusName,
    phone: input.phone,
    admissionDate: input.enrolledAt ? formatDate(input.enrolledAt) : "",
    verifyCode: input.card?.serial ?? input.fallbackCode,
    verifyUrl: input.card ? verifyUrl(site.url ?? "", input.card.verifyToken) : null,
  };
}

/** The same header from the relation shape the college-wide reads select. */
export function feeDocStudentFromRow(row: StudentRow, fallbackCode: string) {
  const enrollment = row.enrollments[0] ?? null;
  return feeDocStudent({
    fullName: row.user.fullName,
    admissionNo: row.admissionNo,
    programName: enrollment?.program.name ?? null,
    intakeName: enrollment?.period?.name ?? null,
    campusName: row.campus.name,
    phone: row.user.phone,
    enrolledAt: enrollment?.enrolledAt ?? null,
    card: row.idCards[0] ?? null,
    fallbackCode,
  });
}

const scopeFor = (campusId: number | null) => (campusId === null ? {} : { campusId });

const receiptRowsFor = (receiptNo: string, campusId: number | null) =>
  prisma.payment.findMany({
    where: {
      receiptNo: { equals: receiptNo, mode: "insensitive" },
      invoice: scopeFor(campusId),
    },
    orderBy: { paidAt: "asc" },
    select: {
      id: true,
      amount: true,
      method: true,
      reference: true,
      receiptNo: true,
      paidAt: true,
      invoice: { select: { number: true, periodYear: true, periodSemester: true } },
      student: { select: FEE_DOCUMENT_STUDENT },
    },
  });

/** The ledger totals the receipt prints: everything billed on the student, everything paid. */
async function ledgerFor(studentId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { studentId, status: { not: "VOID" } },
    select: { lines: { select: { amount: true } }, payments: { select: { amount: true } } },
  });

  const totalFees = invoices.reduce(
    (sum, invoice) => sum + invoice.lines.reduce((lineSum, line) => lineSum + toNumber(line.amount), 0),
    0,
  );
  const paidToDate = invoices.reduce(
    (sum, invoice) => sum + invoice.payments.reduce((paySum, payment) => paySum + toNumber(payment.amount), 0),
    0,
  );

  return { totalFees, paidToDate, balance: totalFees - paidToDate };
}

/**
 * One receipt, ready to fill the receipt design.
 *
 * A receipt number can settle several invoices — the ledger pays the oldest unpaid period
 * first — so every payment row carrying the number belongs to the same document.
 */
export async function getReceiptDocument(receiptNo: string, campusId: number | null) {
  const rows = await receiptRowsFor(receiptNo, campusId);
  if (rows.length === 0) return null;

  const [first] = rows;
  const amountPaid = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);
  const totals = await ledgerFor(first.student.id);

  const items: FeeDocLine[] = rows.map((row) => ({
    description:
      `Invoice ${row.invoice.number}` +
      (row.invoice.periodYear && row.invoice.periodSemester
        ? ` — Year ${row.invoice.periodYear}, Sem ${row.invoice.periodSemester}`
        : ""),
    amount: toNumber(row.amount),
  }));

  return {
    receiptNo: first.receiptNo ?? receiptNo,
    receiptDate: formatDate(first.paidAt),
    student: feeDocStudentFromRow(first.student, first.receiptNo ?? receiptNo),
    items,
    amountPaid,
    totals,
    method: first.method,
    reference: first.reference,
  };
}

/** One invoice, ready to fill the (same) money document design. */
export async function getInvoiceDocument(invoiceNo: string, campusId: number | null) {
  const invoice = await prisma.invoice.findFirst({
    where: { number: invoiceNo, ...scopeFor(campusId) },
    select: {
      id: true,
      number: true,
      status: true,
      dueAt: true,
      createdAt: true,
      periodYear: true,
      periodSemester: true,
      lines: { select: { label: true, amount: true }, orderBy: { id: "asc" } },
      payments: { select: { amount: true } },
      student: { select: FEE_DOCUMENT_STUDENT },
    },
  });

  if (!invoice) return null;

  const total = invoice.lines.reduce((sum, line) => sum + toNumber(line.amount), 0);
  const paid = invoice.payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return {
    invoiceNo: invoice.number,
    invoiceDate: formatDate(invoice.dueAt ?? invoice.createdAt),
    student: feeDocStudentFromRow(invoice.student, invoice.number),
    items: invoice.lines.map((line) => ({ description: line.label, amount: toNumber(line.amount) })),
    total,
    paid,
    balance: total - paid,
    status: invoice.status,
  };
}

/**
 * The transactions behind a fee statement: bills are charges, payments are credits, in
 * the order the account met them. Both sides are formatted for print here, so the builder
 * never has to know about dates or money formatting.
 */
export function statementTransactions(
  invoices: Array<{
    number: string;
    amount: number;
    dueAt: Date | null;
    createdAt: Date;
    periodYear: number | null;
    periodSemester: number | null;
  }>,
  payments: Array<{
    amount: number | string | { toString(): string };
    paidAt: Date;
    reference: string | null;
    receiptNo: string | null;
    method: string;
  }>,
): FeeTx[] {
  const rows: Array<FeeTx & { sortAt: number }> = [
    ...invoices.map((invoice) => ({
      date: formatDate(invoice.dueAt ?? invoice.createdAt),
      ref: invoice.number,
      description:
        invoice.periodYear && invoice.periodSemester
          ? `Fees — Year ${invoice.periodYear}, Semester ${invoice.periodSemester}`
          : "Fees",
      charged: invoice.amount,
      paid: null,
      sortAt: (invoice.dueAt ?? invoice.createdAt).getTime(),
    })),
    ...payments.map((payment) => ({
      date: formatDate(payment.paidAt),
      ref: payment.receiptNo ?? payment.reference ?? "—",
      description: `Payment · ${payment.method}`,
      charged: null,
      paid: toNumber(payment.amount),
      // A payment lands on the day it was made, after the bill it settles.
      sortAt: payment.paidAt.getTime() + 1,
    })),
  ];

  return rows
    .sort((a, b) => a.sortAt - b.sortAt)
    .map(({ sortAt: _sortAt, ...tx }) => tx);
}
