"use server";

import { AttachmentStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  numberField,
  onSave,
  requiredText,
  text,
} from "@/lib/actions/college/_shared";
import { generatedPeriods, parseTrigger, type Structure } from "@/lib/academics/structure";
import { planningSemesters } from "@/lib/academics/planning";
import { syncAttachments } from "@/lib/academics/registration";

const copy = pages.programs.attachments;

const STATUSES = Object.keys(AttachmentStatus) as (keyof typeof AttachmentStatus)[];

const affected = (programId: string, studentId?: string) => [
  "/dashboard/programs",
  `/dashboard/programs/${programId}`,
  `/dashboard/programs/${programId}/attachment`,
  "/dashboard/students",
  studentId ? `/dashboard/students/${studentId}` : "",
].filter(Boolean);

async function scopedProgram(programId: string, campusId: number | null) {
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      ...(campusId === null ? {} : { campuses: { some: { id: campusId } } }),
    },
    select: { id: true, structure: true, durationMonths: true, archivedAt: true },
  });
  if (!program) throw new FieldError(fieldErrors.notOnCampus);
  return program;
}

/**
 * Adds one attachment stage to a programme. The stage is stored as data (after year 1
 * semester 3, after month 6, or after everything), never as a hard-coded semester number, so
 * it follows the programme's own structure. Students already enrolled get a record at once.
 */
export async function saveAttachmentRequirement(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/attachment`, affected(programId), async () => {
    const program = await scopedProgram(programId, scope.campusId);
    if (program.archivedAt) throw new FieldError(copy.archived);

    const perYear = await planningSemesters();
    const periods = generatedPeriods(program.structure as Structure, program.durationMonths, perYear);
    const trigger = parseTrigger(text(formData, "trigger"), periods);
    if (!trigger) throw new FieldError(copy.triggerRequired);

    const label = requiredText(formData, "label", copy.label);

    await prisma.$transaction(async (tx) => {
      const last = await tx.attachmentRequirement.findFirst({
        where: { programId: program.id },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });

      const requirement = await tx.attachmentRequirement.create({
        data: {
          programId: program.id,
          sequence: (last?.sequence ?? 0) + 1,
          label,
          afterAllPeriods: trigger.kind === "ALL",
          afterYearIndex: trigger.kind === "SEMESTER" ? trigger.yearIndex : null,
          afterSemesterNo: trigger.kind === "SEMESTER" ? trigger.semesterNo : null,
          afterMonthIndex: trigger.kind === "MONTH" ? trigger.monthIndex : null,
          durationWeeks: numberField(formData, "durationWeeks", copy.durationWeeks),
          durationMonths: numberField(formData, "durationMonths", copy.durationMonths),
          startsAt: dateField(formData, "startsAt"),
          endsAt: dateField(formData, "endsAt"),
          prerequisiteNote: text(formData, "prerequisiteNote"),
          assessmentNote: text(formData, "assessmentNote"),
        },
        select: { id: true },
      });

      // Everyone already on the programme is tracked from this moment.
      const enrollments = await tx.enrollment.findMany({
        where: { programId: program.id, status: "ACTIVE" },
        select: { id: true, studentId: true },
      });

      if (enrollments.length > 0) {
        await tx.studentAttachment.createMany({
          data: enrollments.map((enrollment) => ({
            studentId: enrollment.studentId,
            enrollmentId: enrollment.id,
            requirementId: requirement.id,
            status: "NOT_ELIGIBLE" as const,
          })),
          skipDuplicates: true,
        });

        for (const enrollment of enrollments) {
          await syncAttachments(tx, enrollment.id);
        }
      }
    });
  });
}

export async function removeAttachmentRequirement(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/attachment`, affected(programId), async () => {
    await scopedProgram(programId, scope.campusId);
    const requirementId = hiddenId(formData, "requirementId", copy.title);

    const requirement = await prisma.attachmentRequirement.findFirst({
      where: { id: requirementId, programId },
      select: { id: true, _count: { select: { studentAttachments: true } } },
    });
    if (!requirement) throw new FieldError(fieldErrors.notOnCampus);
    if (requirement._count.studentAttachments > 0) throw new FieldError(copy.removeBlocked);

    await prisma.attachmentRequirement.delete({ where: { id: requirement.id } });
  });
}

/** Records one student's placement: where they went, who supervised them, and the outcome. */
export async function recordStudentAttachment(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const attachmentId = hiddenId(formData, "attachmentId", copy.title);

  const row = await prisma.studentAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      enrollmentId: true,
      student: { select: { id: true, campusId: true } },
      requirement: { select: { programId: true } },
    },
  });
  if (!row || (scope.campusId !== null && row.student.campusId !== scope.campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }

  const studentPath = `/dashboard/students/${row.student.id}`;

  return onSave(studentPath, affected(row.requirement.programId), async () => {
    const status = enumField(formData, "status", STATUSES, copy.status);

    await prisma.studentAttachment.update({
      where: { id: row.id },
      data: {
        status,
        hostOrganization: text(formData, "hostOrganization"),
        supervisorName: text(formData, "supervisorName"),
        supervisorPhone: text(formData, "supervisorPhone"),
        supervisorEmail: text(formData, "supervisorEmail"),
        startDate: dateField(formData, "startDate"),
        expectedEndDate: dateField(formData, "expectedEndDate"),
        completedAt:
          status === "COMPLETED"
            ? dateField(formData, "completedAt") ?? new Date()
            : dateField(formData, "completedAt"),
        grade: text(formData, "grade"),
        assessmentNote: text(formData, "assessmentNote"),
        remark: text(formData, "remark"),
      },
    });
  });
}
