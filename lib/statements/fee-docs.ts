/**
 * The college's fee documents, built on the artwork the college supplied in
 * `incoice templete/` and kept here in `templates/`. There is one receipt design and two
 * statement pages; the **invoice is printed on the receipt design**, filled from a single
 * invoice record, so the office has one layout for money in and money out rather than two
 * that can drift apart.
 *
 * Everything is slot replacement: the artwork declares `{{slots}}`, the caller hands over
 * records, and this module only fills them — it never reads the clock or the database, so
 * a proof can be produced from numbers already known. Every value is XML-escaped, and a
 * slot with no value is left blank so the printed page shows the design rather than a dash.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The templates are read once per process. They are part of the build (like the card
 * artwork), not per-request data, so re-reading them for every receipt would spend disk
 * time to produce the same string.
 */
const TEMPLATE_DIR = path.join(process.cwd(), "lib", "statements", "templates");

let cache: { receipt: string; statementFirst: string; statementNext: string } | null = null;

function templates() {
  if (!cache) {
    cache = {
      receipt: readFileSync(path.join(TEMPLATE_DIR, "eavi-receipt.svg"), "utf8"),
      statementFirst: readFileSync(path.join(TEMPLATE_DIR, "eavi-statement-first-page.svg"), "utf8"),
      statementNext: readFileSync(path.join(TEMPLATE_DIR, "eavi-statement-next-page.svg"), "utf8"),
    };
  }
  return cache;
}

