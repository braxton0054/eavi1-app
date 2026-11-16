import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { site } from "@/lib/content/home";
import { formatDate } from "@/lib/format";
import { getStudentFees, getStudentProfile } from "@/lib/dal/student-portal";
import { A4_PORTRAIT, feesStatementSvg, type FeesStatementTx } from "@/lib/statements/fees-statement";

/**
 * The signed-in student's fee statement as a PDF.
 *
 * The student is the scope, so there is nothing to pass in: the statement is built from
 * their own invoices and payments the same way the fees screen reads them, then rendered
 * through the same SVG -> 300 DPI PNG -> PDF pipeline the print runs use.
 */

const MM_TO_PX = 300 / 25.4;
const MM_TO_PT = 72 / 25.4;

export async function GET() {
  const [{ enrollment, invoices, payments }, { profile }] = await Promise.all([
    getStudentFees(),
    getStudentProfile(),
  ]);

  if (!enrollment) {
    return NextResponse.json({ error: "No enrolment on record." }, { status: 404 });
  }

  // Invoices are the debits; payments are the credits. Together they are the statement's
  // whole story, and the summary is derived from them so the totals can never disagree
  // with the rows.
  const transactions: FeesStatementTx[] = [
    ...invoices.map((invoice) => ({
      date: invoice.dueAt ? formatDate(invoice.dueAt) : "",
      description:
        `Invoice ${invoice.number}` +
        (invoice.periodYear && invoice.periodSemester
          ? ` (Year ${invoice.periodYear}, Sem ${invoice.periodSemester})`
          : ""),
      debit: invoice.amount,
      credit: null,
    })),
    ...payments.map((payment) => ({
      date: formatDate(payment.paidAt),
      description:
        `Payment${payment.method ? ` · ${payment.method}` : ""}` +
        (payment.reference ? ` · ${payment.reference}` : ""),
      debit: null,
      credit: Number(payment.amount.toString()),
    })),
  ];

  const svg = feesStatementSvg({
    fullName: profile?.user.fullName ?? "—",
    admissionNo: profile?.admissionNo ?? "—",
    course: enrollment.program.name,
    campus: profile?.campus.name ?? "—",
    intake: enrollment.period?.name ?? null,
    statementDate: formatDate(new Date()),
    website: site.url ?? null,
    contactEmail: profile?.user.email ?? null,
    transactions,
  });

  const png = await sharp(Buffer.from(svg), { density: 300 })
    .resize(
      Math.round(A4_PORTRAIT.widthMm * MM_TO_PX),
      Math.round(A4_PORTRAIT.heightMm * MM_TO_PX),
      { fit: "fill" },
    )
    .png()
    .toBuffer();

  const pdf = await PDFDocument.create();
  pdf.setTitle(`EAVI fee statement — ${profile?.admissionNo ?? ""}`);
  pdf.setCreator("EAVI Portal");
  pdf.setProducer("EAVI Portal");

  const embedded = await pdf.embedPng(png);
  const page = pdf.addPage([
    A4_PORTRAIT.widthMm * MM_TO_PT,
    A4_PORTRAIT.heightMm * MM_TO_PT,
  ]);
  page.drawImage(embedded, {
    x: 0,
    y: 0,
    width: A4_PORTRAIT.widthMm * MM_TO_PT,
    height: A4_PORTRAIT.heightMm * MM_TO_PT,
  });

  const file = Buffer.from(await pdf.save());
  const name = `eavi-fee-statement-${(profile?.admissionNo ?? "student")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}.pdf`;

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
