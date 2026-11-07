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
import { registerEnrolmentUnits } from "@/lib/academics/registration";
import { nextPeriod } from "@/lib/academics/progression";

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
        archivedAt: null,
        ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
      },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    if (intakeId) {
      const intake = await prisma.intake.findUnique({
        where: { id: intakeId },
        select: { id: true, campusId: true },
      });
      if (!intake) throw new FieldError(fieldErrors.choice(fieldLabel("intakeId")));
      // A cohort belongs to one campus; a student cannot join another campus's intake.
      if (intake.campusId !== (scope.campusId ?? student.campusId)) {
        throw new FieldError(fieldErrors.notOnCampus);
      }
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
      ? await prisma.intake.findUnique({
          where: { id: intakeId },
          select: { id: true, startsAt: true },
        })
      : null;

    // Every student follows an intake's progression, so one is mandatory rather than optional.
    if (!intake) throw new FieldError(fieldErrors.choice(fieldLabel("intakeId")));

    await prisma.$transaction(async (tx) => {
      const enrollment = await unique(fieldLabel("studentId"), () =>
        tx.enrollment.create({
          data: {
            studentId,
            programId,
            intakeId: intake.id,
            cohort,
            campusId,
            // The student starts at their intake's first period, not wherever the campus
            // calendar happens to be.
            yearIndex: 1,
            semesterNo: 1,
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
        // Fees count from the intake's own Semester 1.
        startDate: intake.startsAt,
        intakeId: intake.id,
        numbers: invoiceNumbers,
      });

      await registerEnrolmentUnits(tx, {
        enrollmentId: enrollment.id,
        studentId,
        programId,
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

/**
 * Moves one student on to their next academic period.
 *
 * Progression normally advances on its own: a student's period is counted from their intake,
 * so when a semester's worth of time passes they are in the next one. This action exists for
 * the deliberate case — a resit held back, a term repeated, a cohort advanced early — and it
 * records when the office made the decision.
 */
export async function promoteEnrollment(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/enrollments", AFFECTED, async () => {
    const enrollmentId = hiddenId(formData, "enrollmentId", fieldLabel("studentId"));

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
      },
      select: {
        id: true,
        campusId: true,
        programId: true,
        yearIndex: true,
        semesterNo: true,
      },
    });
    if (!enrollment) throw new FieldError(fieldErrors.notOnCampus);

    // The campus calendar decides how many periods a year has, so the promotion uses the
    // same shape the student's own plan was built with.
    const calendar = await prisma.semester.findMany({
      where: { campusId: enrollment.campusId },
      select: { semesterNo: true },
    });
    const semestersPerYear = new Set(calendar.map((row) => row.semesterNo)).size || undefined;

    const next = nextPeriod(
      { yearIndex: enrollment.yearIndex, semesterNo: enrollment.semesterNo },
      semestersPerYear,
    );

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { yearIndex: next.yearIndex, semesterNo: next.semesterNo, promotedAt: new Date() },
    });
  });
}
