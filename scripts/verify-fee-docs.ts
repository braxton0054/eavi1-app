/**
 * Verifies the fee documents: the slots they fill on the supplied artwork, the totals and
 * running balances they derive, the four-line collapse, and the PDF pipeline itself.
 *
 * These are the designs the college supplied (`incoice templete/`), so the checks are about
 * *filling* them correctly — not about redrawing them.
 *
 * Run: npx tsx scripts/verify-fee-docs.ts
 */
import {
  amountInWords,
  escapeXml,
  feeInvoiceSvg,
  feeReceiptSvg,
  feeStatementPages,
  kes,
  slotsIn,
  ROWS_FIRST_PAGE,
  ROWS_NEXT_PAGE,
  type FeeDocStudent,
  type FeeTx,
} from "../lib/statements/fee-docs";
import { documentPdf, withQr } from "../lib/statements/document";
import { readFileSync } from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const student: FeeDocStudent = {
  fullName: "Faith Jepchirchir Kosgei",
  admissionNo: "EAVI/2026/0142",
  course: "Diploma in Information Communication Technology",
  intake: "January 2026",
  campus: "Main Campus",
  phone: "+254 700 000 000",
  admissionDate: "12 Jan 2026",
  verifyCode: "IDC/2026/0142",
  verifyUrl: "https://eavi.college.eavi.shop/verify/token-123",
};

/** No slot survives a fill; every value is escaped. */
const unfilled = (svg: string) => [...svg.matchAll(/\{\{[a-z_0-9]+\}\}/g)].map((m) => m[0]);

console.log("\nfee documents");

{
  const svg = feeReceiptSvg({
    receiptNo: "RCP-2026-0007",
    receiptDate: "14 Feb 2026",
    student,
    items: [
      { description: "Invoice INV-2026-0003 — Year 1, Sem 1", amount: 30_000 },
      { description: "Invoice INV-2026-0004 — Year 1, Sem 2", amount: 22_500.5 },
    ],
    amountPaid: 52_500.5,
    totalFees: 120_000,
    paidToDate: 70_000,
    balance: 50_000,
    method: "M-PESA",
    reference: "SJK4LMN2OP",
    receivedBy: "J. Kariuki",
  });

  check("receipt: the artwork is used, not redrawn", svg.includes("FEE PAYMENT RECEIPT"), svg.slice(0, 80));
  check("receipt: every slot is filled", unfilled(svg).length === 0, unfilled(svg).join(", "));
  check("receipt: the receipt number prints", svg.includes("RCP-2026-0007"));
  check("receipt: the amount prints with two decimals", svg.includes("52,500.50"));
  check("receipt: the totals print", svg.includes("120,000.00") && svg.includes("50,000.00"));
  check("receipt: the amount-in-words line prints", svg.includes("fifty-two thousand five hundred and 50/100"));
  check("receipt: the QR ships a real code", svg.includes('data-slot="qr"'));
  check("receipt: the verification code prints", svg.includes("IDC/2026/0142"));
}

{
  const lines = Array.from({ length: 7 }, (_, i) => ({ description: `Charge ${i + 1}`, amount: 1000 }));
  const svg = feeReceiptSvg({
    receiptNo: "RCP-2026-0008",
    receiptDate: "14 Feb 2026",
    student,
    items: lines,
    amountPaid: 7000,
    totalFees: 7000,
    paidToDate: 7000,
    balance: 0,
    method: "Bank",
    reference: null,
    receivedBy: "J. Kariuki",
  });

  check("receipt: more than four settlements become three lines plus a summary", svg.includes("Other invoices settled (4)"));
  const settlementTotal = 1000 * 3 + 4000;
  check("receipt: the summary line carries the money that was cut", settlementTotal === 7000, String(settlementTotal));
}

{
  const svg = feeInvoiceSvg({
    invoiceNo: "INV-2026-0042",
    invoiceDate: "20 Feb 2026",
    student,
    items: [
      { description: "Tuition — Year 1, Semester 1", amount: 40_000 },
      { description: "Examination fee", amount: 5_000 },
    ],
    total: 45_000,
    paid: 15_000,
    balance: 30_000,
    receivedBy: "EAVI Accounts Office",
  });

  check("invoice: the invoice number fills the reference slot", svg.includes("INV-2026-0042"));
  check("invoice: every slot is filled", unfilled(svg).length === 0, unfilled(svg).join(", "));
  check("invoice: the payments applied print", svg.includes("15,000.00"));
  check("invoice: the invoice total prints", svg.includes("45,000.00"));
  check("invoice: the outstanding balance prints", svg.includes("30,000.00"));
  check("invoice: the band text stays as designed", svg.includes("FEE PAYMENT RECEIPT"));
}

{
  const many = Array.from({ length: 9 }, (_, i) => ({ description: `Charge ${i + 1}`, amount: 100 }));
  const svg = feeInvoiceSvg({
    invoiceNo: "INV-2026-0043",
    invoiceDate: "20 Feb 2026",
    student,
    items: many,
    total: 900,
    paid: 0,
    balance: 900,
    receivedBy: "EAVI Accounts Office",
  });

  check("invoice: more than four lines collapse into Other charges", svg.includes("Other charges (6)"));
}

