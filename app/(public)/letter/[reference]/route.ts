import { NextResponse } from "next/server";

import { assembleOfferLetter } from "@/lib/admissions/letter";
import { feeStructureForProgram } from "@/lib/statements/fee-structure-data";
import { buildFeeStructureSvg } from "@/lib/statements/fee-structure";
import { letterForDownload } from "@/lib/admissions/issue";
import {
  renderAdmissionLetterSvg,
  renderAdmissionLetterPdf,
} from "@/lib/admissions/letter-svg";
import type { LetterView } from "@/components/admissions/offer-letter";

export const dynamic = "force-dynamic";

/**
 * Downloads an applicant's admission letter in SVG or PDF format.
 *
 * Public on purpose: an applicant has no portal account. Authority comes from a separate,
 * expiring download capability — never from the public QR verification token. The reference
 * alone is sequential (`APP/2026/0001`), so it is never sufficient.
 *
 * Supports:
 *   - `?format=svg` (default): Returns the standalone vector A4 SVG letter template styled with the
 *     official ID card colors, ID card logo, registrar signature, and live verification QR code.
 *   - `?format=pdf`: Returns the high-resolution A4 PDF document.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const url = new URL(_request.url);
  const token = url.searchParams.get("t") ?? "";
  const format = url.searchParams.get("format")?.toLowerCase();

  if (!reference || !token) {
    return NextResponse.json({ error: "This letter link is incomplete." }, { status: 400 });
  }

  const letter = await letterForDownload(decodeURIComponent(reference), token);
  if (!letter) {
    return NextResponse.json({ error: "This letter could not be found." }, { status: 404 });
  }

  const view: LetterView = {
    reference: letter.reference,
    printedName: letter.printedName,
    programName: letter.program.name,
    programCode: letter.program.code,
    campusName: letter.application.campus.name,
    intakeLabel: "the next available intake",
    startDate: letter.issuedAt,
    expiresAt: letter.expiresAt,
    issuedOn: letter.issuedAt,
    requirements: letter.requirements,
    verificationUrl: `${publicOrigin()}/verify/${letter.verifyToken}`,
    stamped: true,
  };

  const sanitizedRef = letter.reference.replace(/[^A-Za-z0-9]+/g, "-");

  // If format is explicitly 'pdf', assemble and return the PDF document
  if (format === "pdf") {
    let pdfBytes: Uint8Array;
    try {
      // The fee structure is generated from the programme's published plan, so the
      // document in the letter cannot drift from the figures used for invoices.
      let feeStructurePdf: Uint8Array | null = null;
      try {
        const doc = await feeStructureForProgram(letter.application.programId);
        if (doc) {
          const svg = buildFeeStructureSvg({ ...doc.input, logoUrl: `${publicOrigin()}/logo.png` });
          feeStructurePdf = await renderAdmissionLetterPdf(svg);
        }
      } catch {
        feeStructurePdf = null;
      }
      const assembled = await assembleOfferLetter(view, {
        feeStructureUrl: feeStructurePdf ? null : letter.feeStructureUrl,
        feeStructurePdf,
        bursaryFormUrl: letter.bursaryFormUrl,
      });
      pdfBytes = new Uint8Array(assembled.bytes);
    } catch {
      // Fallback: render A4 PDF directly from the SVG letter template if Chromium is unavailable
      const svg = await renderAdmissionLetterSvg(view, { websiteUrl: publicOrigin() });
      pdfBytes = await renderAdmissionLetterPdf(svg);
    }

    const filename = `Admission-Letter-${sanitizedRef}.pdf`;
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // Default / format=svg: Return the vector A4 SVG letter with inlined assets and QR code
  const svg = await renderAdmissionLetterSvg(view, { websiteUrl: publicOrigin() });
  const filename = `Admission-Letter-${sanitizedRef}.svg`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(Buffer.byteLength(svg, "utf-8")),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** The origin the verification link should point at. */
function publicOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
