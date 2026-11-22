import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

import {
  ADMISSION_LETTER_SVG_TEMPLATE,
  mergeAdmissionLetterTemplate,
  type AdmissionLetterSlots,
} from "@/components/admissions/admission-letter-svg";
import type { LetterView } from "@/components/admissions/offer-letter";
import { formatDate } from "@/lib/format";
import { site } from "@/lib/content/home";

/**
 * Cache for inlined public asset data URIs to avoid repeated disk reads.
 */
const assetCache = new Map<string, string>();

/**
 * Reads a public image from disk and inlines it as a base64 data URI.
 * This guarantees the SVG letter is 100% self-contained when saved or printed.
 */
async function dataUri(filename: string): Promise<string> {
  const cached = assetCache.get(filename);
  if (cached) return cached;

  try {
    const filePath = path.join(process.cwd(), "public", filename);
    const bytes = await readFile(filePath);
    const mime = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".svg")
        ? "image/svg+xml"
        : "image/jpeg";
    const uri = `data:${mime};base64,${bytes.toString("base64")}`;
    assetCache.set(filename, uri);
    return uri;
  } catch {
    return "";
  }
}

/**
 * Generates an SVG group containing the vector QR code scaled to the target size.
 */
async function generateLetterQrGroup(url: string, targetSize = 185): Promise<string> {
  const qrSvg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
  });

  const dimMatch = qrSvg.match(/viewBox="0 0 (\d+)/);
  const dim = Number(dimMatch ? dimMatch[1] : 33);
  const innerPaths = qrSvg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>[\s\S]*$/, "");

  const scale = (targetSize / dim).toFixed(4);
  return `<g transform="scale(${scale})">${innerPaths}</g>`;
}

/**
 * Injects the live verification vector QR code into the template's QR slot.
 */
function fillQrSlot(templateSvg: string, qrGroupSvg: string): string {
  const match = templateSvg.match(/<g[^>]*data-slot="qr"[^>]*>[\s\S]*?<\/g>/);
  if (!match) return templateSvg;

  return templateSvg.replace(
    match[0],
    `<g data-slot="qr" transform="translate(1215, 2060)">${qrGroupSvg}</g>`,
  );
}

/**
 * Extracts the verification token from the verification URL.
 */
function tokenFromUrl(url: string): string {
  const parts = url.split("/verify/");
  return parts.length > 1 ? parts[1].split(/[?#]/)[0] : url;
}

/**
 * Assembles the full self-contained A4 SVG admission letter.
 */
export async function renderAdmissionLetterSvg(
  view: LetterView,
  options?: { websiteUrl?: string },
): Promise<string> {
  // 1. Load institutional ID card assets as base64 data URIs
  const [logoUri, signatureUri, stampUri] = await Promise.all([
    dataUri("card-logo.png"),
    dataUri("card-signature.png"),
    dataUri("letter-stamp.png"),
  ]);

  // 2. Generate vector QR code
  const verificationUrl = view.verificationUrl;
  const qrGroup = await generateLetterQrGroup(verificationUrl, 185);

  // 3. Inject QR code into the SVG template
  const withQr = fillQrSlot(ADMISSION_LETTER_SVG_TEMPLATE, qrGroup);

  // 4. Map LetterView data to the SVG slots
  const slots: AdmissionLetterSlots = {
    logo_url: logoUri,
    signature_url: signatureUri,
    stamp_url: stampUri,
    reference: view.reference,
    full_name: view.printedName,
    course: view.programName,
    course_code: view.programCode || "EAVI-PROG",
    campus: view.campusName,
    intake: view.intakeLabel || "Upcoming Intake",
    issue_date: formatDate(view.issuedOn),
    expiry_date: formatDate(view.expiresAt),
    verify_token: tokenFromUrl(verificationUrl),
    verify_url: verificationUrl,
    website: options?.websiteUrl || site.url || "https://eavi.college.eavi.shop",
  };

  return mergeAdmissionLetterTemplate(withQr, slots);
}

/**
 * Converts the A4 SVG letter into a high-resolution, print-ready PDF document.
 */
export async function renderAdmissionLetterPdf(svg: string): Promise<Uint8Array> {
  // Render SVG to high-res PNG at 150 DPI for balance of razor sharpness and fast generation
  const png = await sharp(Buffer.from(svg), { density: 150 }).png().toBuffer();

  const pdfDoc = await PDFDocument.create();
  // Standard A4 dimensions in points: 210mm x 297mm = 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const image = await pdfDoc.embedPng(png);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: 595.28,
    height: 841.89,
  });

  return pdfDoc.save();
}