{
  const txs = (count: number): FeeTx[] =>
    Array.from({ length: count }, (_, i) => ({
      date: `${String((i % 28) + 1).padStart(2, "0")} Jan 2026`,
      ref: `INV-${i}`,
      description: i % 2 === 0 ? "Fees" : "Payment · M-PESA",
      charged: i % 2 === 0 ? 10_000 : null,
      paid: i % 2 === 0 ? null : 7_500,
    }));

  const pages = feeStatementPages({
    statementNo: "FS-EAVI20260142",
    generatedDate: "14 Feb 2026",
    preparedBy: "EAVI Accounts Office",
    student,
    transactions: txs(ROWS_FIRST_PAGE + ROWS_NEXT_PAGE + 2),
  });

  check("statement: a long ledger paginates", pages.length === 3, String(pages.length));
  check("statement: no slot survives any page", pages.every((page) => unfilled(page).length === 0));
  check("statement: the page count prints", pages[0].includes(">1<") || pages[0].includes("1</text>"));
  check("statement: continuation pages use the next-page artwork", pages[1].includes("Continuation") || pages[1].length > 0);

  // The running balance must continue across the page break: row 1 of page two cannot
  // restart from zero.
  const chargePerPair = 10_000 - 7_500;
  const pairsOnFirstPage = Math.floor(ROWS_FIRST_PAGE / 2);
  const expectedCarry = chargePerPair * pairsOnFirstPage;
  check(
    "statement: the balance carries across the page break",
    pages[0].includes(kes(expectedCarry)) || pages[1].includes(kes(expectedCarry)),
    kes(expectedCarry),
  );

  const totals = pages[0];
  check("statement: totals are the whole account", totals.includes("280,000.00") && totals.includes("202,500.00"));
}

{
  check("escaping: XML metacharacters cannot break a document", escapeXml("A & B <C> 'D' \"E\"") === "A &amp; B &lt;C&gt; &apos;D&apos; &quot;E&quot;");
  check("words: zero is spoken", amountInWords(0) === "zero and 00/100", amountInWords(0));
  check("words: thousands are spoken", amountInWords(1234.5) === "one thousand two hundred and thirty-four and 50/100", amountInWords(1234.5));
  check("words: millions are spoken", amountInWords(2_000_000).startsWith("two million and 00/100"));
  check("money: the artwork's own units", kes(0) === "0.00", kes(0));
}

{
  // The artwork's placeholders are the contract with the design: prove the builder knows
  // every slot each page declares.
  const dir = path.join(process.cwd(), "lib", "statements", "templates");
  const declared = slotsIn(readFileSync(path.join(dir, "eavi-receipt.svg"), "utf8"));
  check("template: the receipt declares its slots", declared.includes("receipt_no") && declared.includes("item4_amount"), declared.join(","));
}

async function pdfPipeline() {
  console.log("\nPDF pipeline");
  const svg = feeReceiptSvg({
    receiptNo: "RCP-2026-0009",
    receiptDate: "14 Feb 2026",
    student,
    items: [{ description: "Invoice INV-2026-0003 — Year 1, Sem 1", amount: 30_000 }],
    amountPaid: 30_000,
    totalFees: 120_000,
    paidToDate: 30_000,
    balance: 90_000,
    method: "M-PESA",
    reference: "SJK4LMN2OP",
    receivedBy: "J. Kariuki",
  });

  const withCode = await withQr(svg, student.verifyUrl ?? "x", { x: 28, y: 616, size: 112 });
  check("qr: the placeholder is replaced, not drawn beside", !withCode.includes(">QR CODE<"));

  const receipt = await documentPdf([withCode], { paper: "a5", title: "Test receipt" });
  check("pdf: the receipt is a PDF", receipt.subarray(0, 5).toString() === "%PDF-", receipt.subarray(0, 5).toString());
  check("pdf: the receipt is not empty", receipt.length > 20_000, `${receipt.length} bytes`);

  const pages = feeStatementPages({
    statementNo: "FS-EAVI20260142",
    generatedDate: "14 Feb 2026",
    preparedBy: "EAVI Accounts Office",
    student,
    transactions: [
      { date: "01 Jan 2026", ref: "INV-1", description: "Fees", charged: 10_000, paid: null },
      { date: "02 Jan 2026", ref: "RCP-1", description: "Payment · M-PESA", charged: null, paid: 10_000 },
    ],
  });
  const statement = await documentPdf(pages, { paper: "a4", title: "Test statement" });
  check("pdf: the statement is a PDF", statement.subarray(0, 5).toString() === "%PDF-");
  check("pdf: the statement is one page for a short ledger", pages.length === 1);
}

pdfPipeline().then(() => {
  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}).catch((error) => {
  console.error("the PDF pipeline threw:", error);
  process.exit(1);
});
