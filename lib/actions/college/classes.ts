"use server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import { FieldError, onSave, requiredText, text } from "@/lib/actions/college/_shared";
import { intakeValueForMonth, mergeBlockages, normaliseClassName } from "@/lib/academics/classes";
import { recordAudit } from "@/lib/academics/audit";
import { redirect } from "next/navigation";
import { refresh } from "@/lib/actions/college/_shared";
import { syncClassConversation } from "@/lib/chat/class-rooms";

const AFFECTED = ["/dashboard/classes", "/dashboard/students", "/dashboard/enrollments", "/dashboard"];

/**
 * Create a class. The intake is what fixes the intake month, so a class can never advertise a
 * window its intake does not have, and the year comes from the intake rather than the wall
 * clock — a class for the January 2027 intake is a 2027 class even when created in December.
 */
export async function createClass(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const programId = requiredText(formData, "programId", pages.classes.fields.program);
    const intakeId = requiredText(formData, "intakeId", pages.classes.fields.intake);
    const name = normaliseClassName(requiredText(formData, "name", pages.classes.fields.name));
    const note = text(formData, "note");

    const [program, intake] = await Promise.all([
      prisma.program.findFirst({
        where: { id: programId, archivedAt: null, campuses: { some: { id: campusId } } },
        select: { id: true, code: true },
      }),
      prisma.academicPeriod.findFirst({
        where: { id: intakeId, campusId },
        select: { id: true, month: true, year: true, name: true },
      }),
    ]);
    if (!program) throw new FieldError(fieldErrors.notOnCampus);
    if (!intake) throw new FieldError(fieldErrors.notOnCampus);

    // A month outside the three windows would be an intake nobody can be placed in. The
    // database enforces the same rule, but the message here can say why.
    let intakeMonth;
    try {
      intakeMonth = intakeValueForMonth(intake.month);
    } catch {
      throw new FieldError(pages.classes.officialMonthsOnly);
    }

    const clash = await prisma.academicClass.findFirst({
      where: { programId, periodId: intake.id, name },
      select: { id: true },
    });
    if (clash) throw new FieldError(pages.classes.nameTaken);

    const created = await prisma.academicClass.create({
      data: {
        campusId,
        programId,
        periodId: intake.id,
        year: intake.year,
        name,
        note,
      },
    });

    await recordAudit({
      campusId,
      actorId: scope.userId,
      actorEmail: scope.email,
      action: "class.create",
      entityType: "class",
      entityId: created.id,
      detail: { name, program: program.code, intakeMonth, year: intake.year, period: intake.name },
    });

    /*
     * The class group is not a separate thing to make: a class is a grouping, so its room is
     * derived from the roster. Creating the class creates the room.
     */
    await syncClassConversation(created.id).catch(() => null);

    refresh(...AFFECTED);
    redirect(`/dashboard/classes/${created.id}`);
  });
}

/** Rename or re-note a class. The programme, campus and intake are deliberately fixed. */
export async function updateClass(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const id = requiredText(formData, "id", "Class");
    const name = normaliseClassName(requiredText(formData, "name", pages.classes.fields.name));
    const note = text(formData, "note");

    const existing = await prisma.academicClass.findFirst({
      where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, name: true, programId: true, campusId: true },
    });
    if (!existing) throw new FieldError(fieldErrors.notOnCampus);

    const clash = await prisma.academicClass.findFirst({
      where: { programId: existing.programId, name, id: { not: id } },
      select: { id: true },
    });
    if (clash) throw new FieldError(pages.classes.nameTaken);

    await prisma.academicClass.update({ where: { id }, data: { name, note } });
    await recordAudit({
      campusId: existing.campusId,
      actorId: scope.userId,
      actorEmail: scope.email,
      action: "class.update",
      entityType: "class",
      entityId: id,
      detail: { from: existing.name, to: name },
    });

    refresh(...AFFECTED);
  });
}

/**
 * Archive a class. Archiving never deletes students, marks, invoices or membership history:
 * the class stops taking new placements and the students keep everything they had.
 */
