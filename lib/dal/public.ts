/**
 * Reads for the public site. They run with no session, so they only hand out what EAVI
 * already publishes: the courses an applicant can ask for and the campus that takes them.
 */

import { ApplicationStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/** Places one campus takes before the rotation moves to the next one. */
const PLACES_PER_CAMPUS = 5;

/** A refused or withdrawn applicant gives their place back, so they do not count. */
const TAKEN = [ApplicationStatus.SUBMITTED, ApplicationStatus.REVIEWING];

export type ApplyOptions = {
  programs: { value: string; label: string; minGrade: string | null }[];
};

/**
 * Only a course some campus that takes applicants actually teaches is on the list,
 * because every application is placed at one of those campuses.
 */
export async function getApplyOptions(): Promise<ApplyOptions> {
  const programs = await prisma.program.findMany({
    // An archived course keeps its students but must not collect new applications.
    where: { archivedAt: null, campuses: { some: { takesApplicants: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, minKcseGrade: true },
  });

  return {
    programs: programs.map((program) => ({
      value: program.id,
      label: `${program.name} (${program.code})`,
      minGrade: program.minKcseGrade,
    })),
  };
}

/**
 * The applicant never picks a location. The first campus that teaches the course and still
 * has a place takes them, so the two campuses fill side by side instead of one absorbing
 * the whole queue. When every one is full the round opens again at the least filled.
 */
export async function assignCampus(
  programId: string,
): Promise<{ id: number; name: string } | null> {
  const campuses = await prisma.campus.findMany({
    where: { takesApplicants: true, programs: { some: { id: programId, archivedAt: null } } },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (campuses.length === 0) return null;

  const counts = await prisma.application.groupBy({
    by: ["campusId"],
    where: { campusId: { in: campuses.map((campus) => campus.id) }, status: { in: TAKEN } },
    _count: { _all: true },
  });
  const taken = (id: number) =>
    counts.find((row) => row.campusId === id)?._count._all ?? 0;

  const chosen =
    campuses.find((campus) => taken(campus.id) < PLACES_PER_CAMPUS) ??
    campuses.reduce((least, campus) => (taken(campus.id) < taken(least.id) ? campus : least));

  return { id: chosen.id, name: chosen.name };
}
