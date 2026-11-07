"use server";

import { EnrollmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  enumField,
  hiddenId,
  nextInvoiceNumbers,
  onSave,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";

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

    const campusId = scope.campusId ?? student.campusId;

    // A second programme enrolment brings its own fee schedule, so the numbers are reserved
    // up front and the bills are written with the enrolment in one transaction.
    const plan = await activePlanFor(programId);
    const invoiceNumbers = await nextInvoiceNumbers(plan?.periods.length ?? 0);
    const intake = intakeId
      ? await prisma.intake.findUnique({ where: { id: intakeId }, select: { commenceAt: true } })
      : null;

    await prisma.$transaction(async (tx) => {
      const enrollment = await unique(fieldLabel("studentId"), () =>
        tx.enrollment.create({
          data: {
            studentId,
            programId,
            intakeId: intakeId ?? null,
            cohort,
            campusId,
            status: EnrollmentStatus.ACTIVE,
          },
          select: { id: true },
        }),
      );

      await generateFeeSchedule(tx, {
        studentId,
        enrollmentId: enrollment.id,
        campusId,
        programId,
        startDate: intake?.commenceAt ?? new Date(),
        numbers: invoiceNumbers,
      });
    });
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
