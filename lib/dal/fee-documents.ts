import type { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { formatDate, toNumber } from "@/lib/format";
import { site } from "@/lib/content/home";
import { verifyUrl } from "@/lib/cards/qr";
import { invoicePosition, sumAmounts } from "@/lib/fees/ledger";
import { toCents } from "@/lib/fees/money";
import type { FeeDocLine, FeeDocStudent, StatementTransaction } from "@/lib/statements/fee-docs";

/**
 * Reads fee documents from their own identities. Receipts are Receipt records, never a
 * collection of legacy payment rows that happen to share a number. Every read is scoped to
 * the campus of the person asking; `campusId: null` means the whole college, and only a
 * super admin holds that scope.
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
const normalizeReceiptNumber = (receiptNo: string) => receiptNo.trim().toUpperCase();

type DocumentInvoice = {
  number: string;
  periodYear: number | null;
  periodSemester: number | null;
};

const invoicePeriod = (invoice: DocumentInvoice) =>
  invoice.periodYear && invoice.periodSemester
    ? ` — Year ${invoice.periodYear}, Sem ${invoice.periodSemester}`
    : "";

/**
 * One receipt or credit note, ready to fill the receipt design.
 *
 * The receipt's amount and three ledger balances are issuance snapshots. They are deliberately
 * not recomputed from today's invoices or payments. An original RECEIPT also omits its mutable
 * correction status/reason, so reversing it later cannot change the document that was issued.
 */
export async function getReceiptDocument(receiptNo: string, campusId: number | null) {
  const receipt = await prisma.receipt.findFirst({
    where: { numberNormalized: normalizeReceiptNumber(receiptNo), ...scopeFor(campusId) },
    select: {
      number: true,
      kind: true,
      amount: true,
      method: true,
      reference: true,
      paidAt: true,
      reason: true,
      totalFees: true,
      paidToDate: true,
      balance: true,
      student: { select: FEE_DOCUMENT_STUDENT },
      sourceInvoice: {
        select: { number: true, periodYear: true, periodSemester: true },
      },
      payments: {
        orderBy: [{ paidAt: "asc" }, { id: "asc" }],
        select: {
          amount: true,
          entryType: true,
          reason: true,
          reversesPaymentId: true,
          reversesPayment: { select: { receipt: { select: { number: true } } } },
          invoice: { select: { number: true, periodYear: true, periodSemester: true } },
        },
      },
    },
  });

  if (!receipt) return null;

  const correctionPayment = receipt.payments.find((payment) => payment.entryType !== "PAYMENT");
  const correctionType: "REVERSAL" | "REFUND" | "CREDIT_NOTE" | null =
    receipt.kind === "CREDIT_NOTE"
      ? correctionPayment?.entryType === "REFUND"
        ? "REFUND"
        : correctionPayment?.entryType === "REVERSAL"
          ? "REVERSAL"
          : "CREDIT_NOTE"
      : null;
  const originalReceiptNo = receipt.kind === "CREDIT_NOTE"
    ? [...new Set(
        receipt.payments
          .map((payment) => payment.reversesPayment?.receipt.number)
          .filter((number): number is string => Boolean(number)),
      )].join(", ") || null
    : null;

  const items: FeeDocLine[] = receipt.payments.map((payment) => {
    const invoice = `Invoice ${payment.invoice.number}${invoicePeriod(payment.invoice)}`;
    const corrected = payment.entryType !== "PAYMENT";
    const action = payment.entryType === "REFUND" ? "Refund" : "Reversal";
    const original = payment.reversesPayment?.receipt.number;
    const description = corrected
      ? `${action}${original ? ` of ${original}` : ""} — ${invoice}`
      : invoice;
    return {
      description: `${description}${corrected && payment.reason ? ` — ${payment.reason}` : ""}`,
      amount: toNumber(payment.amount),
    };
  });

  // An invoice credit note has no payment allocations; its source invoice supplies the
  // settlement description. The fallback keeps a malformed/legacy receipt printable without
  // ever borrowing rows from another receipt number.
  if (items.length === 0) {
    items.push({
      description:
        (receipt.sourceInvoice
          ? `Credit note against Invoice ${receipt.sourceInvoice.number}${invoicePeriod(receipt.sourceInvoice)}`
          : receipt.kind === "CREDIT_NOTE"
            ? "Credit note"
            : "Fee payment") +
        (receipt.kind === "CREDIT_NOTE" && receipt.reason ? ` — ${receipt.reason}` : ""),
      amount: toNumber(receipt.amount),
    });
  }

  return {
    receiptNo: receipt.number,
    receiptDate: formatDate(receipt.paidAt),
    student: feeDocStudentFromRow(receipt.student, receipt.number),
    items,
    amountPaid: toNumber(receipt.amount),
    totalFees: toNumber(receipt.totalFees),
    paidToDate: toNumber(receipt.paidToDate),
    balance: toNumber(receipt.balance),
    method: receipt.method ?? "—",
    reference: receipt.reference,
    kind: receipt.kind,
    correctionType,
    originalReceiptNo,
    reason: receipt.kind === "CREDIT_NOTE" ? receipt.reason : null,
    sourceInvoice: receipt.sourceInvoice
      ? {
          number: receipt.sourceInvoice.number,
          periodYear: receipt.sourceInvoice.periodYear,
          periodSemester: receipt.sourceInvoice.periodSemester,
        }
      : null,
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
      voidReason: true,
      periodYear: true,
      periodSemester: true,
      lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { label: true, amount: true, kind: true, reference: true, reason: true },
      },
      payments: { select: { amount: true } },
      student: { select: FEE_DOCUMENT_STUDENT },
    },
  });

  if (!invoice) return null;

  const position = invoicePosition(invoice.lines, invoice.payments);
  const documentStatus = invoice.status === "VOID"
    ? "VOID"
    : position.balanceCents < 0
      ? "CREDIT"
      : invoice.lines.length > 0 && position.balanceCents === 0
        ? "PAID"
        : position.paidCents > 0 && position.paidCents < position.billedCents
          ? "PARTIAL"
          : "OPEN";

  return {
    invoiceNo: invoice.number,
    invoiceDate: formatDate(invoice.dueAt ?? invoice.createdAt),
    student: feeDocStudentFromRow(invoice.student, invoice.number),
    items: invoice.lines.map((line) => ({
      description:
        `${line.label}${line.reference ? ` (${line.reference})` : ""}` +
        (line.reason ? ` — ${line.reason}` : ""),
      amount: toNumber(line.amount),
    })),
    total: sumAmounts(invoice.lines),
    paid: position.paidCents / 100,
    balance: position.balanceCents / 100,
    status: documentStatus,
    voidReason: documentStatus === "VOID" ? invoice.voidReason : null,
  };
}

