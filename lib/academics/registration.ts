/**
 * Registration and progress at unit level.
 *
 * A student is given every unit of their programme when they enrol, so the profile can show
 * what is behind and ahead. Only the first period starts registered; later periods are opened
 * by an administrator, and earlier periods must be completed first unless that administrator
 * overrides. Attachment eligibility is derived from completed units, never from a date alone.
 */

import type { Prisma } from "@/generated/prisma/client";
import type { UnitStatus } from "@/generated/prisma/enums";
import {
  periodSortKey,
  stageCompleted,
  type PlacedUnit,
  type Trigger,
} from "@/lib/academics/structure";

type Tx = Prisma.TransactionClient;

const placements = {
  id: true,
  periodKey: true,
  periodLabel: true,
  yearIndex: true,
  semesterNo: true,
  monthIndex: true,
  sequence: true,
} as const;

/**
 * Called inside the enrolment transaction. Every unit is recorded, the first period is
 * registered, and one attachment record is opened per active requirement.
 */
export async function registerEnrolmentUnits(
  tx: Tx,
  input: { enrollmentId: string; studentId: string; programId: string },
): Promise<{ units: number; attachments: number }> {
  const units = await tx.programUnit.findMany({
    where: { programId: input.programId },
    orderBy: [{ yearIndex: "asc" }, { semesterNo: "asc" }, { monthIndex: "asc" }, { sequence: "asc" }],
    select: placements,
  });

  if (units.length > 0) {
    await tx.studentUnit.createMany({
      data: units.map((unit) => ({
        enrollmentId: input.enrollmentId,
        programUnitId: unit.id,
        status: "NOT_STARTED" as const,
      })),
      skipDuplicates: true,
    });

    const ordered = [...units].sort(
      (a, b) => periodSortKey(a) - periodSortKey(b) || a.sequence - b.sequence,
    );
    const first = ordered[0];
    if (first) {
      await tx.studentUnit.updateMany({
        where: {
          enrollmentId: input.enrollmentId,
          programUnit: { periodKey: first.periodKey },
        },
        data: { status: "REGISTERED", registeredAt: new Date() },
      });
    }
  }

  const requirements = await tx.attachmentRequirement.findMany({
    where: { programId: input.programId, isActive: true },
    select: { id: true },
  });

  if (requirements.length > 0) {
    await tx.studentAttachment.createMany({
      data: requirements.map((requirement) => ({
        studentId: input.studentId,
        enrollmentId: input.enrollmentId,
        requirementId: requirement.id,
        status: "NOT_ELIGIBLE" as const,
      })),
      skipDuplicates: true,
    });
  }

  return { units: units.length, attachments: requirements.length };
}

export type RegistrationOutcome =
  | { ok: true; registered: number }
  | { ok: false; reason: "missing" | "unknown-period" }
  | { ok: false; reason: "outstanding"; outstanding: number };

/**
 * Opens one period for a student. Without the override, every unit in an earlier period has
 * to be completed first, so progression is an explicit, auditable decision.
 */
export async function registerPeriod(
  tx: Tx,
  input: { enrollmentId: string; periodKey: string; override: boolean },
): Promise<RegistrationOutcome> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: input.enrollmentId },
    select: { id: true, programId: true },
  });
  if (!enrollment) return { ok: false, reason: "missing" };

  const units = await tx.programUnit.findMany({
    where: { programId: enrollment.programId },
    select: { id: true, periodKey: true, yearIndex: true, semesterNo: true, monthIndex: true },
  });

  const target = units.filter((unit) => unit.periodKey === input.periodKey);
  if (target.length === 0) return { ok: false, reason: "unknown-period" };

  if (!input.override) {
    const stage = Math.min(...target.map((unit) => periodSortKey(unit)));
    const earlier = units.filter((unit) => periodSortKey(unit) < stage);
    if (earlier.length > 0) {
      const completed = await tx.studentUnit.count({
        where: {
          enrollmentId: enrollment.id,
          programUnitId: { in: earlier.map((unit) => unit.id) },
          status: "COMPLETED",
        },
      });
      if (completed < earlier.length) {
        return { ok: false, reason: "outstanding", outstanding: earlier.length - completed };
      }
    }
  }

  const result = await tx.studentUnit.updateMany({
    where: {
      enrollmentId: enrollment.id,
      programUnitId: { in: target.map((unit) => unit.id) },
      status: { in: ["NOT_STARTED", "DEFERRED"] },
    },
    data: { status: "REGISTERED", registeredAt: new Date() },
  });

  return { ok: true, registered: result.count };
}

