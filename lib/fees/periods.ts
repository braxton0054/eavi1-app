/**
 * How a programme's fee splits into payable periods, and how those periods land on real
 * dates. Pure functions only: the fee editor runs this in the browser to draw the rows, and
 * enrolment runs the same code on the server to date the bills, so the two can never drift.
 */

export type FeeKind = "MONTHLY" | "SEMESTER" | "ACADEMIC_YEAR" | "ONE_TIME" | "CUSTOM";

/** A period as it is typed into the fee editor. Amounts stay strings until the action. */
export type PeriodDraft = {
  label: string;
  amount: string;
  yearIndex: number | null;
  semesterNo: number | null;
  dueOffsetDays: number;
};

/** A campus academic period, as the calendar stores it. */
export type CalendarPeriod = {
  id: string;
  year: number;
  /** 1, 5 or 9 — the intake month. */
  month: number;
  /** Which of the year's three periods this is. */
  sequence: number;
  name: string;
  startsAt: Date;
  endsAt: Date;
};

/** A period with the date and the calendar row it falls inside. */
export type ResolvedPeriod = PeriodDraft & {
  sequence: number;
  dueDate: Date;
  periodId: string | null;
  /**
   * The student's OWN year and semester for this period, counted from their intake. This is
   * what the bill is read against — not whichever calendar semester the due date happens in.
   */
  periodYear: number | null;
  periodSemester: number | null;
  periodLabel: string;
};

/** The college runs three semesters in a year unless the calendar says otherwise. */
export const DEFAULT_PERIODS_PER_YEAR = 3;

/** Guard rail: a fee form with more rows than this is a typo, not a schedule. */
const MAX_PERIODS = 60;

export function periodsPerYear(semestersPerYear?: number): number {
  const value = Math.round(Number(semestersPerYear));
  return Number.isFinite(value) && value >= 1 && value <= 4 ? value : DEFAULT_PERIODS_PER_YEAR;
}

/**
 * The semester/term count is read from the institution's calendar, not assumed: a college
 * that runs two semesters a year gets two rows per year, one that runs three gets three.
 */
export function periodCount(kind: FeeKind, durationMonths: number, semestersPerYear?: number): number {
  const months = Math.max(1, Math.round(Number(durationMonths) || 1));
  const perYear = periodsPerYear(semestersPerYear);

  switch (kind) {
    case "MONTHLY":
      return Math.min(MAX_PERIODS, months);
    case "SEMESTER":
      return Math.min(MAX_PERIODS, Math.max(1, Math.round((months / 12) * perYear)));
    case "ACADEMIC_YEAR":
      return Math.min(MAX_PERIODS, Math.max(1, Math.ceil(months / 12)));
    case "ONE_TIME":
      return 1;
    case "CUSTOM":
      return 0;
  }
}

function periodLabel(
  kind: FeeKind,
  index: number,
  perYear: number,
): { label: string; yearIndex: number | null; semesterNo: number | null } {
  switch (kind) {
    case "MONTHLY":
      return {
        label: `Month ${index + 1}`,
        yearIndex: Math.floor(index / 12) + 1,
        semesterNo: null,
      };
    case "SEMESTER": {
      const yearIndex = Math.floor(index / perYear) + 1;
      const semesterNo = (index % perYear) + 1;
      return { label: `Year ${yearIndex} · Semester ${semesterNo}`, yearIndex, semesterNo };
    }
    case "ACADEMIC_YEAR":
      return { label: `Year ${index + 1}`, yearIndex: index + 1, semesterNo: null };
    case "ONE_TIME":
      return { label: "Full programme fee", yearIndex: 1, semesterNo: null };
    case "CUSTOM":
      return { label: `Period ${index + 1}`, yearIndex: null, semesterNo: null };
  }
}

/** Days from the student's start, used as the fallback when the calendar has no row. */
function offsetDays(kind: FeeKind, index: number, perYear: number): number {
  switch (kind) {
    case "MONTHLY":
      return Math.round(index * 30.4375);
    case "SEMESTER":
      return Math.round((index / perYear) * 365);
    case "ACADEMIC_YEAR":
      return index * 365;
    case "ONE_TIME":
      return 0;
    case "CUSTOM":
      return 0;
  }
}

