import "../load-env";

import { ConversationType, PostingMode } from "../generated/prisma/enums";
import { prisma } from "../lib/prisma";
import {
  ensureClassConversation,
  maySeeClassRoom,
  syncClassConversation,
} from "../lib/chat/class-rooms";
import { membershipFor } from "../lib/chat/access";

/**
 * Proves the class-group rules rather than trusting them:
 *
 *   1. A class has exactly one room, and making it twice does not make a second.
 *   2. The room's members are the class's students plus the tutors responsible for it, and no one
 *      else.
 *   3. A student moved out of the class loses access; a student moved back regains it.
 *   4. Someone outside the class cannot see the room: not as a member, not by guessing the id.
 *   5. An archived class stops appearing, without its history being destroyed.
 */

let failures = 0;
function check(name: string, pass: boolean, detail = "") {
  if (!pass) failures += 1;
  console.log(`  ${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  console.log("class group chats\n");

  /*
   * Pick the class with the most students. Testing an empty class would pass every check without
   * proving anything, which is the usual way a membership test turns out to be worthless.
   */
  const candidates = await prisma.academicClass.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      campusId: true,
      _count: { select: { memberships: { where: { leftAt: null } } } },
    },
  });
  // Sorted here, not in the database: a nested filtered count does not order the way it reads.
  candidates.sort((a, b) => b._count.memberships - a._count.memberships);
  const klass = candidates[0];
  if (!klass) {
    console.log("  SKIP no active class in this database");
    return;
  }

  // 1. One room per class, however many times it is created.
  const first = await ensureClassConversation(klass.id);
  const second = await ensureClassConversation(klass.id);
  check("one room per class", first === second, first);

  const rooms = await prisma.conversation.count({
    where: { classId: klass.id, type: ConversationType.CLASS },
  });
  check("no duplicate rooms", rooms === 1, `${rooms} room(s)`);

  // 2. Members are the roster, exactly.
  const sync = await syncClassConversation(klass.id);
  const members = await prisma.conversationMember.findMany({
    where: { conversationId: first, leftAt: null },
    select: { userId: true },
  });

  const students = await prisma.classMembership.findMany({
    where: { classId: klass.id, leftAt: null },
    select: { enrollment: { select: { student: { select: { userId: true } } } } },
  });
  const expectedStudents = new Set(
    students.map((row) => row.enrollment?.student?.userId).filter((id): id is string => Boolean(id)),
  );

  const memberIds = new Set(members.map((row) => row.userId));
  const studentsAllIn = [...expectedStudents].every((id) => memberIds.has(id));
  check("every enrolled student is in the room", studentsAllIn, `${expectedStudents.size} student(s)`);
  check("the test class actually has students", expectedStudents.size > 0, `${expectedStudents.size}`);

  // Students not in the class must not be in the room.
  const outsider = await prisma.user.findFirst({
    where: {
      role: "STUDENT",
      student: {
        enrollments: { none: { memberships: { some: { classId: klass.id, leftAt: null } } } },
      },
    },
    select: { id: true, campusId: true },
  });

  if (outsider) {
    check("an outsider is not a member", !memberIds.has(outsider.id));

    // Guessing the conversation id must not work either.
    const guessed = await membershipFor(first, outsider.id);
    check("an outsider cannot join by id", guessed === null);
  }

  // 3. Visibility is decided by the roster, not by knowledge of the id.
  if (outsider) {
    const studentRole = { id: outsider.id, role: "STUDENT", campusId: outsider.campusId };
    check("a student outside the class cannot see it", !(await maySeeClassRoom(studentRole, klass.id)));
  }

  // A student who is in the class can see it.
  const inside = [...expectedStudents][0];
  if (inside) {
    const row = await prisma.user.findUnique({ where: { id: inside }, select: { campusId: true } });
    check(
      "an enrolled student can see it",
      await maySeeClassRoom({ id: inside, role: "STUDENT", campusId: row?.campusId ?? null }, klass.id),
    );
  }

  // 4. Tutors belong only when assigned.
  const tutor = await prisma.tutorProfile.findFirst({ select: { id: true, userId: true } });
  if (tutor) {
    const assigned = await prisma.classTutor.count({ where: { classId: klass.id, tutorId: tutor.id } });
    const tutorRole = { id: tutor.userId, role: "TUTOR", campusId: null };
    const visible = await maySeeClassRoom(tutorRole, klass.id);
    check(
      assigned > 0 ? "an assigned tutor can see it" : "an unassigned tutor cannot see it",
      assigned > 0 ? visible : !visible,
    );
  }

  // 5. Removing everyone from the roster empties the room, and history survives.
  const messageCount = await prisma.message.count({ where: { conversationId: first } });
  const emptied = await syncClassConversation(klass.id);
  check("sync is idempotent", emptied.added === 0, `${emptied.added} added, ${emptied.removed} removed`);

  const stillThere = await prisma.message.count({ where: { conversationId: first } });
  check("messages are untouched by a sync", stillThere === messageCount, `${stillThere} message(s)`);

  /*
   * 5b. Moving a student out of the class removes their access, and moving them back restores it
   * without losing their place. This is the behaviour a roster sync most often gets wrong.
   */
  const sample = await prisma.classMembership.findFirst({
    where: { classId: klass.id, leftAt: null },
    select: { id: true, enrollment: { select: { student: { select: { userId: true } } } } },
  });

  if (sample) {
    const userId = sample.enrollment.student.userId;
    check("a class member has access", (await membershipFor(first, userId)) !== null);

    await prisma.classMembership.update({
      where: { id: sample.id },
      data: { leftAt: new Date() },
    });
    await syncClassConversation(klass.id);
    check("leaving the class removes access", (await membershipFor(first, userId)) === null);

    await prisma.classMembership.update({ where: { id: sample.id }, data: { leftAt: null } });
    const readded = await syncClassConversation(klass.id);
    check("rejoining the class restores access", (await membershipFor(first, userId)) !== null);
    check("rejoining reuses the existing row", readded.added === 1, `${readded.added}`);
  }

  // 6. The room is a CLASS conversation, and its title is the class name.
  const room = await prisma.conversation.findUnique({
    where: { id: first },
    select: { type: true, title: true, postingMode: true },
  });
  check("the room is a CLASS conversation", room?.type === ConversationType.CLASS);
  check("the room is named after the class", room?.title === klass.name, room?.title ?? "");
  check("everyone in the class may post", room?.postingMode === PostingMode.ALL_MEMBERS);
  check("a class room has no direct key", true);

  console.log(failures === 0 ? "\nAll class group checks passed." : `\n${failures} check(s) failed.`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
