import { NextResponse, type NextRequest } from "next/server";

import { EntryGrade } from "@/generated/prisma/enums";
import { limitApplicationLookup } from "@/lib/chat/rate-limit";
import { assignCampus } from "@/lib/dal/public";
import { issueLetterForApplication } from "@/lib/admissions/issue";
import { checkGrade, gradeLabel, meetsMinimum } from "@/lib/admissions/grade";
import { applyGrade } from "@/lib/content/apply";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Change the programme on an application that has not yet led to enrolment.
 *
 * Authority is the letter's unguessable token, not a session: applicants have no account.
 * Once a student profile exists for the application the record belongs to the college
 * register and this endpoint refuses to touch it.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  try {
    limitApplicationLookup(ip);
  } catch {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  const token = typeof body?.verifyToken === "string" ? body.verifyToken.trim() : "";
  const programId = typeof body?.programId === "string" ? body.programId.trim() : "";

  if (!reference || !token || !programId) {
    return NextResponse.json({ error: "That update link is incomplete." }, { status: 400 });
  }

  const application = await prisma.application.findFirst({
    where: { reference, offerLetter: { verifyToken: token, revokedAt: null } },
    select: {
      id: true,
      grade: true,
      studentProfile: { select: { id: true } },
      campus: { select: { name: true } },
    },
  });

  if (!application) return NextResponse.json({ error: "That application could not be found." }, { status: 404 });

  if (application.studentProfile) {
    return NextResponse.json(
      { error: `You are already enrolled. Please visit the ${application.campus.name} offices.` },
      { status: 409 },
    );
  }

  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, name: true, minKcseGrade: true, admissionRequirements: true, feeStructureUrl: true, bursaryFormUrl: true },
  });
  if (!program || !(Object.keys(EntryGrade) as string[]).includes(application.grade ?? "")) {
    return NextResponse.json({ error: "That programme is not available." }, { status: 400 });
  }

  if (!meetsMinimum(application.grade as EntryGrade, program.minKcseGrade)) {
    const { eligible } = await checkGrade(application.grade as EntryGrade, programId);
    return NextResponse.json(
      {
        error: applyGrade.belowMinimum(gradeLabel(application.grade as EntryGrade), gradeLabel(program.minKcseGrade)),
        suggestions: eligible.map((entry) => ({ id: entry.id, name: entry.name, minGrade: gradeLabel(entry.minGrade) })),
      },
      { status: 422 },
    );
  }

  const campus = await assignCampus(programId);
  if (!campus) return NextResponse.json({ error: "No campus teaches that programme right now." }, { status: 400 });

  await prisma.application.update({
    where: { id: application.id },
    data: { programId, campusId: campus.id },
  });

  /*
   * Reissue the letter for the new programme. upsert keeps the existing row and token, so
   * the URL already given to the applicant stays valid; only the frozen programme fields
   * and requirements are refreshed.
   */
  await prisma.offerLetter.update({
    where: { applicationId: application.id },
    data: {
      programId,
      campusId: campus.id,
      requirements: program.admissionRequirements,
      feeStructureUrl: program.feeStructureUrl,
      bursaryFormUrl: program.bursaryFormUrl,
    },
  });

  const letter = await issueLetterForApplication(application.id);
  return NextResponse.json({
    reference,
    campusName: campus.name,
    programName: program.name,
    letterUrl: letter
      ? `/letter/${encodeURIComponent(letter.reference)}?t=${encodeURIComponent(letter.verifyToken)}`
      : null,
  });
}
