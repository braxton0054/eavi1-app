import { prisma } from "@/lib/prisma";
import type { EntryGrade } from "@/generated/prisma/enums";

/**
 * Whether an applicant's KCSE grade meets a programme's minimum.
 *
 * The enum is declared best-first (A … E), so the *index* is the ranking: a lower index is a better
 * grade. Comparing the ordinals rather than the letters means the rule lives in one place and a new
 * grade slot added to the enum is ordered by where it is declared, not by a second list that could
 * drift out of step with it.
 *
 * Kenyan KCSE grades are not evenly spaced — the step from C+ to B- is not the same distance as
 * D to D- — but for a minimum entry requirement what matters is only which side of the line an
 * applicant falls on, and the declared order answers that exactly.
 */
const ORDER: EntryGrade[] = [
  "A",
  "A_MINUS",
  "B_PLUS",
  "B",
  "B_MINUS",
  "C_PLUS",
  "C",
  "C_MINUS",
  "D_PLUS",
  "D",
  "D_MINUS",
  "E",
];

/** How a grade reads on a page. `C_MINUS` is `C-`, not `C MINUS`. */
export function gradeLabel(grade: EntryGrade): string {
  return grade.replace("_PLUS", "+").replace("_MINUS", "-");
}

/** Rank of a grade, best grade first. Unknown values sort last rather than throwing. */
export function gradeRank(grade: EntryGrade): number {
  const index = ORDER.indexOf(grade);
  return index === -1 ? ORDER.length : index;
}

/**
 * True when the applicant's grade is at least as good as the programme requires.
 *
 * A better grade always passes; an equal grade passes, because a minimum is inclusive — a course
 * asking for C admits a C.
 */
export function meetsMinimum(applicant: EntryGrade, minimum: EntryGrade): boolean {
  return gradeRank(applicant) <= gradeRank(minimum);
}

export type EligibleProgram = {
  /** Needed to select it again without asking the applicant to hunt through the list. */
  id: string;
  /** How the programme is offered, so the applicant can tell a diploma from a certificate. */
  name: string;
  minGrade: EntryGrade;
  /** True when their grade clears this programme's minimum. */
  meets: boolean;
  /** True when this is the programme they picked. */
  selected: boolean;
};

export type GradeCheck = {
  /** Programmes the applicant qualifies for, best requirement first. */
  eligible: EligibleProgram[];
  /** Programmes they do not qualify for, so the shortfall is visible rather than hidden. */
  ineligible: EligibleProgram[];
};

/**
 * Compares an applicant's grade against every programme currently taking applicants.
 *
 * Only programmes with at least one campus that accepts applications are listed: suggesting a
 * programme nobody teaches would send the applicant to a dead end.
 */
export async function checkGrade(grade: EntryGrade, selectedProgramId: string): Promise<GradeCheck> {
  const programmes = await prisma.program.findMany({
    where: {
      archivedAt: null,
      campuses: { some: { takesApplicants: true } },
    },
    select: { id: true, name: true, minKcseGrade: true },
    orderBy: [{ minKcseGrade: "asc" }, { name: "asc" }],
  });

  const eligible: EligibleProgram[] = [];
  const ineligible: EligibleProgram[] = [];

  for (const programme of programmes) {
    const entry: EligibleProgram = {
      id: programme.id,
      name: programme.name,
      minGrade: programme.minKcseGrade,
      meets: meetsMinimum(grade, programme.minKcseGrade),
      selected: programme.id === selectedProgramId,
    };
    (entry.meets ? eligible : ineligible).push(entry);
  }

  return { eligible, ineligible };
}

/**
 * The minimum grade that would open the most programmes to this applicant.
 *
 * Used to phrase the refusal: telling an applicant "you need C+" is actionable, while a bare "not
 * eligible" leaves them to guess what to do next.
 */
export function nextGradeUp(grade: EntryGrade): EntryGrade | null {
  const rank = gradeRank(grade);
  return rank === 0 ? null : ORDER[rank - 1];
}
