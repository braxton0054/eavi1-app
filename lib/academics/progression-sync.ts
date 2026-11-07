/**
 * Keeps a student's stored period in step with the calendar of their own intake.
 *
 * The stored `(yearIndex, semesterNo)` on an enrolment is the authoritative answer to "where
 * is this student", because fees, unit registration and attachment all read it. It is derived
 * from the intake, so time alone can move it: a student who joined in May is in their own
 * Semester 2 four months later without anybody clicking anything.
 *
 * This module reconciles the two. It is additive by design — a student is only ever moved
 * FORWARD to where their intake says they are, so an office decision to hold somebody back
 * (a repeated term, a resit) survives instead of being overwritten on the next read.
 */

import { prisma } from "@/lib/prisma";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";
import { nextInvoiceNumbers } from "@/lib/actions/college/_shared";
import {
  DEFAULT_PERIOD_MONTHS,
  currentPeriod,
  periodIndex,
  type AcademicPeriod,
} from "@/lib/academics/progression";

export type ProgressionSyncResult = {
  /** Enrolments examined. */
  checked: number;
  /** Enrolments whose period was moved forward. */
  advanced: number;
  /** Bills raised for periods a student has newly reached. */
  billed: number;
};

type Row = {
  id: string;
  programId: string;
  yearIndex: number;
  semesterNo: number;
  intake: { startsAt: Date };
};

/**
 * How many periods a programme runs, which is how far a student can progress before the
 * programme is finished. A semester programme of 24 months at three semesters a year has six.
 */
async function totalPeriodsFor(programIds: string[]): Promise<Map<string, number>> {
  const programs = await prisma.program.findMany({
    where: { id: { in: programIds } },
    select: { id: true, structure: true, durationMonths: true },
  });

  const perYearRows = await prisma.semester.findMany({
    select: { semesterNo: true },
    distinct: ["semesterNo"],
  });
  const perYear = Math.max(1, perYearRows.length || 3);

  const totals = new Map<string, number>();
  for (const program of programs) {
    const months = Math.max(1, program.durationMonths);
    const periods =
      program.structure === "MONTHLY"
        ? months
        : Math.max(1, Math.round((months / 12) * perYear));
    totals.set(program.id, periods);
  }
  return totals;
}

/**
 * Works out where one enrolment should be right now, without writing anything.
 * Exported so a screen can show the true position even before a sync has run.
 */
export function expectedPeriod(
  row: { yearIndex: number; semesterNo: number; intake: { startsAt: Date } },
  totalPeriods: number,
  options: { semestersPerYear?: number; monthsPerPeriod?: number; asOf?: Date } = {},
): AcademicPeriod {
  const derived = currentPeriod(row.intake, options.asOf ?? new Date(), {
    totalPeriods,
    semestersPerYear: options.semestersPerYear,
    monthsPerPeriod: options.monthsPerPeriod ?? DEFAULT_PERIOD_MONTHS,
  });

  const stored = { yearIndex: row.yearIndex, semesterNo: row.semesterNo };
  const semestersPerYear = options.semestersPerYear ?? 3;

  // Only ever forwards: an office that held a student back keeps that decision.
  return periodIndex(derived, semestersPerYear) > periodIndex(stored, semestersPerYear)
    ? derived
    : stored;
}

/**
 * Recomputes the period for every enrolment on a campus (or everywhere for a college-wide
 * administrator) and advances whichever ones time has moved on. Safe to call on read: it
 * writes nothing when nothing has changed.
 */
