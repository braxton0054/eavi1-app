import { writeFileSync } from "node:fs";

import { feeReceiptSvg, feeStatementPages, type FeeDocStudent } from "@/lib/statements/fee-docs";
import { documentPdf, withQr } from "@/lib/statements/document";
import { renderAdmissionLetterSvg, renderAdmissionLetterPdf } from "@/lib/admissions/letter-svg";

async function main() {
  const longName = "Bartholomew Kipchoge arap Mwangi Ochieng' Ogutu Wanjiku Njoroge Muthoni Kamau";
  const student: FeeDocStudent = {
    fullName: longName,
    admissionNo: "EAVI/2026/000000001234567890",
    course: "Diploma in Information Communication Technology with specialised options in Software Engineering and Data Networking",
    intake: "January 2026 intake, Main Campus, extended reporting period",
    campus: "Main Campus",
    phone: "+254700000000",
    admissionDate: "01 January 2026",
    verifyCode: "IDC/2026/000000001234567890",
    verifyUrl: "https://eavi.college.eavi.shop/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  };

  const receipt = feeReceiptSvg({
    receiptNo: "RCP/2026/00000000000123456789",
    receiptDate: "25 November 2026",
    student,
    items: Array.from({ length: 7 }, (_, i) => ({
      description: `Invoice INV/2026/${String(i).padStart(9, "0")} — Year 1, Semester 1, tuition and registration charges with a longer description`,
      amount: 1_234_567.89,
    })),
    amountPaid: 8_641_975.23,
    totalFees: 12_345_678.9,
    paidToDate: 8_641_975.23,
    balance: 3_703_703.67,
    method: "M-PESA",
    reference: "M-PESA TRANSACTION CODE ABCDEF123456789",
    receivedBy: longName,
  });
  const receiptWithQr = await withQr(receipt, student.verifyUrl!, { x: 28, y: 612, size: 104 });
  writeFileSync(
    "/tmp/opencode/long-receipt.pdf",
    await documentPdf([receiptWithQr], { paper: "a5", title: "long receipt" }),
  );

  const pages = feeStatementPages({
    statementNo: "STM/2026/00000000000123456789",
    generatedDate: "25 November 2026",
      student,
    transactions: Array.from({ length: 23 }, (_, i) => ({
      date: "25 November 2026",
      ref: `INV/2026/${String(i).padStart(9, "0")}`,
      description: "Long transaction description for a fee charge or payment that needs a wide column",
      charged: 123_456.78,
      paid: null,
      balance: 987_654.32,
    })),
          preparedBy: longName,
  });
  const statements = await Promise.all(
    pages.map((page) => withQr(page, student.verifyUrl!, { x: 40, y: 986, size: 80 })),
  );
  writeFileSync(
    "/tmp/opencode/long-statement.pdf",
    await documentPdf(statements, { paper: "a4", title: "long statement" }),
  );

  const svg = await renderAdmissionLetterSvg({
    reference: "APP/2026/00000000000123456789",
    printedName: longName,
    programName: "Diploma in Information Communication Technology with specialised options in Software Engineering",
    programCode: "KNEC-DICT-0000001",
    campusName: "Main Campus",
    intakeLabel: "January 2026",
    startDate: new Date("2026-01-05"),
    expiresAt: new Date("2026-12-31"),
    issuedOn: new Date("2026-11-25"),
    requirements: null,
    verificationUrl: "https://eavi.college.eavi.shop/verify/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    stamped: false,
  });
  writeFileSync("/tmp/opencode/long-letter.svg", svg);
  writeFileSync("/tmp/opencode/long-letter.pdf", await renderAdmissionLetterPdf(svg));
  console.log("proofs written");

}

main().catch((error) => { console.error(error); process.exit(1); });
