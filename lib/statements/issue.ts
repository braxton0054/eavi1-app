import {
  feeInvoiceSvg,
  feeReceiptSvg,
  feeStatementPages,
  type FeeDocStudent,
  type InvoiceInput,
  type ReceiptInput,
  type StatementInput,
} from "@/lib/statements/fee-docs";
import { documentPdf, withQr } from "@/lib/statements/document";

/**
 * Turns a fee document's records into its PDF, once, for every screen that shows one.
 *
 * The student portal, the accounts office and the student's own statement all print the
 * same paper; keeping the assembly here is what stops the three from slowly becoming
 * three different documents. Nothing is stored: a PDF exists for the length of a response.
 */

/** The QR placeholder in the receipt artwork, in the artwork's own units (10 = 1mm). */
const RECEIPT_QR_BOX = { x: 28, y: 612, size: 104 };

/** A receipt: a payment's rows on the college's receipt design. */
export async function receiptPdf(input: Omit<ReceiptInput, "student"> & { student: FeeDocStudent }) {
  const svg = feeReceiptSvg(input);
  // The dashed box in the artwork is only a placeholder: a printed page must carry a code
  // a phone can read, or "scan to confirm" cannot be followed.
  const withCode = input.student.verifyUrl
    ? await withQr(svg, input.student.verifyUrl, RECEIPT_QR_BOX)
    : svg;

  const correction = input.kind === "CREDIT_NOTE" || Boolean(input.correctionType);
  return documentPdf([withCode], {
    paper: "a5",
    title: correction
      ? `EAVI credit note — ${input.receiptNo}`
      : `EAVI fee receipt — ${input.receiptNo}`,
  });
}

/** An invoice: one invoice record on the same design. */
export async function invoicePdf(input: Omit<InvoiceInput, "student"> & { student: FeeDocStudent }) {
  const svg = feeInvoiceSvg(input);
  const withCode = input.student.verifyUrl
    ? await withQr(svg, input.student.verifyUrl, RECEIPT_QR_BOX)
    : svg;

  return documentPdf([withCode], {
    paper: "a5",
    title: input.status === "VOID"
      ? `EAVI void invoice — ${input.invoiceNo}`
      : `EAVI fee invoice — ${input.invoiceNo}`,
  });
}

/** A statement: every page the account needs, in order. */
export async function statementPdf(input: Omit<StatementInput, "student"> & { student: FeeDocStudent }) {
  const pages = feeStatementPages(input);
  const STATEMENT_QR_BOX = { x: 40, y: 986, size: 80 };
  const withCodes = input.student.verifyUrl
    ? await Promise.all(pages.map((page) => withQr(page, input.student.verifyUrl!, STATEMENT_QR_BOX)))
    : pages;
  return documentPdf(withCodes, {
    paper: "a4",
    title: `EAVI fee statement — ${input.student.admissionNo}`,
  });
}
