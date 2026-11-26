import { NextResponse, type NextRequest } from "next/server";

import { EntryGrade, Gender } from "@/generated/prisma/enums";
import {
  enforceApplicationRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import { nextApplicationReference } from "@/lib/actions/college/_shared";
import { applyPage, genderValues } from "@/lib/content/apply";
import { assignCampus } from "@/lib/dal/public";
import { checkGrade, gradeLabel, meetsMinimum } from "@/lib/admissions/grade";
import { applyGrade } from "@/lib/content/apply";
import { prisma } from "@/lib/prisma";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";

/** Fields that carry text all have a ceiling, so one submission cannot fill the table. */
const MAX_NAME = 120;
const MAX_EMAIL = 200;


const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Nothing the applicant can act on, so nothing invites a guess at another answer. */
function refused() {
  return NextResponse.json({ error: applyPage.errors.failed }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return refused();

  const answers = body as Record<string, unknown>;
  const rawPhone = str(answers.phone);
  const rawEmail = str(answers.email);

  try {
    await enforceApplicationRateLimit(request, rawEmail.toLowerCase(), rawPhone);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(unavailableSecurityControls(), { status: 503 });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: applyPage.errors.tooMany },
        { status: 429, headers: { "Retry-After": String(retryAfterOf(error)) } },
      );
    }
    throw error;
  }

  // A person never sees or fills this in, so anything in it means a bot sent the form.
  if (str(answers.website) !== "") return refused();

  const fieldErrors: Record<string, string> = {};

  const fullName = str(answers.fullName);
  if (fullName.length < 2) fieldErrors.fullName = applyPage.fields.fullName.empty;
  else if (fullName.length > MAX_NAME) fieldErrors.fullName = applyPage.errors.tooLong;

  const phone = normalizeKenyanPhone(rawPhone) ?? "";
  if (!phone) {
    fieldErrors.phone = rawPhone
      ? applyPage.fields.phone.wrong
      : applyPage.fields.phone.empty;
  }

  if (rawEmail && !isEmail(rawEmail)) fieldErrors.email = applyPage.fields.email.wrong;
  else if (rawEmail.length > MAX_EMAIL) fieldErrors.email = applyPage.errors.tooLong;
  const email = rawEmail ? rawEmail.toLowerCase() : null;

  const gender = str(answers.gender);
  if (!(genderValues as string[]).includes(gender)) {
    fieldErrors.gender = applyPage.fields.gender.empty;
  }

  const grade = str(answers.grade);
  if (!(Object.keys(EntryGrade) as string[]).includes(grade)) {
    fieldErrors.grade = applyPage.fields.grade.empty;
  }

  const programId = str(answers.programId);
  if (!programId) fieldErrors.programId = applyPage.fields.program.empty;

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ fieldErrors }, { status: 400 });
  }

  /*
   * The grade check happens before a place is assigned, because whether they qualify decides
   * whether there is anything to place them in.
   *
   * The applicant picked a programme from a list of every course on offer, so nothing has
   * confirmed their grade clears that programme's minimum until here. Rather than a bare refusal,
   * the programmes they *do* qualify for are returned with it: an applicant with a D who is turned
   * away from a diploma should be handed the certificates that will take them, not left to guess.
   */
  const minimum = await prisma.program.findUnique({
    where: { id: programId },
    select: { minKcseGrade: true },
  });

  if (minimum && !meetsMinimum(grade as EntryGrade, minimum.minKcseGrade)) {
    const { eligible } = await checkGrade(grade as EntryGrade, programId);
    return NextResponse.json(
      {
        fieldErrors: {
          grade: applyGrade.belowMinimum(gradeLabel(grade as EntryGrade), gradeLabel(minimum.minKcseGrade)),
        },
        suggestions: eligible.map((entry) => ({
          id: entry.id,
          name: entry.name,
          minGrade: gradeLabel(entry.minGrade),
        })),
      },
      { status: 422 },
    );
  }

  // The campus is not the applicant's choice: the one that teaches the course and still
  // has a place takes them. Neither id is taken on trust from the browser.
  const campus = await assignCampus(programId);
  if (!campus) {
    return NextResponse.json(
      { fieldErrors: { programId: applyPage.fields.program.none } },
      { status: 400 },
    );
  }

  // Contact details are unverified at submission, so they never reserve an identity.
  // The office verifies ownership before approval, enrolment, or official letter issuance.

  try {
    const application = await prisma.application.create({
      data: {
        reference: await nextApplicationReference(),
        fullName,
        phone,
        email,
        gender: gender as Gender,
        grade: grade as EntryGrade,
        programId,
        campusId: campus.id,
      },
      select: { id: true, reference: true },
    });

    return NextResponse.json(
      { reference: application.reference, campusName: campus.name },
      { status: 201 },
    );
  } catch {
    return refused();
  }
}
