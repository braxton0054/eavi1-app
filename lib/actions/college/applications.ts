"use server";

import { ApplicationStatus, EntryGrade } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { genderValues } from "@/lib/content/apply";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  emailField,
  enumField,
  hiddenId,
  nextApplicationReference,
  onSave,
  phoneField,
  requiredText,
  text,
} from "@/lib/actions/college/_shared";

/**
 * The two outcomes an administrator records here. There is no approval: an applicant stays
 * an application until enrolment, which is its own step and its own screen. `SUBMITTED` is
 * how an application arrives and `WITHDRAWN` is the applicant's own doing.
 */
const DECISIONS = ["REJECTED", "REVIEWING"] as const satisfies readonly (
  | keyof typeof ApplicationStatus
)[];

const GRADES = Object.keys(EntryGrade) as (keyof typeof EntryGrade)[];

const applicationCopy = pages.applications;

const fieldLabel = (name: string) =>
  applicationCopy.create.fields.find((field) => field.name === name)?.label ?? name;

const decisionLabel = applicationCopy.decision.statusField.label;

/** The list and the overview counters both read what this screen writes. */
const AFFECTED = ["/dashboard/applications", "/dashboard"];

export async function createApplication(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/applications", AFFECTED, async () => {
    // A super admin is not pinned to one campus, but an application always is, so a
    // campus-less administrator cannot log one from this form.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const fullName = requiredText(formData, "fullName", fieldLabel("fullName"));
    // The helper tolerates an optional number; this form requires one, so narrow the type.
    const phone = phoneField(formData, "phone", fieldLabel("phone"), false);
    if (!phone) throw new FieldError(fieldErrors.required(fieldLabel("phone")));
    // A walk-in rarely has an address on hand, and the office confirms one when they call.
    const email = emailField(formData, "email", fieldLabel("email"), true);
    const gender = enumField(formData, "gender", genderValues, fieldLabel("gender"));
    const grade = enumField(formData, "grade", GRADES, fieldLabel("grade"));

    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const program = await prisma.program.findFirst({
      where: { id: programId, archivedAt: null, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    const reference = await nextApplicationReference();

    await prisma.application.create({
      data: {
        reference,
        fullName,
        email,
        phone,
        gender,
        grade,
        programId,
        campusId,
        previousQualification: text(formData, "previousQualification"),
      },
    });
  });
}

export async function decideApplication(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const applicationId = hiddenId(formData, "applicationId", applicationCopy.title);
  const detail = `/dashboard/applications/${applicationId}`;

  return onSave(detail, [...AFFECTED, detail], async () => {
    const decision = enumField(formData, "decision", DECISIONS, decisionLabel);
    const decisionNote = text(formData, "decisionNote");

    const application = await prisma.application.findFirst({
      where: { id: applicationId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    });
    if (!application) throw new FieldError(fieldErrors.notOnCampus);

    const decided = {
      status: decision,
      decisionNote,
      decidedById: scope.userId,
      decidedAt: new Date(),
    };

    // The record is still an application either way. Nothing here opens a student account,
    // issues an admission number or writes an enrolment.
    await prisma.application.update({ where: { id: application.id }, data: decided });
  });
}
