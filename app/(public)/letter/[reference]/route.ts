import { NextResponse } from "next/server";

import { assembleOfferLetter } from "@/lib/admissions/letter";
import { letterForDownload } from "@/lib/admissions/issue";
import type { LetterView } from "@/components/admissions/offer-letter";

export const dynamic = "force-dynamic";

/**
 * Downloads an applicant's letter.
 *
 * Public on purpose: the applicant has just filled in a form and has no account. Authority comes
 * from the token instead of a session — the reference alone is sequential (`APP/2026/0001`), so
 * honouring it by itself would let anyone walk the range and download other people's letters.
 *
 * The letter is stamped, because it is the document the student brings to enrolment and an
 * unstamped letter would not be accepted at the counter. That is safe only because the token makes
 * it unforgeable in the other direction: the stamp is ours, the reference is ours, and anyone can
 * check the pair at `/verify`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  const token = new URL(_request.url).searchParams.get("t") ?? "";

  if (!reference || !token) {
    return NextResponse.json({ error: "This letter link is incomplete." }, { status: 400 });
  }

  const letter = await letterForDownload(decodeURIComponent(reference), token);
  if (!letter) {
    // One message for a wrong reference and a wrong token: saying which was wrong would confirm
    // that a reference exists, which is the first step to guessing a token.
    return NextResponse.json({ error: "This letter could not be found." }, { status: 404 });
  }

  const view: LetterView = {
    reference: letter.reference,
    printedName: letter.printedName,
    programName: letter.program.name,
    programCode: letter.program.code,
    campusName: letter.application.campus.name,
    intakeLabel: "the intake stated on your application",
    // The letter is dated when it was issued; the intake start is not something we know per
    // applicant at this point, so the letter avoids promising a day it cannot stand behind.
    startDate: letter.issuedAt,
    expiresAt: letter.expiresAt,
    issuedOn: letter.issuedAt,
    requirements: letter.requirements,
    verificationUrl: `${publicOrigin()}/verify/${letter.verifyToken}`,
    stamped: true,
  };

  const pdf = await assembleOfferLetter(view, {
    feeStructureUrl: letter.feeStructureUrl,
    bursaryFormUrl: letter.bursaryFormUrl,
  });

  const filename = `Admission-Letter-${letter.reference.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(pdf.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.bytes.byteLength),
      // Never cached: the letter carries a live verification token.
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
