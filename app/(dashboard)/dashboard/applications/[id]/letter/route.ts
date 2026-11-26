import { NextResponse } from "next/server";

import { approvedLetterForOffice } from "@/lib/admissions/issue";
import { renderAdmissionLetterPdf, renderAdmissionLetterSvg } from "@/lib/admissions/letter-svg";
import { requireCollegeAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import type { LetterView } from "@/components/admissions/offer-letter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Authenticated office download; the public QR token never authorizes this route. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCollegeAdmin();
  const application = await prisma.application.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true },
  });
  if (!application) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const letter = await approvedLetterForOffice(id);
  if (!letter) return NextResponse.json({ error: "No approved letter is available." }, { status: 404 });

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
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
    verificationUrl: `${origin}/verify/${letter.verifyToken}`,
    stamped: true,
  };
  const svg = await renderAdmissionLetterSvg(view, { websiteUrl: origin });
  const pdf = await renderAdmissionLetterPdf(svg);
  const filename = `Admission-Letter-${letter.reference.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