/** The template directory, for the renderer that inlines the logo it references. */
export const STATEMENT_TEMPLATE_DIR = TEMPLATE_DIR;

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The artwork prints "KES" itself, so the figure carries separators and two decimals. */
export function kes(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** "two hundred and thirty-four"; the receipt's amount-in-words line is British English. */
function wordsBelow1000(n: number): string {
  if (n >= 100) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? " and " + wordsBelow1000(rest) : ""}`;
  }
  if (n >= 20) return `${TENS[Math.floor(n / 10)]}${n % 10 ? "-" + ONES[n % 10] : ""}`;
  return ONES[n];
}

/** "one thousand two hundred and thirty-four and 50/100" — the words line on the receipt. */
export function amountInWords(value: number) {
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);

  const scales: Array<[number, string]> = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1_000, "thousand"],
  ];

  let rest = whole;
  const parts: string[] = [];
  for (const [scale, name] of scales) {
    const count = Math.floor(rest / scale);
    if (count > 0) {
      parts.push(`${wordsBelow1000(count)} ${name}`);
      rest %= scale;
    }
  }
  if (rest > 0 || parts.length === 0) parts.push(wordsBelow1000(rest) || "zero");

  return `${parts.join(" ")} and ${String(cents).padStart(2, "0")}/100`;
}

/** The student whose name the document carries, already formatted for print. */
export type FeeDocStudent = {
  fullName: string;
  admissionNo: string;
  course: string;
  intake: string | null;
  campus: string;
  phone: string | null;
  /** When the student was admitted; the statement's "since admission" anchor. */
  admissionDate: string;
  /** The code printed under the QR — the card serial, so the paper and the plastic agree. */
  verifyCode: string;
  /** Where the QR points: the college's public verification page for this record. */
  verifyUrl: string | null;
};

/** One line on a document: what it says and what it is worth. */
export type FeeDocLine = { description: string; amount: number };

type Slots = Record<string, string>;

/** Fills `{{slots}}`; a slot the caller did not fill is blank, never a placeholder. */
function fill(template: string, slots: Slots) {
  return template.replace(/\{\{([a-z_0-9]+)\}\}/g, (_, slot: string) => escapeXml(slots[slot] ?? ""));
}

/** A reference must not run into the amount column; the artwork gives no width hint. */
const fit = (text: string, max: number) =>
  text.length <= max ? escapeXml(text) : `${escapeXml(text.slice(0, max - 1))}…`;

/* ---------------------------------------------------------------- the receipt */

/**
 * The receipt design holds four settlement lines. A payment that settled more than four
 * invoices would overrun them, so the first three print in full and the rest are summed
 * into a fourth "other invoices" line — the money still adds up to the amount paid, which
 * is the one thing a receipt may never get wrong.
 */
function settlementLines(lines: FeeDocLine[], closingLabel: (count: number) => string) {
  if (lines.length <= 4) return lines;
  return [
    ...lines.slice(0, 3),
    {
      description: closingLabel(lines.length - 3),
      amount: lines.slice(3).reduce((sum, line) => sum + line.amount, 0),
    },
  ];
}

export type ReceiptInput = {
  receiptNo: string;
  receiptDate: string;
  student: FeeDocStudent;
  /** What the money settled — at most four lines print, the rest are summarised. */
  items: FeeDocLine[];
  amountPaid: number;
  /** The ledger's totals at the moment of printing. */
  totalFees: number;
  paidToDate: number;
  balance: number;
  method: string;
  reference: string | null;
  receivedBy: string;
};

/** Slots both money documents share, so the invoice cannot drift from the receipt. */
function moneyDocumentSlots(input: {
  reference: string;
  date: string;
  student: FeeDocStudent;
  items: FeeDocLine[];
  amount: number;
  totalFees: number;
  paidToDate: number;
  balance: number;
  method: string;
  referenceText: string | null;
  receivedBy: string;
  closingLabel: (count: number) => string;
}): Slots {
  const { student } = input;
  const lines = settlementLines(input.items, input.closingLabel);

  // Each artwork column has a fixed width. Truncating the few long values here keeps a
  // long name, number or reference inside its own cell instead of printing over the next.
  const slots: Slots = {
    receipt_no: fit(input.reference, 30),
    receipt_date: fit(input.date, 22),
    student_name: fit(student.fullName, 34),
    reg_no: fit(student.admissionNo, 28),
    course: fit(student.course, 34),
    intake: fit(student.intake ?? "", 28),
    method: fit(input.method, 22),
    reference: fit(input.referenceText || "", 25),
    received_by: fit(input.receivedBy, 18),
    amount_paid: kes(input.amount),
    amount_words: fit(amountInWords(input.amount), 62),
    total_fees: kes(input.totalFees),
    paid_to_date: kes(input.paidToDate),
    balance: kes(input.balance),
    // The QR points at the college's verification page; the printed code is the number a
    // cashier can read out when the camera is not around.
    qr_data: student.verifyUrl ?? input.reference,
    verify_code: fit(student.verifyCode || input.reference, 30),
  };

  for (let i = 1; i <= 4; i += 1) {
    const line = lines[i - 1];
    slots[`item${i}_desc`] = line ? fit(line.description, 58) : "";
    slots[`item${i}_amount`] = line ? kes(line.amount) : "";
  }

  return slots;
}

/** The receipt: one receipt number's payment rows, on the receipt design. */
export function feeReceiptSvg(input: ReceiptInput) {
  return fill(
    templates().receipt,
    moneyDocumentSlots({
      reference: input.receiptNo,
      date: input.receiptDate,
      student: input.student,
      items: input.items,
      amount: input.amountPaid,
      totalFees: input.totalFees,
      paidToDate: input.paidToDate,
      balance: input.balance,
      method: input.method,
      referenceText: input.reference,
      receivedBy: input.receivedBy,
      closingLabel: (count) => `Other invoices settled (${count})`,
    }),
  );
}

export type InvoiceInput = {
  /** The invoice's own number fills the receipt-number slot. */
  invoiceNo: string;
  /** The date the bill is dated, or falls due. */
  invoiceDate: string;
  student: FeeDocStudent;
  /** The invoice's lines; more than four collapse into a fourth "Other charges" line. */
  items: FeeDocLine[];
  /** The invoice's total, what has been paid against it, and what is still owed. */
  total: number;
  paid: number;
  balance: number;
  receivedBy: string;
};

/**
 * The invoice — the same receipt artwork, filled from ONE invoice record.
 *
 * This is deliberate, not a stopgap: the college prints one money document design whether
 * the paper says "receipt" (money in) or bills a period (money due). What changes is only
 * what fills the slots — the invoice number in the reference, the invoice's own lines, and
 * its outstanding balance. The band text stays as designed.
 */
export function feeInvoiceSvg(input: InvoiceInput) {
  return fill(
    templates().receipt,
    moneyDocumentSlots({
      reference: input.invoiceNo,
      date: input.invoiceDate,
      student: input.student,
      items: input.items,
      amount: input.paid,
      totalFees: input.total,
      paidToDate: input.paid,
      balance: input.balance,
      // An invoice is not a payment, so there is no channel and no cashier: the reference
      // is the bill's own number and the office that raised it signs the paper.
      method: "—",
      referenceText: input.invoiceNo,
      receivedBy: input.receivedBy,
      closingLabel: (count) => `Other charges (${count})`,
    }),
  );
}

/* -------------------------------------------------------------- the statement */

export type FeeTx = {
  date: string;
  ref: string;
  description: string;
  charged: number | null;
  paid: number | null;
};

export type StatementInput = {
  statementNo: string;
  generatedDate: string;
  preparedBy: string;
  student: FeeDocStudent;
  /**
   * The ledger in date order. Totals and running balances are derived here, from the same
   * rows the table prints, so the summary and the rows can never disagree.
   */
  transactions: FeeTx[];
};

/** Rows the artwork draws on each page. */
export const ROWS_FIRST_PAGE = 23;
export const ROWS_NEXT_PAGE = 30;

/** Splits the ledger into page-sized chunks; a statement always has at least one page. */
export function statementChunks(transactions: FeeTx[]) {
  const chunks: FeeTx[][] = [transactions.slice(0, ROWS_FIRST_PAGE)];
  for (let i = ROWS_FIRST_PAGE; i < transactions.length; i += ROWS_NEXT_PAGE) {
    chunks.push(transactions.slice(i, i + ROWS_NEXT_PAGE));
  }
  return chunks;
}

/**
 * The statement, as one or more A4 pages: 23 rows on the first page, 30 on each
 * continuation (that is what the artwork draws).
 *
 * The running balance is the balance after that row, carried across pages: the first row
 * of page two continues from the last row of page one, so the document reads as one
 * account rather than as a set of unrelated pages.
 */
export function feeStatementPages(input: StatementInput) {
  const { student } = input;

  const totalCharged = input.transactions.reduce((sum, tx) => sum + (tx.charged ?? 0), 0);
  const totalPaid = input.transactions.reduce((sum, tx) => sum + (tx.paid ?? 0), 0);
  const balance = totalCharged - totalPaid;

  const chunks = statementChunks(input.transactions);
  const pages = chunks.length;

  let running = 0;

  return chunks.map((chunk, pageIndex) => {
    const isFirst = pageIndex === 0;
    const slots: Slots = {
      statement_no: fit(input.statementNo, 28),
      generated_date: fit(input.generatedDate, 18),
      admission_date: fit(student.admissionDate, 18),
      student_name: fit(student.fullName, 30),
      reg_no: fit(student.admissionNo, 28),
      course: fit(student.course, 28),
      intake: fit(student.intake ?? "", 26),
      campus: fit(student.campus, 24),
      student_phone: fit(student.phone ?? "", 18),
      // The totals are the whole account on every page; the continuation page's closing
      // line does not print "KES" itself, so that page's balance carries the unit.
      total_charged: kes(totalCharged),
      total_paid: kes(totalPaid),
      balance: isFirst ? kes(balance) : `KES ${kes(balance)}`,
      qr_data: student.verifyUrl ?? input.statementNo,
      verify_code: fit(student.verifyCode || input.statementNo, 26),
      page: String(pageIndex + 1),
      pages: String(pages),
      prepared_by: fit(input.preparedBy, 40),
    };

    const rowCount = isFirst ? ROWS_FIRST_PAGE : ROWS_NEXT_PAGE;
    for (let i = 1; i <= rowCount; i += 1) {
      const tx = chunk[i - 1];
      if (!tx) {
        slots[`tx${i}_date`] = "";
        slots[`tx${i}_ref`] = "";
        slots[`tx${i}_desc`] = "";
        slots[`tx${i}_charged`] = "";
        slots[`tx${i}_paid`] = "";
        slots[`tx${i}_balance`] = "";
        continue;
      }

      running += (tx.charged ?? 0) - (tx.paid ?? 0);
      slots[`tx${i}_date`] = fit(tx.date, 12);
      slots[`tx${i}_ref`] = fit(tx.ref, 16);
      slots[`tx${i}_desc`] = fit(tx.description, 40);
      slots[`tx${i}_charged`] = tx.charged === null ? "" : kes(tx.charged);
      slots[`tx${i}_paid`] = tx.paid === null ? "" : kes(tx.paid);
      slots[`tx${i}_balance`] = kes(running);
    }

    return fill(isFirst ? templates().statementFirst : templates().statementNext, slots);
  });
}

/** Slots a template expects, so a test can prove none of them were left behind. */
export function slotsIn(template: string) {
  return [...new Set([...template.matchAll(/\{\{([a-z_0-9]+)\}\}/g)].map((m) => m[1]))].sort();
}