export async function archiveClass(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const id = requiredText(formData, "id", "Class");

    const existing = await prisma.academicClass.findFirst({
      where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, name: true, campusId: true, _count: { select: { memberships: true } } },
    });
    if (!existing) throw new FieldError(fieldErrors.notOnCampus);

    const open = await prisma.classMembership.count({ where: { classId: id, leftAt: null } });
    if (open > 0) throw new FieldError(pages.classes.archiveWithStudents);

    await prisma.academicClass.update({
      where: { id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

    /*
     * An archived class has no open members, so the sync closes the room's membership too: the
     * group stops appearing in everyone's chat list, while its history stays in the database.
     */
    await syncClassConversation(id).catch(() => null);
    await recordAudit({
      campusId: existing.campusId,
      actorId: scope.userId,
      actorEmail: scope.email,
      action: "class.archive",
      entityType: "class",
      entityId: id,
      detail: { name: existing.name, memberships: existing._count.memberships },
    });

    refresh(...AFFECTED);
  });
}

/** Reopen an archived class so students can be placed in it again. */
export async function reopenClass(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const id = requiredText(formData, "id", "Class");
    const existing = await prisma.academicClass.findFirst({
      where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, name: true, campusId: true },
    });
    if (!existing) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.academicClass.update({
      where: { id },
      data: { status: "ACTIVE", archivedAt: null },
    });
    await recordAudit({
      campusId: existing.campusId,
      actorId: scope.userId,
      actorEmail: scope.email,
      action: "class.reopen",
      entityType: "class",
      entityId: id,
      detail: { name: existing.name },
    });

    refresh(...AFFECTED);
  });
}

/**
 * Merge one class into another.
 *
 * Only the GROUPING moves. The students keep their own academic stage, intake, admission date,
 * unit registrations, marks, results, attachments, invoices and payments — the merge writes
 * nothing but the membership rows and the audit trail. Membership is closed and reopened
 * rather than overwritten so the register can still be read as it stood before the merge, and
 * a student who is already in the destination is never given a second open membership.
 */
export async function mergeClasses(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const sourceId = requiredText(formData, "sourceId", "Class to merge");
    const targetId = requiredText(formData, "targetId", "Destination class");
    const confirmed = text(formData, "confirm");

    const campusFilter = scope.campusId === null ? {} : { campusId: scope.campusId };
    const [source, target] = await Promise.all([
      prisma.academicClass.findFirst({ where: { id: sourceId, ...campusFilter } }),
      prisma.academicClass.findFirst({ where: { id: targetId, ...campusFilter } }),
    ]);
    if (!source || !target) throw new FieldError(fieldErrors.notOnCampus);

    const blockers = mergeBlockages(source, target);
    if (blockers.length > 0) throw new FieldError(blockers[0].message);
    if (confirmed !== "yes") throw new FieldError(pages.classes.confirmRequired);

    // Everything is decided before the transaction opens, so the write is short and cannot
    // fail halfway on a read.
    const openMemberships = await prisma.classMembership.findMany({
      where: { classId: source.id, leftAt: null },
      select: {
        id: true,
        enrollmentId: true,
        enrollment: { select: { yearIndex: true, semesterNo: true, periodId: true } },
      },
    });
    const targetMemberships = await prisma.classMembership.findMany({
      where: { classId: target.id, leftAt: null },
      select: { enrollmentId: true },
    });
    const alreadyInTarget = new Set(targetMemberships.map((row) => row.enrollmentId));

    const moving = openMemberships.filter((row) => !alreadyInTarget.has(row.enrollmentId));
    const duplicates = openMemberships.length - moving.length;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Close the superseded memberships, then open the new ones. The old rows stay as history.
      if (openMemberships.length > 0) {
        await tx.classMembership.updateMany({
          where: { id: { in: openMemberships.map((row) => row.id) } },
          data: { leftAt: now, reason: `merged into ${target.name}`, actorId: scope.userId },
        });
      }

      if (moving.length > 0) {
        await tx.classMembership.createMany({
          data: moving.map((row) => ({
            classId: target.id,
            enrollmentId: row.enrollmentId,
            campusId: target.campusId,
            reason: `merged from ${source.name}`,
            actorId: scope.userId,
          })),
        });
      }

      // The source is deliberately left ACTIVE and emptied rather than archived: the office
      // decides what becomes of it once the students have gone.
      await recordAudit(
        {
          campusId: target.campusId,
          actorId: scope.userId,
          actorEmail: scope.email,
          action: "class.merge",
          entityType: "class",
          entityId: target.id,
          detail: {
            source: { id: source.id, name: source.name },
            target: { id: target.id, name: target.name },
            moved: moving.length,
            alreadyPresent: duplicates,
            placements: moving.map((row) => `Y${row.enrollment.yearIndex}S${row.enrollment.semesterNo}`),
          },
        },
        tx as never,
      );
    });

    // Students moved, so both rooms are recomputed: one gains, the other loses.
    await syncClassConversation(target.id).catch(() => null);
    await syncClassConversation(source.id).catch(() => null);

    refresh(...AFFECTED);
    redirect(`/dashboard/classes/${target.id}?merged=1`);
  });
}

