import { NextResponse, type NextRequest } from "next/server";

import { EntryGrade, Gender } from "@/generated/prisma/enums";
import { limitApplications } from "@/lib/chat/rate-limit";
import { nextApplicationReference } from "@/lib/actions/college/_shared";
import { applyPage, genderValues } from "@/lib/content/apply";
import { assignCampus } from "@/lib/dal/public";
import { issueLetterForApplication } from "@/lib/admissions/issue";
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

/**
 * The caller's address, for rate limiting only.
 *
 * Behind Caddy the socket belongs to the proxy, so the forwarding headers are what identify the
 * applicant. They are caller-supplied and therefore spoofable, which is acceptable here: the
 * limit exists to stop casual flooding, and a determined attacker who rotates a spoofed header
 * is bounded by what they can do anyway. Nothing is trusted from this value beyond the counter.
 */
function callerAddress(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return refused();

  /*
   * Before any work is done. Each accepted application mints a reference, a verification token
   * and a stored letter, so an unlimited endpoint is a cheap way to fill the database and bury
   * the office queue in records nobody submitted.
   */
  try {
    limitApplications(callerAddress(request));
  } catch {
    return NextResponse.json(
      { error: applyPage.errors.tooMany },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

  const answers = body as Record<string, unknown>;

  // A person never sees or fills this in, so anything in it means a bot sent the form.
  if (str(answers.website) !== "") return refused();

  const fieldErrors: Record<string, string> = {};

  const fullName = str(answers.fullName);
  if (fullName.length < 2) fieldErrors.fullName = applyPage.fields.fullName.empty;
  else if (fullName.length > MAX_NAME) fieldErrors.fullName = applyPage.errors.tooLong;

  const rawPhone = str(answers.phone);
  const phone = normalizeKenyanPhone(rawPhone) ?? "";
  if (!phone) {
    fieldErrors.phone = rawPhone
      ? applyPage.fields.phone.wrong
      : applyPage.fields.phone.empty;
  }

  const rawEmail = str(answers.email);
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

  /*
   * One application per person, ever — by email or by phone, whatever the programme and
   * whatever the status. A person already enrolled is told to visit their campus instead;
   * everyone else is pointed at the lookup form so they can retrieve or update their letter.
   */
  const alreadyIn = await prisma.application.findFirst({
    where: { OR: [...(email ? [{ email }] : []), { phone }] },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      campus: { select: { name: true } },
      studentProfile: { select: { id: true } },
    },
  });
  if (alreadyIn) {
    if (alreadyIn.studentProfile) {
      return NextResponse.json(
        {
          status: "enrolled",
          message: applyPage.lookup.enrolled.replace("__CAMPUS__", alreadyIn.campus.name),
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { status: "applied", fieldErrors: { phone: applyPage.errors.duplicate } },
      { status: 409 },
    );
  }

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

    /*
     * The letter is generated now, not by the office: the applicant downloads it straight away as
     * proof they applied, and brings it to enrolment. If issuing fails the application still
     * stands — losing a submitted application to keep a document tidy would be the worse trade.
     */
    const letter = await issueLetterForApplication(application.id).catch(() => null);

    return NextResponse.json(
      {
        reference: application.reference,
        campusName: campus.name,
        letterUrl: letter
          ? `/letter/${encodeURIComponent(letter.reference)}?t=${encodeURIComponent(letter.verifyToken)}`
          : null,
      },
      { status: 201 },
    );
  } catch {
    return refused();
  }
}
