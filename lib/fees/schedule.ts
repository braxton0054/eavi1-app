/**
 * Turns a programme's published fee plan into a student's bills.
 *
 * Every payable period becomes an ordinary invoice with one line, dated from the campus
 * academic calendar where the period is tied to one. Nothing here invents a second ledger:
 * payments, balances and statements keep running through the accounts module.
 */

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolvePeriods,
  type CalendarPeriod,
  type FeeKind,
  type PeriodDraft,
} from "@/lib/fees/periods";

const money = (value: unknown) => Number(String(value ?? 0)) || 0;

export type ActivePlan = {
  id: string;
  version: number;
  totalAmount: unknown;
  kind: FeeKind;
  periods: { id: string; label: string; amount: unknown; yearIndex: number | null; semesterNo: number | null; dueOffsetDays: number | null }[];
};

type Reader = Pick<Prisma.TransactionClient, "programFeePlan" | "semester">;

/** The one published version of a programme's fees, or null when none is set up yet. */
export async function activePlanFor(programId: string, reader: Reader = prisma): Promise<ActivePlan | null> {
  const plan = await reader.programFeePlan.findFirst({
    where: { programId, isActive: true },
    include: {
      cadence: { select: { kind: true } },
      periods: {
        orderBy: { sequence: "asc" },
        select: { id: true, label: true, amount: true, yearIndex: true, semesterNo: true, dueOffsetDays: true },
      },
    },
  });
  if (!plan) return null;

  return {
    id: plan.id,
    version: plan.version,
    totalAmount: plan.totalAmount,
    kind: plan.cadence.kind as FeeKind,
    periods: plan.periods,
  };
}

/** The campus calendar rows a plan is dated against. */
async function calendarFor(reader: Reader, campusId: number): Promise<CalendarPeriod[]> {
  return reader.semester.findMany({
    where: { campusId },
    orderBy: { startDate: "asc" },
    select: { id: true, year: true, semesterNo: true, name: true, startDate: true, endDate: true },
  });
}

export type FeeScheduleResult = {
  planId: string | null;
  version: number | null;
  created: number;
  total: number;
  /** Periods that were already billed, left exactly as they were. */
  skipped: number;
};

/**
 * Bills every period of the active plan that the enrolment does not already owe.
 *
 * Runs inside the caller's transaction, so a student and their schedule are committed
 * together. Re-running it is safe: an existing bill for the same period is never rewritten,
 * which is also what keeps an old student's agreed amount when fees are repriced.
 */
export async function generateFeeSchedule(
  tx: Prisma.TransactionClient,
  input: {
    studentId: string;
    enrollmentId: string;
    campusId: number;
    programId: string;
    /** When the student starts: their intake date, or the day they were enrolled. */
    startDate: Date;
    /** Invoice numbers reserved before the transaction opened, one per period. */
    numbers: string[];
  },
): Promise<FeeScheduleResult> {
  const plan = await activePlanFor(input.programId, tx);
  if (!plan || plan.periods.length === 0) {
    return { planId: null, version: null, created: 0, total: 0, skipped: 0 };
  }

  const calendar = await calendarFor(tx, input.campusId);
  const semestersPerYear = new Set(calendar.map((row) => row.semesterNo)).size || undefined;

  const drafts: PeriodDraft[] = plan.periods.map((period) => ({
    label: period.label,
    amount: String(money(period.amount)),
    yearIndex: period.yearIndex,
    semesterNo: period.semesterNo,
    dueOffsetDays: period.dueOffsetDays ?? 0,
  }));

  const resolved = resolvePeriods(plan.kind, drafts, input.startDate, calendar, semestersPerYear);

  const existing = await tx.invoice.findMany({
    where: { enrollmentId: input.enrollmentId },
    select: { feePeriodId: true },
  });
  const billed = new Set(existing.map((row) => row.feePeriodId).filter((id): id is string => Boolean(id)));

  let created = 0;
  let skipped = 0;

  for (const period of resolved) {
    const feePeriodId = plan.periods[period.sequence - 1]?.id;
    if (!feePeriodId) continue;
    if (billed.has(feePeriodId)) {
      skipped += 1;
      continue;
    }

    const number = input.numbers[created];
    if (!number) throw new Error("No invoice number was reserved for this fee period.");

    await tx.invoice.create({
      data: {
        number,
        studentId: input.studentId,
        campusId: input.campusId,
        programId: input.programId,
        enrollmentId: input.enrollmentId,
        feePlanId: plan.id,
        feePeriodId,
        periodYear: period.periodYear,
        periodSemester: period.periodSemester,
        semesterId: period.semesterId,
        dueAt: period.dueDate,
        status: "OPEN",
        note: `Fees v${plan.version} · ${period.periodLabel}`,
        lines: {
          create: [{ label: period.periodLabel, amount: money(period.amount) }],
        },
      },
    });
    created += 1;
  }

  return {
    planId: plan.id,
    version: plan.version,
    created,
    total: money(plan.totalAmount),
    skipped,
  };
}