/** Records one unit result and re-checks whether that unlocked an attachment stage. */
export async function recordUnitResult(
  tx: Tx,
  input: {
    studentUnitId: string;
    status: UnitStatus;
    score: number | null;
    maxScore: number | null;
    grade: string | null;
    remark: string | null;
  },
): Promise<{ enrollmentId: string; eligible: number } | null> {
  const row = await tx.studentUnit.findUnique({
    where: { id: input.studentUnitId },
    select: { id: true, enrollmentId: true },
  });
  if (!row) return null;

  await tx.studentUnit.update({
    where: { id: row.id },
    data: {
      status: input.status,
      score: input.score,
      maxScore: input.maxScore,
      grade: input.grade,
      remark: input.remark,
      completedAt: input.status === "COMPLETED" ? new Date() : null,
    },
  });

  const eligible = await syncAttachments(tx, row.enrollmentId);
  return { enrollmentId: row.enrollmentId, eligible };
}

function triggerOf(requirement: {
  afterAllPeriods: boolean;
  afterYearIndex: number | null;
  afterSemesterNo: number | null;
  afterMonthIndex: number | null;
}): Trigger {
  if (requirement.afterAllPeriods) return { kind: "ALL" };
  if (requirement.afterMonthIndex !== null) {
    return { kind: "MONTH", monthIndex: requirement.afterMonthIndex };
  }
  return {
    kind: "SEMESTER",
    yearIndex: requirement.afterYearIndex ?? 0,
    semesterNo: requirement.afterSemesterNo ?? 0,
  };
}

/**
 * Brings a student's attachment records up to date: opens any that were added after they
 * enrolled, then promotes to ELIGIBLE the stages whose units are all completed. A record that
 * has moved on is never pushed back.
 */
export async function syncAttachments(tx: Tx, enrollmentId: string): Promise<number> {
  const enrollment = await tx.enrollment.findUnique({
    where: { id: enrollmentId },
    select: { id: true, studentId: true, programId: true },
  });
  if (!enrollment) return 0;

  const requirements = await tx.attachmentRequirement.findMany({
    where: { programId: enrollment.programId, isActive: true },
    select: {
      id: true,
      afterAllPeriods: true,
      afterYearIndex: true,
      afterSemesterNo: true,
      afterMonthIndex: true,
    },
  });

  if (requirements.length === 0) return 0;

  await tx.studentAttachment.createMany({
    data: requirements.map((requirement) => ({
      studentId: enrollment.studentId,
      enrollmentId: enrollment.id,
      requirementId: requirement.id,
      status: "NOT_ELIGIBLE" as const,
    })),
    skipDuplicates: true,
  });

  const [units, standings, attachments] = await Promise.all([
    tx.programUnit.findMany({
      where: { programId: enrollment.programId },
      select: { id: true, periodKey: true, yearIndex: true, semesterNo: true, monthIndex: true },
    }),
    tx.studentUnit.findMany({
      where: { enrollmentId: enrollment.id },
      select: { programUnitId: true, status: true },
    }),
    tx.studentAttachment.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, requirementId: true, status: true },
    }),
  ]);

  const statusByUnit = new Map<string, UnitStatus>(
    standings.map((row) => [row.programUnitId, row.status]),
  );
  const placed: PlacedUnit[] = units;

  let promoted = 0;
  for (const attachment of attachments) {
    if (attachment.status !== "NOT_ELIGIBLE") continue;
    const requirement = requirements.find((row) => row.id === attachment.requirementId);
    if (!requirement) continue;

    if (stageCompleted(placed, statusByUnit, triggerOf(requirement))) {
      await tx.studentAttachment.update({
        where: { id: attachment.id },
        data: { status: "ELIGIBLE" },
      });
      promoted += 1;
    }
  }

  return promoted;
}
