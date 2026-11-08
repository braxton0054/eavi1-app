import { ConversationType, MemberRole, PostingMode } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * Class group chats.
 *
 * A class is a grouping, so its chat is not a separate thing an office creates — it is a view of
 * the class. This file keeps that true by deriving membership from the class itself:
 *
 *   - **Students** come from `ClassMembership` rows that have not been closed.
 *   - **Tutors** come from `ClassTutor`, which is the only definition of "responsible for it".
 *
 * Nothing else grants entry. A room is therefore never visible to someone outside the class, and
 * it cannot drift out of step with the roster, because it is recomputed from the roster.
 *
 * The sync is additive and idempotent: it adds people who should be there and closes the ones who
 * should not. It never deletes a membership row, so read positions and mute state survive a
 * student moving out and back again.
 */

const ROLE_FOR: Record<string, MemberRole> = {
  student: MemberRole.MEMBER,
  tutor: MemberRole.MEMBER,
  admin: MemberRole.ADMIN,
};

export type ClassRoomSync = { conversationId: string; added: number; removed: number };

/**
 * Finds or creates the room for a class.
 *
 * `classId` is unique on `Conversation`, so a class can never end up with two rooms even if two
 * requests race — the loser of the race loses on the index and reads the winner's row.
 */
export async function ensureClassConversation(classId: string): Promise<string> {
  const academicClass = await prisma.academicClass.findUnique({
    where: { id: classId },
    select: { id: true, name: true, program: { select: { name: true } } },
  });
  if (!academicClass) throw new Error(`Unknown class ${classId}`);

  const existing = await prisma.conversation.findUnique({
    where: { classId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const title = academicClass.name;

  try {
    const created = await prisma.conversation.create({
      data: {
        type: ConversationType.CLASS,
        classId,
        title,
        /*
         * Everyone in a class may talk. A staff-only room is a deliberate choice the office makes
         * later, not the default: a class group exists so students can ask questions.
         */
        postingMode: PostingMode.ALL_MEMBERS,
      },
      select: { id: true },
    });
    return created.id;
  } catch {
    // Lost a race to another request; its row is the one that exists.
    const row = await prisma.conversation.findUnique({ where: { classId }, select: { id: true } });
    if (!row) throw new Error(`Could not create a room for class ${classId}`);
    return row.id;
  }
}

/**
 * Recomputes who belongs in a class room.
 *
 * Safe to call after any change to the class, and cheap enough to call from the places that make
 * those changes: enrolment, class moves, merges, tutor assignment and archiving.
 */
export async function syncClassConversation(classId: string): Promise<ClassRoomSync> {
  const conversationId = await ensureClassConversation(classId);

  const [students, tutors] = await Promise.all([
    prisma.classMembership.findMany({
      where: { classId, leftAt: null },
      select: { enrollment: { select: { student: { select: { userId: true } } } } },
    }),
    prisma.classTutor.findMany({
      where: { classId },
      select: { tutor: { select: { userId: true } } },
    }),
  ]);

  const shouldBeIn = new Map<string, MemberRole>();
  for (const row of students) {
    const userId = row.enrollment?.student?.userId;
    if (userId) shouldBeIn.set(userId, ROLE_FOR.student);
  }
  for (const row of tutors) {
    const userId = row.tutor?.userId;
    if (userId) shouldBeIn.set(userId, ROLE_FOR.tutor);
  }

  const current = await prisma.conversationMember.findMany({
    where: { conversationId },
    select: { id: true, userId: true, leftAt: true },
  });

  let added = 0;
  let removed = 0;

  for (const [userId, role] of shouldBeIn) {
    const row = current.find((member) => member.userId === userId);
    if (row && row.leftAt === null) continue;

    if (row) {
      // Coming back: reopen the existing row so their read position is still theirs.
      await prisma.conversationMember.update({
        where: { id: row.id },
        data: { leftAt: null, role },
      });
    } else {
      await prisma.conversationMember.create({ data: { conversationId, userId, role } });
    }
    added += 1;
  }

  for (const row of current) {
    if (shouldBeIn.has(row.userId) || row.leftAt !== null) continue;
    /*
     * Closed rather than deleted. They lose access — every read path filters on `leftAt` — but
     * their history of the conversation stays coherent if they are moved back.
     */
    await prisma.conversationMember.update({ where: { id: row.id }, data: { leftAt: new Date() } });
    removed += 1;
  }

  return { conversationId, added, removed };
}

/**
 * Whether a person may see a class room at all.
 *
 * A student must be in the class; a tutor must be assigned to it; an administrator must be at the
 * campus that runs it. This is the check the requirement asks for by name — a class group is not
 * visible to people outside the class.
 */
export async function maySeeClassRoom(
  viewer: { id: string; role: string; campusId: number | null },
  classId: string,
): Promise<boolean> {
  const academicClass = await prisma.academicClass.findUnique({
    where: { id: classId },
    select: { campusId: true },
  });
  if (!academicClass) return false;

  if (viewer.role === "SUPER_ADMIN") return true;
  if (viewer.role === "ADMIN") return viewer.campusId === null || viewer.campusId === academicClass.campusId;

  if (viewer.role === "TUTOR") {
    const assigned = await prisma.classTutor.findFirst({
      where: { classId, tutor: { userId: viewer.id } },
      select: { id: true },
    });
    return Boolean(assigned);
  }

  const student = await prisma.classMembership.findFirst({
    where: { classId, leftAt: null, enrollment: { student: { userId: viewer.id } } },
    select: { id: true },
  });
  return Boolean(student);
}

/**
 * Recomputes every class room in a campus. Used by the seed and by the verification script, which
 * cannot wait for a real enrolment to touch each class one at a time.
 */
export async function syncAllClassConversations(campusId?: number): Promise<ClassRoomSync[]> {
  const classes = await prisma.academicClass.findMany({
    where: { status: "ACTIVE", ...(campusId ? { campusId } : {}) },
    select: { id: true },
  });

  const results: ClassRoomSync[] = [];
  for (const row of classes) {
    results.push(await syncClassConversation(row.id));
  }
  return results;
}