/**
 * Move one student to another class, or change their academic stage.
 *
 * The two are separate on purpose: a class is a grouping and a stage is academic progress, so
 * either can change without the other. Neither touches fees.
 */
export async function moveStudent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/classes", AFFECTED, async () => {
    const enrollmentId = requiredText(formData, "enrollmentId", "Student");
    const targetClassId = text(formData, "classId");
    const stage = text(formData, "stage");

    const enrollment = await prisma.enrollment.findFirst({
      where: { id: enrollmentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: {
        id: true,
        campusId: true,
        yearIndex: true,
        semesterNo: true,
        programId: true,
        memberships: { where: { leftAt: null }, select: { id: true, classId: true } },
      },
    });
    if (!enrollment) throw new FieldError(fieldErrors.notOnCampus);

    if (targetClassId) {
      const target = await prisma.academicClass.findFirst({
        where: {
          id: targetClassId,
          status: "ACTIVE",
          ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
        },
        select: { id: true, name: true, programId: true, campusId: true },
      });
      if (!target) throw new FieldError(fieldErrors.choice("Class"));
      if (target.programId !== enrollment.programId) throw new FieldError(pages.classes.wrongProgramme);

      const current = enrollment.memberships[0];
      if (current?.classId !== target.id) {
        await prisma.$transaction(async (tx) => {
          if (current) {
            await tx.classMembership.update({
              where: { id: current.id },
              data: { leftAt: new Date(), reason: "moved to another class", actorId: scope.userId },
            });
          }
          await tx.classMembership.create({
            data: {
              classId: target.id,
              enrollmentId: enrollment.id,
              campusId: target.campusId,
              reason: "moved from another class",
              actorId: scope.userId,
            },
          });
          await recordAudit(
            {
              campusId: target.campusId,
              actorId: scope.userId,
              actorEmail: scope.email,
              action: "enrollment.class",
              entityType: "enrollment",
              entityId: enrollment.id,
              detail: { to: target.name },
            },
            tx as never,
          );
        });

        /*
         * The student left one class and joined another, so both group chats change hands.
         * Syncing here keeps the rooms honest without anyone editing chat by hand.
         */
        await syncClassConversation(target.id).catch(() => null);
        if (current?.classId) await syncClassConversation(current.classId).catch(() => null);
      }
    }

    if (stage) {
      const [yearRaw, semesterRaw] = stage.split(":");
      const yearIndex = Number(yearRaw);
      const semesterNo = Number(semesterRaw);
      if (!Number.isInteger(yearIndex) || !Number.isInteger(semesterNo) || yearIndex < 1 || semesterNo < 1) {
        throw new FieldError(fieldErrors.choice(pages.classes.fields.stage));
      }
      if (yearIndex !== enrollment.yearIndex || semesterNo !== enrollment.semesterNo) {
        await prisma.$transaction(async (tx) => {
          // Only the stage moves. Invoices, units and results are untouched by design.
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { yearIndex, semesterNo, promotedAt: new Date() },
          });
          await recordAudit(
            {
              campusId: enrollment.campusId,
              actorId: scope.userId,
              actorEmail: scope.email,
              action: "enrollment.place",
              entityType: "enrollment",
              entityId: enrollment.id,
              detail: {
                from: `Y${enrollment.yearIndex}S${enrollment.semesterNo}`,
                to: `Y${yearIndex}S${semesterNo}`,
              },
            },
            tx as never,
          );
        });
      }
    }

    refresh(...AFFECTED);
  });
}
