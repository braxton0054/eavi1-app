/**
 * Teaching classes.
 *
 * A class is a GROUPING of students, not an academic position. Two students in ICT/JAN/2027
 * can be in Semester 1 and Semester 3 at the same time; the class only decides who sits
 * together for scheduling, marks and reporting. Everything about where a student is in their
 * programme lives on their enrolment (yearIndex / semesterNo) and is never derived from the
 * class they happen to belong to.
 *
 * EAVI runs exactly three intakes a year — January, May and September — while admissions
 * happen in any month. A student admitted in February still belongs to the January intake, so
 * the intake window and the admission date are recorded separately and neither overwrites
 * the other.
 */

import type { OfficialIntake } from "@/generated/prisma/enums";

/** The only months a student may be placed into. Order matters: it drives the pickers. */
export const OFFICIAL_INTAKES = [
  { month: 1, value: "JANUARY" as const, name: "January", short: "JAN", label: "January intake" },
  { month: 5, value: "MAY" as const, name: "May", short: "MAY", label: "May intake" },
  { month: 9, value: "SEPTEMBER" as const, name: "September", short: "SEPT", label: "September intake" },
] as const;

export type OfficialIntakeValue = (typeof OFFICIAL_INTAKES)[number]["value"];

export const OFFICIAL_INTAKE_VALUES: OfficialIntakeValue[] = OFFICIAL_INTAKES.map((i) => i.value);

/** The three months above and nothing else — February is an admission date, not an intake. */
export function isOfficialIntakeMonth(month: number): boolean {
  return OFFICIAL_INTAKES.some((intake) => intake.month === month);
}

/** Which official intake a calendar date belongs to, for placing a late admission. */
export function officialIntakeForDate(date: Date): OfficialIntakeValue {
  const month = date.getMonth() + 1;
  if (month <= 4) return "JANUARY";
  if (month <= 8) return "MAY";
  return "SEPTEMBER";
}

export function intakeMeta(value: OfficialIntakeValue) {
  const found = OFFICIAL_INTAKES.find((intake) => intake.value === value);
  // The enum and the list are checked against each other in tests; this keeps the type honest.
  return found ?? OFFICIAL_INTAKES[0];
}

export function intakeShort(value: OfficialIntakeValue): string {
  return intakeMeta(value).short;
}

export function intakeLabel(value: OfficialIntakeValue): string {
  return intakeMeta(value).label;
}

/**
 * The one name an intake can have, from the date it starts.
 *
 * Three intakes a year, each fixed to a month, so the month and the year are the whole identity:
 * "May intake 2026". Deriving it means the list can never hold both "May 2026" and "May intake
 * 2026" for the same window, and nobody has to retype what the date already says. The month is
 * read from the date rather than passed in, so the name cannot drift from the start date.
 */
export function intakeDefaultName(startsAt: Date): string {
  const month = startsAt.getMonth() + 1;
  const meta = intakeMeta(intakeValueForMonth(month));
  return `${meta.name} intake ${startsAt.getFullYear()}`;
}

/** The enum value for a stored intake month, e.g. 5 becomes "MAY". */
export function intakeValueForMonth(month: number): OfficialIntakeValue {
  const found = OFFICIAL_INTAKES.find((intake) => intake.month === month);
  if (!found) {
    throw new Error(`Month ${month} is not an official intake month.`);
  }
  return found.value;
}

/**
 * A suggested class name following the college convention, e.g. "ICT/JAN/2027". The office
 * may use any name it likes — this only fills the field in for them.
 */
export function suggestClassName(
  programCode: string,
  intake: OfficialIntakeValue,
  year: number,
  letter?: string,
): string {
  const code = programCode.trim().toUpperCase().slice(0, 6);
  const base = `${code}/${intakeShort(intake)}`;
  // The letter splits one intake of one programme into several teaching groups: A is the main
  // class, B takes the late joiners. Omitting it gives the name a single-group intake uses.
  return letter ? `${base}/${letter.toUpperCase()}/${year}` : `${base}/${year}`;
}

/**
 * The class letters, in the order a college adds them.
 *
 * A is the main class; B onwards are opened when more students arrive under the same intake than
 * one group can hold, or when they join after teaching has started. I and O are left out because
 * they read as one and zero on a register.
 */
export const CLASS_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");

/**
 * The next free class letter for an intake, so the office is offered "C" when A and B are taken
 * rather than being left to invent one.
 *
 * Letters already used are read from the class names, which is the only place the letter exists —
 * a class's name is the office's own convention and the letter is part of that name. Returns null
 * when the alphabet runs out, which means somebody should look at the intake rather than that the
 * system should pick a fourth character scheme on its own.
 */
