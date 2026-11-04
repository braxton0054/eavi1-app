"use server";

import { EnrollmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  enumField,
  hiddenId,
  onSave,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const STATUSES = Object.keys(EnrollmentStatus) as (keyof typeof EnrollmentStatus)[];

const fieldLabel = (name: string) =>
  pages.enrollments.create.fields.find((field) => field.name === name)?.label ?? name;

const statusLabel = pages.enrollments.update.statusField.label;

/** The enrolment table, the overview counters and the student roster all read this. */
const AFFECTED = ["/dashboard/enrollments", "/dashboard", "/dashboard/students"];

export async function createEnrollment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/enrollments", AFFECTED, async () => {
    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const intakeId = text(formData, "intakeId");
    const cohort = text(formData, "cohort");

    // A super admin is not pinned to one campus, so the campus comes from the student.
    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { campusId: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    const program = await prisma.program.findFirst({
      where: {
        id: programId,
        ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
      },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    if (intakeId) {
      const intake = await prisma.intake.findUnique({
        where: { id: intakeId },
        select: { id: true },
      });
      if (!intake) throw new FieldError(fieldErrors.choice(fieldLabel("intakeId")));
    }

    // One student cannot sit on the same programme twice.
    const existing = await prisma.enrollment.findFirst({
      where: { studentId, programId },
      select: { id: true },
    });
    if (existing) throw new FieldError(fieldErrors.duplicate(fieldLabel("programId")));

    await unique(fieldLabel("studentId"), () =>
      prisma.enrollment.create({
        data: {
          studentId,
          programId,
          intakeId: intakeId ?? null,
          cohort,
          campusId: scope.campusId ?? student.campusId,
          status: EnrollmentStatus.ACTIVE,
        },
      }),
    );
  });
}

export async function setEnrollmentStatus(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/enrollments", AFFECTED, async () => {
    const enrollmentId = hiddenId(formData, "enrollmentId", fieldLabel("studentId"));
    const status = enumField(formData, "status", STATUSES, statusLabel);

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId },
      include: { campus: { select: { id: true, name: true } } },
    });
    if (!enrollment || (scope.campusId !== null && enrollment.campusId !== scope.campusId)) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status,
        withdrawnAt: status === EnrollmentStatus.WITHDRAWN ? new Date() : null,
      },
    });
  });
}
