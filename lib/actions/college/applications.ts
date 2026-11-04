"use server";

import {
  ApplicationStatus,
  EnrollmentStatus,
  Role,
  Status,
} from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  emailField,
  enumField,
  hiddenId,
  nextAdmissionNo,
  nextApplicationReference,
  onSave,
  passwordField,
  phoneField,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

/**
 * Only these three outcomes are decisions an administrator records here; `SUBMITTED` is
 * how an application arrives and `WITHDRAWN` is the applicant's own doing.
 */
const DECISIONS = ["APPROVED", "REJECTED", "REVIEWING"] as const satisfies readonly (
  | keyof typeof ApplicationStatus
)[];

const applicationCopy = pages.applications;
const studentCopy = pages.students;

const fieldLabel = (name: string) =>
  applicationCopy.create.fields.find((field) => field.name === name)?.label ??
  studentCopy.create.fields.find((field) => field.name === name)?.label ??
  name;

const decisionLabel = applicationCopy.decision.statusField.label;

/** The list, the overview counters, the roster and the enrolment screen all read this. */
const AFFECTED = [
  "/dashboard/applications",
  "/dashboard",
  "/dashboard/students",
  "/dashboard/enrollments",
];

export async function createApplication(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/applications", AFFECTED, async () => {
    // A super admin is not pinned to one campus, but an application always is, so a
    // campus-less administrator cannot log one from this form.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const fullName = requiredText(formData, "fullName", fieldLabel("fullName"));
    // The helper throws when this required field is empty; the guard only narrows the type.
    const email = emailField(formData, "email", fieldLabel("email"));
    if (!email) throw new FieldError(fieldErrors.required(fieldLabel("email")));
    // The helper tolerates an optional number; this form requires one, so narrow the type.
    const phone = phoneField(formData, "phone", fieldLabel("phone"), false);
    if (!phone) throw new FieldError(fieldErrors.required(fieldLabel("phone")));

    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: { some: { id: campusId } } },
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
        programId,
        campusId,
        previousQualification: text(formData, "previousQualification"),
        notes: text(formData, "notes"),
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

    // Approving twice must not admit the same applicant twice.
    if (decision === "APPROVED" && application.studentId === null) {
      // Validated and hashed before the write begins: a weak password or a slow key
      // derivation must not sit inside the database transaction.
      const passwordHash = await hashPassword(
        passwordField(formData, "password", fieldLabel("password")),
      );
      const admissionNo = await nextAdmissionNo();
      // The campus on the record, never the one on the form or the session alone.
      const campusId = application.campusId;

      await prisma.$transaction(async (tx) => {
        const user = await unique(fieldLabel("email"), () =>
          tx.user.create({
            data: {
              email: application.email.toLowerCase(),
              fullName: application.fullName,
              phone: application.phone,
              passwordHash,
              role: Role.STUDENT,
              status: Status.ACTIVE,
              campusId,
            },
            select: { id: true },
          }),
        );

        const profile = await unique(fieldLabel("admissionNo"), () =>
          tx.studentProfile.create({
            data: { userId: user.id, admissionNo, campusId },
            select: { id: true },
          }),
        );

        await unique(fieldLabel("programId"), () =>
          tx.enrollment.create({
            data: {
              studentId: profile.id,
              programId: application.programId,
              campusId,
              status: EnrollmentStatus.ACTIVE,
            },
            select: { id: true },
          }),
        );

        await tx.application.update({
          where: { id: application.id },
          data: { ...decided, studentId: profile.id },
        });
      });

      return;
    }

    await prisma.application.update({ where: { id: application.id }, data: decided });
  });
}
