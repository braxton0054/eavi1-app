/**
 * The one place that decides how many semesters a programme year has, so the unit planner and
 * the action that saves a placement always generate the same period keys.
 */

import { prisma } from "@/lib/prisma";
import { DEFAULT_SEMESTERS_PER_YEAR } from "@/lib/academics/structure";

export async function planningSemesters(): Promise<number> {
  const rows = await prisma.academicPeriod.findMany({
    select: { sequence: true },
    distinct: ["sequence"],
  });

  if (rows.length === 0) return DEFAULT_SEMESTERS_PER_YEAR;

  const numbers = new Set(rows.map((row) => row.sequence));
  return numbers.size >= 1 && numbers.size <= 4 ? numbers.size : DEFAULT_SEMESTERS_PER_YEAR;
}
