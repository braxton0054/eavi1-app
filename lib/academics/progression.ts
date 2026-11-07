/**
 * Where a student is in their own studies.
 *
 * The institution has one academic calendar (what the campus is open for, when holidays and
 * exams fall). Students do NOT all walk that calendar together: each one is admitted through
 * an intake, and their Semester 1 is the intake's first day. A January joiner and a May
 * joiner are both in Semester 1 at different calendar dates.
 *
 * Everything that needs "which semester is this student in" — fees, unit registration,
 * attachment eligibility, a student's profile — asks this module, never the calendar.
 */

export type IntakeAnchor = {
  id: string;
  name: string;
  /** Day one of this cohort's Semester 1. */
  startsAt: Date;
  year: number;
  month: number;
};

/** A period in a student's own programme: Year 1 · Semester 1, Year 1 · Semester 2, … */
export type AcademicPeriod = { yearIndex: number; semesterNo: number };

/**
 * How long one period of a programme runs. Programmes declare their own structure, so a
 * semester programme and a monthly one count differently; this is the fallback for the
 * common semester-based case.
 */
export const DEFAULT_PERIOD_MONTHS = 4;

const DAY_MS = 86_400_000;

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  // Clamp overflow: 31 January + 1 month is the last day of February, not 3 March.
  if (next.getDate() !== day) next.setDate(0);
  return next;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

/** The last day of a period that opened on `openedAt` and runs `monthsPerPeriod` months. */
export function periodEndsAt(openedAt: Date, monthsPerPeriod = DEFAULT_PERIOD_MONTHS): Date {
  return new Date(addMonths(startOfDay(openedAt), monthsPerPeriod).getTime() - DAY_MS);
}

/**
 * The day a given period of an intake begins. Period 1 begins on the intake's first day;
 * every later one follows it, so the walk never depends on the campus calendar.
 */
export function periodStartsAt(
  intake: Pick<IntakeAnchor, "startsAt">,
  period: AcademicPeriod,
  semestersPerYear = 3,
  monthsPerPeriod = DEFAULT_PERIOD_MONTHS,
): Date {
  const perYear = Math.max(1, semestersPerYear);
  const index = (period.yearIndex - 1) * perYear + (period.semesterNo - 1);
  return addMonths(startOfDay(intake.startsAt), index * monthsPerPeriod);
}

/**
 * Which period a student is in on `asOf`, counting from their intake. A student who has not
 * finished their programme's periods yet keeps the last one rather than running past the end.
 */
export function currentPeriod(
  intake: Pick<IntakeAnchor, "startsAt">,
  asOf: Date,
  options: { totalPeriods: number; semestersPerYear?: number; monthsPerPeriod?: number },
): AcademicPeriod {
  const perYear = Math.max(1, options.semestersPerYear ?? 3);
  const total = Math.max(1, options.totalPeriods);
  const day = startOfDay(asOf).getTime();
  const start = startOfDay(intake.startsAt).getTime();

  if (day < start) return { yearIndex: 1, semesterNo: 1 };

  const elapsed = (day - start) / DAY_MS;
  const monthsPerPeriod = Math.max(1, options.monthsPerPeriod ?? DEFAULT_PERIOD_MONTHS);
  const index = Math.min(total - 1, Math.floor(elapsed / (monthsPerPeriod * 30.4375)));

  return {
    yearIndex: Math.floor(index / perYear) + 1,
    semesterNo: (index % perYear) + 1,
  };
}

/** Flat position, so "has this student reached period X" is one comparison. */
export function periodIndex(period: AcademicPeriod, semestersPerYear = 3): number {
  const perYear = Math.max(1, semestersPerYear);
  return (period.yearIndex - 1) * perYear + (period.semesterNo - 1);
}

export function periodFromIndex(index: number, semestersPerYear = 3): AcademicPeriod {
  const perYear = Math.max(1, semestersPerYear);
  const safe = Math.max(0, index);
  return {
    yearIndex: Math.floor(safe / perYear) + 1,
    semesterNo: (safe % perYear) + 1,
  };
}

/** "Year 1 · Semester 2" — the label a student reads on their own record. */
export function periodLabel(period: AcademicPeriod): string {
  return `Year ${period.yearIndex} · Semester ${period.semesterNo}`;
}

/** The period after this one, for promotion. */
export function nextPeriod(period: AcademicPeriod, semestersPerYear = 3): AcademicPeriod {
  return periodFromIndex(periodIndex(period, semestersPerYear) + 1, semestersPerYear);
}
