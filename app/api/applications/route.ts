import { NextResponse, type NextRequest } from "next/server";

import { ApplicationStatus, EntryGrade, Gender } from "@/generated/prisma/enums";
import { nextApplicationReference } from "@/lib/actions/college/_shared";
import { applyPage } from "@/lib/content/apply";
import { assignCampus } from "@/lib/dal/public";
import { prisma } from "@/lib/prisma";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";

/** Fields that carry text all have a ceiling, so one submission cannot fill the table. */
const MAX_NAME = 120;
const MAX_EMAIL = 200;

/** An application still waiting on the campus office; a decided one may be repeated. */
const OPEN = [ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING];

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Nothing the applicant can act on, so nothing invites a guess at another answer. */
function refused() {
  return NextResponse.json({ error: applyPage.errors.failed }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return refused();

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
  if (!(Object.keys(Gender) as string[]).includes(gender)) {
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

  // The campus is not the applicant's choice: the one that teaches the course and still
  // has a place takes them. Neither id is taken on trust from the browser.
  const campus = await assignCampus(programId);
  if (!campus) {
    return NextResponse.json(
      { fieldErrors: { programId: applyPage.fields.program.none } },
      { status: 400 },
    );
  }

  // The same person applying twice for the same course only clutters the campus list.
  const alreadyIn = await prisma.application.findFirst({
    where: { phone, programId, status: { in: OPEN } },
    select: { id: true },
  });
  if (alreadyIn) {
    return NextResponse.json(
      { fieldErrors: { phone: applyPage.errors.duplicate } },
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
      select: { reference: true },
    });

    return NextResponse.json(
      { reference: application.reference, campusName: campus.name },
      { status: 201 },
    );
  } catch {
    return refused();
  }
}