export function nextClassLetter(existingNames: string[]): string | null {
  const used = new Set<string>();
  for (const name of existingNames) {
    // Matches the letter segment of ICT/JAN/A/2026 style names, in any position.
    for (const part of name.split("/")) {
      const cleaned = part.trim().toUpperCase();
      if (cleaned.length === 1 && CLASS_LETTERS.includes(cleaned)) used.add(cleaned);
    }
  }
  return CLASS_LETTERS.find((letter) => !used.has(letter)) ?? null;
}

/**
 * Whether a name reads as a class of the given intake, which is what the merge screen uses to
 * tell a viable target from an unrelated class. Purely advisory: compatibility is enforced by
 * programme and campus, not by spelling.
 */
export function nameMentionsIntake(name: string, intake: OfficialIntakeValue): boolean {
  const short = intakeShort(intake).toUpperCase();
  return name.toUpperCase().includes(short);
}

/** Trim, collapse whitespace and upper-case the code part but leave the office's wording. */
export function normaliseClassName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** A student's academic position, independent of any class. */
export type Placement = { yearIndex: number; semesterNo: number };

export function placementLabel(placement: Placement, structure?: string | null): string {
  const unit = structure === "MODULE" ? "Module" : structure === "MONTHLY" ? "Month" : "Semester";
  return `Year ${placement.yearIndex} · ${unit} ${placement.semesterNo}`;
}

/**
 * Why a merge cannot go ahead. Compatibility is about the academic structure — two classes
 * from different programmes or campuses cannot be one class, however similarly they are
 * named. Returned as a list so the screen can show every problem at once.
 */
export type MergeBlockage = { code: string; message: string };

export type ClassShape = {
  id: string;
  name: string;
  programId: string;
  campusId: number;
  intakeId: string;
  intakeMonth: OfficialIntake | string;
  year: number;
  status: string;
};

export function mergeBlockages(source: ClassShape, target: ClassShape): MergeBlockage[] {
  const blockers: MergeBlockage[] = [];

  if (source.id === target.id) {
    blockers.push({ code: "same", message: "A class cannot be merged into itself." });
    return blockers;
  }
  if (source.campusId !== target.campusId) {
    blockers.push({
      code: "campus",
      message: "These classes belong to different campuses, so their students, fees and results cannot share one class.",
    });
  }
  if (source.programId !== target.programId) {
    blockers.push({
      code: "programme",
      message: "These classes are for different programmes, so their units and results are not comparable.",
    });
  }
  if (source.year !== target.year) {
    blockers.push({
      code: "year",
      message: "These classes are for different academic years.",
    });
  }
  if (source.intakeMonth !== target.intakeMonth) {
    blockers.push({
      code: "intake",
      message:
        "These classes are for different official intakes. Students keep their own intake, but a class reports on one intake, so a September class cannot absorb a January one.",
    });
  }
  if (target.status !== "ACTIVE") {
    blockers.push({
      code: "target-archived",
      message: "The destination class is archived. Reopen it before merging students into it.",
    });
  }

  return blockers;
}

/**
 * What a merge will do, worked out before anything is written so the office can confirm it.
 * Deliberately includes what is NOT touched, because that is the thing people worry about.
 */
export type MergePreview = {
  source: ClassShape;
  target: ClassShape;
  blockers: MergeBlockage[];
  students: number;
  /** Students already in the target — they are not duplicated, only kept once. */
  alreadyInTarget: number;
  /** Currently open memberships that will move. */
  activeMemberships: number;
  /** Past memberships that stay exactly where they are. */
  historicalMemberships: number;
  placements: { placement: string; students: number }[];
  notices: string[];
};

export function describeMerge(preview: MergePreview): string {
  if (preview.blockers.length > 0) return "Cannot merge";
  if (preview.students === 0) return `Move no students from ${preview.source.name}`;
  const noun = preview.students === 1 ? "student" : "students";
  return `Move ${preview.students} ${noun} from ${preview.source.name} into ${preview.target.name}`;
}

/**
 * The placement summary for a preview: how many students sit at each stage. A class holding
 * several stages is normal and is never flattened by the merge.
 */
export function summarisePlacements(rows: Placement[]): { placement: string; students: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.yearIndex}:${row.semesterNo}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, students]) => {
      const [yearIndex, semesterNo] = key.split(":").map(Number);
      return { placement: `Year ${yearIndex} · Semester ${semesterNo}`, students, yearIndex };
    })
    .sort((a, b) => a.yearIndex - b.yearIndex || a.placement.localeCompare(b.placement))
    .map(({ placement, students }) => ({ placement, students }));
}
