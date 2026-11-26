/** Pure renderers: a snapshot in, a finished SVG and PDF out. No database, no clock. */

import { mergeFace, type FaceInput } from "@/lib/dal/cards";
import { documentPdf, withQr } from "@/lib/statements/document";
import {
  feeInvoiceSvg,
  feeReceiptSvg,
  type InvoiceInput,
} from "@/lib/statements/fee-docs";
import { buildFeeStructureSvg, feeStructureFilename, type FeeStructureInput } from "@/lib/statements/fee-structure";
import { buildStudentDetailsSvg } from "@/lib/statements/student-details";

import type { RenderedDocument, Snapshot } from "./types";

const RECEIPT_QR_BOX = { x: 28, y: 612, size: 104 };

/** Places a CR80 face on an A4 sheet. Both sides use the same 10-units-per-mm scale. */
function faceGroup(svg: string, x: number, y: number) {
  const inner = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)?.[1] ?? svg;
  return `<g transform="translate(${x},${y}) scale(0.3783)">${inner}</g>`;
}

/** The saved ID card document: front and back together on A4, the office's print sheet. */
export function buildCardA4Svg(front: string, back: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="794" height="1123" viewBox="0 0 794 1123" font-family="Liberation Sans, Arial, Helvetica, sans-serif">
<rect width="794" height="1123" fill="#FFFFFF"/>
<rect x="0" y="0" width="794" height="10" fill="#800080"/>
<text x="40" y="52" font-size="13" font-weight="bold" fill="#800080" letter-spacing="2">STUDENT IDENTITY CARD</text>
<text x="754" y="52" text-anchor="end" font-size="11" fill="#6B7280">FRONT</text>
<!--FACE_FRONT_START-->${faceGroup(front, 40, 70)}<!--FACE_FRONT_END-->
<text x="40" y="332" font-size="13" font-weight="bold" fill="#800080" letter-spacing="2">CARD REVERSE</text>
<text x="754" y="332" text-anchor="end" font-size="11" fill="#6B7280">BACK</text>
<!--FACE_BACK_START-->${faceGroup(back, 40, 350)}<!--FACE_BACK_END-->
<rect x="0" y="1083" width="794" height="40" fill="#800080"/>
<text x="397" y="1108" text-anchor="middle" font-size="11" font-weight="bold" fill="#FFFFFF" letter-spacing="1">EAST AFRICA VISION INSTITUTE  |  ELDORET, KENYA  |  STUDENT IDENTITY</text>
</svg>`;
}

/** Splits the saved A4 sheet back into the two standalone card faces the portal previews. */
export function savedCardFaces(sheet: string): { frontSvg: string; backSvg: string } {
  const between = (start: string, end: string) => {
    const from = sheet.indexOf(start);
    const to = sheet.indexOf(end);
    return from < 0 || to < 0 ? "" : sheet.slice(from + start.length, to);
  };
  const wrap = (inner: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="85.6mm" height="54mm" viewBox="0 0 856 540">${inner}</svg>`;
  return {
    frontSvg: wrap(between("<!--FACE_FRONT_START-->", "<!--FACE_FRONT_END-->")),
    backSvg: wrap(between("<!--FACE_BACK_START-->", "<!--FACE_BACK_END-->")),
  };
}

const dateOrNull = (value: unknown) => (typeof value === "string" ? new Date(value) : null);

async function renderIdCard(s: Snapshot): Promise<RenderedDocument> {
  const input: FaceInput = {
    serial: String(s.serial),
    status: String(s.status),
    verifyToken: String(s.verifyToken),
    issuedAt: dateOrNull(s.issuedAt),
    expiresAt: dateOrNull(s.expiresAt),
    createdAt: dateOrNull(s.createdAt) ?? new Date(0),
    campusName: String(s.campusName),
    className: (s.className as string | null) ?? null,
    programName: (s.programName as string | null) ?? null,
    admissionNo: String(s.admissionNo),
    photoUrl: (s.photoUrl as string | null) ?? null,
    fullName: String(s.fullName),
    email: String(s.email),
    guardian: (s.guardian as FaceInput["guardian"]) ?? null,
    period: (s.period as FaceInput["period"]) ?? null,
    enrollmentProgram: (s.enrollmentProgram as string | null) ?? null,
  };
  const face = await mergeFace(input);
  const svg = buildCardA4Svg(face.frontSvg, face.backSvg);
  const pdf = await documentPdf([svg], { paper: "a4", title: `EAVI ID card — ${face.serial}` });
  return { svg, pdf, fileName: `ID-Card-${face.serial.replace(/[^A-Za-z0-9]+/g, "-")}.pdf` };
}