export async function syncProgression(campusId: number | null): Promise<ProgressionSyncResult> {
  const rows = await prisma.enrollment.findMany({
    where: {
      ...(campusId === null ? {} : { campusId }),
      status: { in: ["ACTIVE", "SUSPENDED"] },
    },
    select: {
      id: true,
      programId: true,
      yearIndex: true,
      semesterNo: true,
      intake: { select: { startsAt: true } },
    },
  });

  if (rows.length === 0) return { checked: 0, advanced: 0, billed: 0 };

  const totals = await totalPeriodsFor([...new Set(rows.map((row) => row.programId))]);
  const perYearRows = await prisma.semester.findMany({
    select: { semesterNo: true },
    distinct: ["semesterNo"],
  });
  const semestersPerYear = Math.max(1, perYearRows.length || 3);

  const moves = (rows as Row[])
    .map((row) => {
      const total = totals.get(row.programId) ?? 1;
      const next = expectedPeriod(row, total, { semestersPerYear });
      const moved =
        next.yearIndex !== row.yearIndex || next.semesterNo !== row.semesterNo;
      return moved ? { id: row.id, next } : null;
    })
    .filter((move): move is { id: string; next: AcademicPeriod } => move !== null);

  // Billing is decided by where each student ENDS UP, not by whether they moved on this
  // read. A student who is already in the right period can still be missing that period's
  // bill (an office reset, a crash between the two writes), and that must be repaired.
  const settled = (rows as Row[]).map((row) => {
    const total = totals.get(row.programId) ?? 1;
    return { id: row.id, next: expectedPeriod(row, total, { semestersPerYear }) };
  });

  // One statement per distinct destination keeps a whole cohort to a handful of writes.
  const byDestination = new Map<string, string[]>();
  for (const move of moves) {
    const key = `${move.next.yearIndex}:${move.next.semesterNo}`;
    const ids = byDestination.get(key) ?? [];
    ids.push(move.id);
    byDestination.set(key, ids);
  }

  let advanced = 0;
  for (const [key, ids] of byDestination) {
    const [yearIndex, semesterNo] = key.split(":").map(Number);
    const result = await prisma.enrollment.updateMany({
      where: { id: { in: ids } },
      data: { yearIndex, semesterNo },
    });
    advanced += result.count;
  }

  // A student who has moved into a new period is now liable for that period's fees, so the
  // bill is raised as they arrive rather than waiting for the office to notice.
  const billed = await billNewlyReachedPeriods(settled.map((row) => row.id));

  return { checked: rows.length, advanced, billed };
}

/**
 * Raises the bills for periods a student has just entered.
 *
 * `generateFeeSchedule` is already idempotent — it skips any period that has an invoice — so
 * this is the same call enrolment makes, run again later. Numbers are reserved before the
 * transaction opens, exactly as enrolment does, so a bill can never be written without one.
 */
async function billNewlyReachedPeriods(enrollmentIds: string[]): Promise<number> {
  if (enrollmentIds.length === 0) return 0;

  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds }, status: "ACTIVE" },
    select: {
      id: true,
      studentId: true,
      campusId: true,
      programId: true,
      yearIndex: true,
      semesterNo: true,
      intake: { select: { id: true, startsAt: true } },
    },
  });

  let billed = 0;
  for (const enrollment of enrollments) {
    const plan = await activePlanFor(enrollment.programId);
    const outstanding = plan?.periods.length ?? 0;
    if (outstanding === 0) continue;

    // Only periods up to the student's current one can need a bill, so only those numbers
    // are reserved.
    const reachable = plan!.periods.filter(
      (period) =>
        (period.yearIndex ?? 1) * 100 + (period.semesterNo ?? 1) <=
        enrollment.yearIndex * 100 + enrollment.semesterNo,
    ).length;
    if (reachable === 0) continue;

    const numbers = await nextInvoiceNumbers(reachable);

    billed += await prisma.$transaction(async (tx) => {
      const result = await generateFeeSchedule(tx, {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        campusId: enrollment.campusId,
        programId: enrollment.programId,
        startDate: enrollment.intake.startsAt,
        intakeId: enrollment.intake.id,
        // Only the period the student has reached is billed now; the rest keep as they
        // advance, so nobody owes for a semester they have not begun.
        upTo: { yearIndex: enrollment.yearIndex, semesterNo: enrollment.semesterNo },
        numbers,
      });
      return result.created;
    });
  }

  return billed;
}