/**
 * Rows for a fresh schedule. `keep` carries the amounts already typed, so changing the
 * duration from six months to eight does not wipe the first six figures.
 */
export function generatePeriods(
  kind: FeeKind,
  durationMonths: number,
  semestersPerYear?: number,
  keep: readonly PeriodDraft[] = [],
): PeriodDraft[] {
  const perYear = periodsPerYear(semestersPerYear);

  if (kind === "CUSTOM") {
    // A custom schedule is whatever the administrator typed; regenerating it would lose it.
    return keep.length > 0 ? [...keep] : [periodLabelDraft("CUSTOM", 0, perYear)];
  }

  const count = periodCount(kind, durationMonths, perYear);
  return Array.from({ length: count }, (_, index) => {
    const meta = periodLabel(kind, index, perYear);
    return {
      ...meta,
      amount: keep[index]?.amount ?? "",
      dueOffsetDays: offsetDays(kind, index, perYear),
    };
  });
}

function periodLabelDraft(kind: FeeKind, index: number, perYear: number): PeriodDraft {
  const meta = periodLabel(kind, index, perYear);
  return { ...meta, amount: "", dueOffsetDays: offsetDays(kind, index, perYear) };
}

export function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  // Clamp overflow: 31 January + 1 month is the last day of February, not 3 March.
  if (next.getDate() < day) next.setDate(0);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setHours(0, 0, 0, 0);
  return next;
}

function semesterHolding(calendar: readonly CalendarPeriod[], date: Date): CalendarPeriod | null {
  const day = startOfDay(date).getTime();
  return (
    calendar.find(
      (period) => startOfDay(period.startsAt).getTime() <= day && day <= startOfDay(period.endsAt).getTime(),
    ) ?? null
  );
}

/**
 * Puts each period of a fee plan on a real date.
 *
 * Semester plans are dated from the STUDENT'S INTAKE, not from the campus calendar. A student
 * who joins in May is billed Semester 1 fees from May, and their Semester 2 follows four
 * months later — even though the campus calendar is running its own second semester then.
 * The calendar row is still recorded so a bill can be looked up against the term it falls
 * in, but it never decides where in their studies the student is.
 *
 * Anything that is not tied to a semester (monthly, yearly, one-off, custom) uses its own
 * offset from the intake date.
 */
export function resolvePeriods(
  kind: FeeKind,
  periods: readonly PeriodDraft[],
  startDate: Date,
  calendar: readonly CalendarPeriod[],
  semestersPerYear?: number,
): ResolvedPeriod[] {
  const perYear = periodsPerYear(semestersPerYear);
  const ordered = [...calendar].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const start = startOfDay(startDate);

  const calendarLinked = kind === "SEMESTER";

  return periods.map((period, index) => {
    const dueDate = calendarLinked
      ? // The student's own period N begins N periods after their intake's first day.
        addMonths(start, Math.round((index / perYear) * 12))
      : kind === "MONTHLY"
        ? addMonths(start, index)
        : kind === "ACADEMIC_YEAR"
          ? addMonths(start, index * 12)
          : kind === "ONE_TIME"
            ? start
            : addDays(start, period.dueOffsetDays);

    // Record which campus term the bill falls inside, for reading against the calendar.
    const covered = semesterHolding(ordered, dueDate);

    return {
      ...period,
      sequence: index + 1,
      dueDate,
      periodId: covered?.id ?? null,
      // The student's own position, straight off the plan.
      periodYear: period.yearIndex,
      periodSemester: period.semesterNo,
      periodLabel: period.label,
    };
  });
}

/** Total of the rows as typed; blank and malformed amounts count as zero. */
export function draftTotal(periods: readonly PeriodDraft[]): number {
  return periods.reduce((sum, period) => sum + amountValue(period.amount), 0);
}

export function amountValue(value: string | number | null | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
