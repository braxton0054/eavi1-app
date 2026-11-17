import { prisma } from "@/lib/prisma";

/**
 * Reusable class IDs.
 *
 * A class is identified by its campus, programme, intake and name — the four things that
 * make two rows the same class. The database holds exactly that (the unique index on
 * those four columns), so this module is the one place that resolves a name to a class:
 * the admissions form, the classes screen and the merge/rename path all go through it.
 *
 * Two rules follow from "reusable":
 *
 * 1. The scope is the whole identity. A name that exists in another intake or on another
 *    campus is a *different* class and must never block this one — treating it as a
 *    collision is how a May joiner ends up in the January class.
 * 2. An archived class keeps its ID. When the same class runs again, the row is
 *    reactivated rather than a twin created: its memberships, its chat room and its audit
 *    history stay attached to the same class ID, which is the whole point of an ID.
 */

/** The four columns that make two class rows the same class. */
export type ClassIdentity = {
  campusId: number;
  programId: string;
  periodId: string;
  name: string;
};

export const classIdentity = (identity: ClassIdentity) => ({
  campusId: identity.campusId,
  programId: identity.programId,
  periodId: identity.periodId,
  name: identity.name,
});

/** How an existing class of that identity was handled. */
export type ClassReuseKind = "created" | "reused" | "reactivated";

export type ClassReuse = {
  id: string;
  name: string;
  campusId: number;
  reuse: ClassReuseKind;
};

/**
 * Finds the class of this identity or creates it, reactivating it when it was archived.
 *
 * Returns how it was resolved so the caller can audit the difference: creating a class and
 * bringing one back are different decisions and the log should say which happened.
 */
export async function resolveClassForName(
  input: ClassIdentity & { year: number; note?: string | null },
): Promise<ClassReuse> {
  const existing = await prisma.academicClass.findFirst({
    where: classIdentity(input),
    select: { id: true, name: true, campusId: true, status: true },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      return { id: existing.id, name: existing.name, campusId: existing.campusId, reuse: "reused" };
    }

    // Archived: the class runs again under the same ID.
    await prisma.academicClass.update({
      where: { id: existing.id },
      data: { status: "ACTIVE", archivedAt: null, ...(input.note ? { note: input.note } : {}) },
    });

    return { id: existing.id, name: existing.name, campusId: existing.campusId, reuse: "reactivated" };
  }

  const created = await prisma.academicClass.create({
    data: {
      campusId: input.campusId,
      programId: input.programId,
      periodId: input.periodId,
      year: input.year,
      name: input.name,
      note: input.note ?? null,
    },
    select: { id: true, name: true, campusId: true },
  });

  return { ...created, reuse: "created" };
}

/**
 * The class a rename would collide with, inside the same identity and not counting itself.
 *
 * Scoped the same way as creation: renaming "ICT/A" to a name used by another intake is
 * allowed, because that is another class.
 */
export async function renameClash(input: ClassIdentity & { id: string }) {
  return prisma.academicClass.findFirst({
    where: { ...classIdentity(input), id: { not: input.id } },
    select: { id: true, name: true },
  });
}
