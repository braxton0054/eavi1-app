/**
 * The one place that decides how many semesters a programme year has, so the unit planner and
 * the action that saves a placement always generate the same period keys.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_SEMESTERS_PER_YEAR } from "@/lib/academics/structure";

export async function planningSemesters(campusId: number | null): Promise<number> {
  const rows = await prisma.semester.findMany({
    where: campusId === null ? {} : { campusId },
    select: { campusId: true, semesterNo: true },
    distinct: ["campusId", "semesterNo"],
  });

  if (rows.length === 0) return DEFAULT_SEMESTERS_PER_YEAR;

  // The campus being worked in decides; college-wide falls back to the busiest calendar.
  const chosen = campusId === null ? rows : rows.filter((row) => row.campusId === campusId);
  const numbers = new Set(chosen.map((row) => row.semesterNo));
  return numbers.size >= 1 && numbers.size <= 4 ? numbers.size : DEFAULT_SEMESTERS_PER_YEAR;
}
