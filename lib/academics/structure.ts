/**
 * How a programme's delivery structure turns into academic periods.
 *
 * Semesters and months are generated from the programme's own duration; modules come from
 * the rows the administrator created; a custom structure names its own periods. The same
 * code draws the unit planner and decides where an attachment falls, so the screen can never
 * promise a stage the data does not know about.
 */

export type Structure = "SEMESTER" | "MONTHLY" | "MODULE" | "CUSTOM";

export type PeriodOption = {
  /** Stored on the unit placement; unique inside one programme. */
  key: string;
  label: string;
  yearIndex: number | null;
  semesterNo: number | null;
  monthIndex: number | null;
};

export const DEFAULT_SEMESTERS_PER_YEAR = 3;
const MAX_PERIODS = 60;

export function semestersPerYear(semesters?: readonly number[]): number {
  const distinct = new Set(semesters ?? []).size;
  return distinct >= 1 && distinct <= 4 ? distinct : DEFAULT_SEMESTERS_PER_YEAR;
}

/** Only the structures whose periods can be derived; modules and custom are explicit rows. */
export function generatedPeriods(
  structure: Structure,
  durationMonths: number,
  perYear = DEFAULT_SEMESTERS_PER_YEAR,
): PeriodOption[] {
  const months = Math.max(1, Math.round(Number(durationMonths) || 1));

  if (structure === "SEMESTER") {
    const count = Math.min(MAX_PERIODS, Math.max(1, Math.round((months / 12) * perYear)));
    return Array.from({ length: count }, (_, index) => {
      const yearIndex = Math.floor(index / perYear) + 1;
      const semesterNo = (index % perYear) + 1;
      return {
        key: `Y${yearIndex}S${semesterNo}`,
        label: `Year ${yearIndex} · Semester ${semesterNo}`,
        yearIndex,
        semesterNo,
        monthIndex: null,
      };
    });
  }

  if (structure === "MONTHLY") {
    const count = Math.min(MAX_PERIODS, months);
    return Array.from({ length: count }, (_, index) => ({
      key: `M${index + 1}`,
      label: `Month ${index + 1}`,
      yearIndex: Math.floor(index / 12) + 1,
      semesterNo: null,
      monthIndex: index + 1,
    }));
  }

  return [];
}

/** "Year 1 · Semester 2" -> "Y1S2", "Month 3" -> "M3"; used for free-typed custom periods. */
export function customPeriodKey(label: string): string {
  return `CUSTOM:${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

/* ------------------------------------------------------------------ attachments */

export type Trigger =
  | { kind: "ALL" }
  | { kind: "SEMESTER"; yearIndex: number; semesterNo: number }
  | { kind: "MONTH"; monthIndex: number };

/**
 * The "when" value posted by the attachment form. Encoding and decoding live together so a
 * tampered value can only ever name a period the programme really has.
 */
export function triggerValue(period: PeriodOption): string {
  if (period.monthIndex !== null) return `M:${period.monthIndex}`;
  return `S:${period.yearIndex}:${period.semesterNo}`;
}

export function parseTrigger(value: string | null, periods: readonly PeriodOption[]): Trigger | null {
  if (!value) return null;
  if (value === "ALL") return { kind: "ALL" };

  const match = /^S:(\d+):(\d+)$/.exec(value);
  if (match) {
    const yearIndex = Number(match[1]);
    const semesterNo = Number(match[2]);
    const known = periods.some(
      (period) => period.yearIndex === yearIndex && period.semesterNo === semesterNo,
    );
    return known ? { kind: "SEMESTER", yearIndex, semesterNo } : null;
  }

  const month = /^M:(\d+)$/.exec(value);
  if (month) {
    const monthIndex = Number(month[1]);
    return periods.some((period) => period.monthIndex === monthIndex)
      ? { kind: "MONTH", monthIndex }
      : null;
  }

  return null;
}

/** Human wording for a requirement row, e.g. "After Year 1 · Semester 3". */
export function describeTrigger(requirement: {
  afterAllPeriods: boolean;
  afterYearIndex: number | null;
  afterSemesterNo: number | null;
  afterMonthIndex: number | null;
}): string {
  if (requirement.afterAllPeriods) return "After all academic periods";
  if (requirement.afterMonthIndex !== null) return `After Month ${requirement.afterMonthIndex}`;
  if (requirement.afterYearIndex !== null && requirement.afterSemesterNo !== null) {
    return `After Year ${requirement.afterYearIndex} · Semester ${requirement.afterSemesterNo}`;
  }
  return "Stage not set";
}

/* --------------------------------------------------------------------- progress */

export type PlacedUnit = {
  id: string;
  yearIndex: number | null;
  semesterNo: number | null;
  monthIndex: number | null;
};

export type UnitStanding = "NOT_STARTED" | "REGISTERED" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "DEFERRED";

/**
 * Whether a stage has been finished. Only `COMPLETED` units count; a failed or deferred unit
 * keeps the stage open, which is what stops a student drifting into attachment eligibility.
 */
export function stageCompleted(
  units: readonly PlacedUnit[],
  statusByUnit: ReadonlyMap<string, UnitStanding>,
  trigger: Trigger,
): boolean {
  const covered = units.filter((unit) => {
    if (trigger.kind === "ALL") return true;
    if (trigger.kind === "MONTH") {
      return unit.monthIndex !== null && unit.monthIndex <= trigger.monthIndex;
    }
    if (unit.yearIndex === null || unit.semesterNo === null) return false;
    return (
      unit.yearIndex < trigger.yearIndex ||
      (unit.yearIndex === trigger.yearIndex && unit.semesterNo <= trigger.semesterNo)
    );
  });

  if (covered.length === 0) return false;
  return covered.every((unit) => statusByUnit.get(unit.id) === "COMPLETED");
}

/** Reading order for periods: year, then semester/month, then the planner sequence. */
export function periodSortKey(unit: {
  yearIndex: number | null;
  semesterNo: number | null;
  monthIndex: number | null;
}): number {
  const year = unit.yearIndex ?? 0;
  const within = unit.semesterNo ?? unit.monthIndex ?? 0;
  return year * 100 + within;
}