/** The complete line-level ledger shared by printable statements and the history screen. */
export const STATEMENT_INVOICE_SELECT = {
  id: true,
  number: true,
  status: true,
  dueAt: true,
  createdAt: true,
  periodYear: true,
  periodSemester: true,
  lines: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      label: true,
      amount: true,
      kind: true,
      reference: true,
      reason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.InvoiceSelect;

export const STATEMENT_PAYMENT_SELECT = {
  id: true,
  invoiceId: true,
  amount: true,
  paidAt: true,
  reference: true,
  method: true,
  receiptNo: true,
  entryType: true,
  reversesPaymentId: true,
  reason: true,
  receipt: { select: { number: true, kind: true } },
  reversesPayment: { select: { receipt: { select: { number: true } } } },
} satisfies Prisma.PaymentSelect;

export type StatementInvoice = {
  id: string;
  number: string;
  status: string;
  dueAt: Date | null;
  createdAt: Date;
  periodYear: number | null;
  periodSemester: number | null;
  lines: Array<{
    id: string;
    label: string;
    amount: unknown;
    kind: string;
    reference: string | null;
    reason: string | null;
    createdAt: Date;
  }>;
};

export type StatementPayment = {
  id: string;
  invoiceId: string;
  amount: unknown;
  paidAt: Date;
  reference: string | null;
  method: string;
  receiptNo: string | null;
  entryType: string;
  reversesPaymentId: string | null;
  reason: string | null;
  receipt: { number: string; kind: string } | null;
  reversesPayment: { receipt: { number: string } } | null;
};

const withReason = (description: string, reason: string | null) =>
  reason ? `${description} — ${reason}` : description;

/**
 * Every invoice line and every signed payment is a separate dated entry. In particular,
 * VOID invoices keep their original charges and their negative void contra, and reversals
 * and refunds stay visible as their own negative payment entries.
 */
export function statementTransactions(
  invoices: StatementInvoice[],
  payments: StatementPayment[],
): StatementTransaction[] {
  const rows: StatementTransaction[] = [];

  for (const invoice of invoices) {
    const period = invoice.periodYear && invoice.periodSemester
      ? `Year ${invoice.periodYear}, Semester ${invoice.periodSemester}`
      : null;

    for (const line of invoice.lines) {
      const kind = line.kind;
      const prefix = kind === "CHARGE" ? line.label : `${line.label} · Invoice ${invoice.number}`;
      const periodText = kind === "CHARGE" && period ? ` · ${period}` : "";
      const voidText = invoice.status === "VOID" ? " · VOID invoice" : "";
      const description = withReason(`${prefix}${periodText}${voidText}`, line.reason);
      const occurredAt = line.createdAt ?? invoice.createdAt;
      const chargedCents = toCents(line.amount);
      const isCreditNote = kind === "CREDIT_NOTE" && Boolean(line.reference);

      rows.push({
        id: `invoice-line-${line.id}`,
        date: formatDate(occurredAt),
        ref: line.reference ?? invoice.number,
        description,
        charged: chargedCents / 100,
        paid: null,
        chargedCents,
        paidCents: null,
        occurredAt,
        // On the same timestamp a bill is read before the payment that settles it.
        sortAt: occurredAt.getTime(),
        order: 0,
        correction: kind !== "CHARGE" || invoice.status === "VOID",
        documentNo: isCreditNote ? line.reference : invoice.number,
        documentKind: isCreditNote ? "CREDIT_NOTE" : "INVOICE",
      });
    }
  }

  for (const payment of payments) {
    const occurredAt = payment.paidAt;
    const entryType = payment.entryType;
    const correction = entryType !== "PAYMENT";
    const action = entryType === "REFUND" ? "Refund" : entryType === "REVERSAL" ? "Reversal" : "Payment";
    const originalReceiptNo = payment.reversesPayment?.receipt.number;
    const receiptNo = payment.receipt?.number ?? payment.receiptNo;
    const paidCents = toCents(payment.amount);
    const reference = payment.reference && payment.reference !== receiptNo ? `Ref ${payment.reference}` : null;
    const description = withReason(
      [
        action,
        payment.method || null,
        correction && originalReceiptNo ? `of ${originalReceiptNo}` : null,
        reference,
      ].filter(Boolean).join(" · "),
      payment.reason,
    );

    rows.push({
      id: `payment-${payment.id}`,
      date: formatDate(occurredAt),
      ref: receiptNo ?? payment.reference ?? "—",
      description,
      charged: null,
      paid: paidCents / 100,
      chargedCents: null,
      paidCents,
      occurredAt,
      sortAt: occurredAt.getTime() + 1,
      order: 1,
      correction: correction || payment.receipt?.kind === "CREDIT_NOTE",
      documentNo: receiptNo,
      documentKind: payment.receipt?.kind === "CREDIT_NOTE" ? "CREDIT_NOTE" : "RECEIPT",
    });
  }

  return rows.sort((a, b) =>
    a.sortAt - b.sortAt || a.order - b.order || a.id.localeCompare(b.id),
  );
}