async function paymentDocument(s: Snapshot, invoice: boolean): Promise<RenderedDocument> {
  const student = s.student as InvoiceInput["student"];
  const items = (s.items ?? []) as InvoiceInput["items"];
  const base = {
    student,
    items,
    receivedBy: String(s.receivedBy ?? "Accounts Office"),
  };
  const creditNote = !invoice && s.kind === "CREDIT_NOTE";
  const voidInvoice = invoice && s.status === "VOID";
  const svg = invoice
    ? feeInvoiceSvg({
        ...base,
        invoiceNo: String(s.invoiceNo),
        invoiceDate: String(s.invoiceDate),
        total: Number(s.total),
        paid: Number(s.paid),
        balance: Number(s.balance),
        status: String(s.status ?? ""),
        voidReason: (s.voidReason as string | null) ?? null,
      })
    : feeReceiptSvg({
        ...base,
        receiptNo: String(s.receiptNo),
        receiptDate: String(s.receiptDate),
        amountPaid: Number(s.amountPaid),
        totalFees: Number(s.totalFees),
        paidToDate: Number(s.paidToDate),
        balance: Number(s.balance),
        method: s.method === null || s.method === undefined ? "—" : String(s.method),
        reference: (s.reference as string | null) ?? null,
        kind: creditNote ? "CREDIT_NOTE" : "RECEIPT",
        correctionType: (s.correctionType as "REVERSAL" | "REFUND" | "CREDIT_NOTE" | null) ?? null,
      });
  const filled = student.verifyUrl ? await withQr(svg, student.verifyUrl, RECEIPT_QR_BOX) : svg;
  const reference = String(invoice ? s.invoiceNo : s.receiptNo);
  const label = invoice ? (voidInvoice ? "void invoice" : "invoice") : creditNote ? "credit note" : "receipt";
  const pdf = await documentPdf([filled], {
    paper: "a5",
    title: `EAVI ${label} — ${reference}`,
  });
  return {
    svg: filled,
    pdf,
    fileName: `${invoice ? (voidInvoice ? "Void-Invoice" : "Invoice") : creditNote ? "Credit-Note" : "Receipt"}-${reference.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
  };
}

async function renderProfile(s: Snapshot): Promise<RenderedDocument> {
  const svg = buildStudentDetailsSvg({
    fullName: String(s.fullName),
    admissionNo: String(s.admissionNo),
    program: String(s.program),
    level: String(s.level),
    duration: String(s.duration),
    intake: String(s.intake),
    campus: String(s.campus),
    className: String(s.className),
    dateOfBirth: String(s.dateOfBirth),
    gender: String(s.gender),
    nationalId: String(s.nationalId),
    primarySchool: String(s.primarySchool),
    secondarySchool: String(s.secondarySchool),
    grade: String(s.grade),
    admissionCategory: String(s.admissionCategory),
    previousInstitution: String(s.previousInstitution),
    recordedOn: String(s.recordedOn),
    birthCertificate: String(s.birthCertificate),
    primarySchoolDoc: String(s.primarySchoolDoc),
    secondarySchoolDoc: String(s.secondarySchoolDoc),
    medicalInfo: String(s.medicalInfo),
    guardianName: String(s.guardianName),
    guardianRelationship: String(s.guardianRelationship),
    guardianPhone: String(s.guardianPhone),
    guardianAlt: String(s.guardianAlt),
    guardianEmail: String(s.guardianEmail),
    guardianOccupation: String(s.guardianOccupation),
    guardianAddress: String(s.guardianAddress),
    emergencyName: String(s.emergencyName),
    emergencyPhone: String(s.emergencyPhone),
    phone: String(s.phone),
    email: String(s.email),
    address: String(s.address),
    reference: String(s.reference),
    preparedOn: String(s.recordedOn),
    photoUrl: (s.photoUrl as string | null) ?? undefined,
  });
  const pdf = await documentPdf([svg], { paper: "a4", title: `Student record — ${s.admissionNo}` });
  return {
    svg,
    pdf,
    fileName: `Student-Record-${String(s.admissionNo).replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
  };
}

async function renderFeeStructure(s: Snapshot): Promise<RenderedDocument> {
  const input = s as unknown as FeeStructureInput;
  const svg = buildFeeStructureSvg(input);
  const pdf = await documentPdf([svg], { paper: "a4", title: `EAVI fee structure — ${input.programCode}` });
  return { svg, pdf, fileName: feeStructureFilename(input.programCode).replace(/\.svg$/, ".pdf") };
}

/** Renderers by document kind. The registry never imports Prisma directly. */
export const RENDERERS: Record<string, (snapshot: Snapshot) => Promise<RenderedDocument>> = {
  ID_CARD: renderIdCard,
  INVOICE: (s) => paymentDocument(s, true),
  RECEIPT: (s) => paymentDocument(s, false),
  STUDENT_PROFILE: renderProfile,
  FEE_STRUCTURE: renderFeeStructure,
};
