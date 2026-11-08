import { Prisma } from "@/generated/prisma/client";
import { Role, Status } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { chatProfiles, directKeyFor, type ChatProfile } from "@/lib/chat/profile";
import { blockSetsFor, ChatError, isStaff, type ChatUser } from "@/lib/chat/access";
import { limitNewDirectChats } from "@/lib/chat/rate-limit";
import { describePresence, isOnline, lastActivityFor } from "@/lib/chat/presence";

/**
 * Contacts and conversations.
 *
 * The one rule that shapes this file: nothing personal crosses the wire except a name, a
 * thumbnail and a role. Names are searched, admission numbers never are.
 */

export const PAGE_SIZE = 30;
export const MAX_BODY = 2000;

export type ContactRow = ChatProfile & {
  /** Only present when two people share a name exactly, so the row can say which campus. */
  campusHint?: string;
};

/**
 * Every reachable person, excluding the viewer and anyone in a block relationship with them.
 *
 * "Random" order is seeded per session so that paging is stable: the same seed produces the
 * same order for the whole visit, and the cursor is a position in that order rather than an
 * offset into a re-shuffled table. That is what stops a scroller from seeing someone twice or
 * missing them entirely.
 */
export async function listContacts(
  viewerId: string,
  options: {
    search?: string;
    role?: "admin" | "tutor" | "student";
    order?: "random" | "az";
    seed?: number;
    cursor?: number;
    limit?: number;
  },
): Promise<{ rows: ContactRow[]; nextCursor: number | null }> {
  const limit = Math.min(options.limit ?? PAGE_SIZE, 100);
  const cursor = options.cursor ?? 0;
  const search = options.search?.trim() ?? "";

  const { blockedByMe, blockedMe } = await blockSetsFor(viewerId);
  const excluded = [...new Set([viewerId, ...blockedByMe, ...blockedMe])];

  const roleFilter: Role[] | undefined =
    options.role === "admin"
      ? [Role.SUPERADMIN, Role.CAMPUS_ADMIN]
      : options.role === "tutor"
        ? [Role.TUTOR]
        : options.role === "student"
          ? [Role.STUDENT]
          : undefined;

  /*
   * One extra row is fetched so the caller can tell whether another page exists without a
   * second count query.
   */
  const take = limit + 1;

  const random = (options.order ?? "random") === "random";
  const seed = options.seed ?? 1;

  const rows = await prisma.$queryRaw<
    Array<{ id: string; fullName: string; role: Role; campusName: string | null }>
  >(Prisma.sql`
    SELECT u.id, u."fullName", u.role, c.name AS "campusName"
    FROM users u
    LEFT JOIN campuses c ON c.id = u."campusId"
    WHERE u.status = ${Status.ACTIVE}::"Status"
      AND u.id <> ALL(${excluded}::text[])
      ${roleFilter ? Prisma.sql`AND u.role = ANY(${roleFilter}::"Role"[])` : Prisma.empty}
      ${
        search
          ? // Name only. An admission number typed here matches nothing, by construction.
            Prisma.sql`AND u."fullName" ILIKE ${"%" + search + "%"}`
          : Prisma.empty
      }
    ORDER BY ${
      random
        ? // md5 of the id and the session seed: a stable pseudo-random order, not a table scan
          // reshuffle. Same seed, same sequence, every page.
          Prisma.sql`md5(u.id || ${String(seed)}) ASC`
        : Prisma.sql`lower(u."fullName") ASC, u.id ASC`
    }
    LIMIT ${take} OFFSET ${cursor}
  `);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  /*
   * Only genuinely ambiguous names get a campus hint. Two "Mary Wanjiku"s are told apart;
   * everyone else stays a clean photo, name and tick.
   */
  const names = page.map((row) => row.fullName);
  const duplicates = await prisma.user.groupBy({
    by: ["fullName"],
    where: { fullName: { in: names }, status: Status.ACTIVE },
    _count: { fullName: true },
  });
  const ambiguous = new Set(
    duplicates.filter((row) => row._count.fullName > 1).map((row) => row.fullName),
  );

  const profiles = await chatProfiles(page.map((row) => row.id));

  /*
   * Presence is read here as well as pushed over the socket. Without this the list paints
   * everybody as offline until the first socket event arrives, which reads as an empty school
   * on first load and makes the dots look broken.
   */
  const activity = await lastActivityFor(page.map((row) => row.id));
  const hidden = await hiddenPresenceAmong(page.map((row) => row.id));

  const contacts = page.map((row) => {
    const profile = profiles.get(row.id)!;
    const seen = activity.get(row.id) ?? null;
    const maySee = !hidden.has(row.id);
    const online = isOnline(row.id, seen, maySee);
    return {
      ...profile,
      online,
      ...(maySee ? { statusText: describePresence(online, seen, false) } : {}),
      ...(ambiguous.has(row.fullName) && row.campusName
        ? { campusHint: row.campusName }
        : {}),
    };
  });

  return { rows: contacts, nextCursor: hasMore ? cursor + limit : null };
}

/**
 * Which of these people have hidden their presence.
 *
 * Someone who has switched "show last seen" off is reported offline to everyone else. They still
 * see other people's dots — the asymmetry is what makes switching it on mean anything.
 */
export async function hiddenPresenceAmong(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds }, showLastSeen: false },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
}

/** The size of the phonebook, for the contacts header. */
export async function contactCount(viewerId: string): Promise<number> {
  const { blockedByMe, blockedMe } = await blockSetsFor(viewerId);
  const excluded = [...new Set([viewerId, ...blockedByMe, ...blockedMe])];
  return prisma.user.count({
    where: { status: Status.ACTIVE, id: { notIn: excluded } },
  });
}

/**
 * Picks one reachable person the viewer has not blocked. Students and tutors only: a random
 * message to the superadmin is not what the button is for.
 */
export async function randomContact(viewerId: string): Promise<ChatProfile | null> {
  const { blockedByMe, blockedMe } = await blockSetsFor(viewerId);
  const excluded = [...new Set([viewerId, ...blockedByMe, ...blockedMe])];

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT u.id FROM users u
    WHERE u.status = ${Status.ACTIVE}::"Status"
      AND u.role IN (${Role.STUDENT}::"Role", ${Role.TUTOR}::"Role")
      AND u.id <> ALL(${excluded}::text[])
    ORDER BY random()
    LIMIT 1
  `);

  const id = rows[0]?.id;
  if (!id) return null;
  return (await chatProfiles([id])).get(id) ?? null;
}

/**
 * Finds or creates the one thread between two people.
 *
 * The unique `directKey` is the authority: two tabs racing produce one winner and one insert
 * that fails the constraint, which is then read back. No duplicate threads, ever.
 */
export async function openDirectConversation(viewer: ChatUser, otherUserId: string) {
  if (viewer.id === otherUserId) throw new ChatError("You cannot message yourself.", 400);

  const other = await prisma.user.findFirst({
    where: { id: otherUserId, status: Status.ACTIVE },
    select: { id: true },
  });
  if (!other) throw new ChatError("That person is not available.", 404);

  const { blockedByMe, blockedMe } = await blockSetsFor(viewer.id);
  if (blockedByMe.has(otherUserId) || blockedMe.has(otherUserId)) {
    throw new ChatError("That person is not available.", 404);
  }

  const directKey = directKeyFor(viewer.id, otherUserId);

  const existing = await prisma.conversation.findUnique({ where: { directKey } });
  if (existing) {
    // A thread can exist while one side sits in `leftAt`; reopening puts them back.
    await prisma.conversationMember.updateMany({
      where: { conversationId: existing.id, leftAt: { not: null } },
      data: { leftAt: null },
    });
    return existing;
  }

  limitNewDirectChats(viewer.id);

  try {
    return await prisma.conversation.create({
      data: {
        type: "DIRECT",
        directKey,
        createdById: viewer.id,
        members: {
          create: [
            { userId: viewer.id, role: "OWNER" },
            { userId: otherUserId, role: "MEMBER" },
          ],
        },
      },
    });
  } catch (error) {
    // P2002 on directKey: another request created it in the gap. Read the winner.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await prisma.conversation.findUnique({ where: { directKey } });
      if (raced) return raced;
    }
    throw error;
  }
}

/** Conversations the viewer is in, most recently active first. */
export async function listConversations(viewerId: string) {
  const members = await prisma.conversationMember.findMany({
    where: { userId: viewerId, leftAt: null },
    include: {
      conversation: {
        select: {
          id: true,
          type: true,
          title: true,
          classId: true,
          lastMessageAt: true,
          academicClass: { select: { name: true } },
          members: {
            where: { leftAt: null },
            select: { userId: true, role: true },
          },
          messages: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
    orderBy: { conversation: { lastMessageAt: "desc" } },
  });

  const allProfiles = await chatProfiles(
    members.flatMap((member) => member.conversation.members.map((row) => row.userId)),
  );

  const rows = await Promise.all(
    members.map(async (member) => {
      const conversation = member.conversation;
      const last = conversation.messages[0] ?? null;

      /*
       * Unread is counted from the read position forward rather than stored as a number, so it
       * cannot drift out of step with what the reader has actually seen.
       */
      const unread = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          deletedAt: null,
          senderId: { not: viewerId },
          ...(member.lastReadMessageId
            ? { createdAt: { gt: await messageCreatedAt(member.lastReadMessageId) } }
            : {}),
        },
      });

      const others = conversation.members
        .filter((row) => row.userId !== viewerId)
        .map((row) => allProfiles.get(row.userId))
        .filter((profile): profile is ChatProfile => Boolean(profile));

      const isDirect = conversation.type === "DIRECT";
      const title =
        conversation.title ??
        (isDirect ? (others[0]?.name ?? "Conversation") : "Conversation");

      return {
        id: conversation.id,
        type: conversation.type,
        title,
        classId: conversation.classId,
        updatedAt: conversation.lastMessageAt,
        mutedUntil: member.mutedUntil,
        unread,
        memberCount: conversation.members.length,
        other: isDirect ? (others[0] ?? null) : null,
        preview: last
          ? { id: last.id, body: last.body, createdAt: last.createdAt, mine: last.senderId === viewerId }
          : null,
      };
    }),
  );

  return rows;
}

async function messageCreatedAt(messageId: string): Promise<Date> {
  const row = await prisma.message.findUnique({
    where: { id: messageId },
    select: { createdAt: true },
  });
  return row?.createdAt ?? new Date(0);
}

/** A page of history, newest last, so the thread renders in reading order. */
export async function listMessages(
  conversationId: string,
  viewerId: string,
  options: { before?: string; limit?: number } = {},
) {
  const limit = Math.min(options.limit ?? PAGE_SIZE, 100);

  const before = options.before
    ? await prisma.message.findUnique({ where: { id: options.before }, select: { createdAt: true } })
    : null;

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: before.createdAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      body: true,
      senderId: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
      clientMessageId: true,
      replyToId: true,
      receipts: { select: { userId: true, readAt: true, deliveredAt: true } },
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true, expiresAt: true },
      },
    },
  });

  const hasMore = rows.length > limit;
  const page = (hasMore ? rows.slice(0, limit) : rows).reverse();

  const profiles = await chatProfiles(page.map((row) => row.senderId));

  return {
    rows: page.map((row) => ({
      id: row.id,
      /*
       * Every message carries its conversation id. The client stores messages in a map keyed by
       * conversation, so a row without one would be filed under `undefined` and never shown —
       * which is exactly what happened before this was added.
       */
      conversationId,
      body: row.deletedAt ? "" : row.body,
      deleted: Boolean(row.deletedAt),
      senderId: row.senderId,
      sender: profiles.get(row.senderId) ?? null,
      createdAt: row.createdAt,
      editedAt: row.editedAt,
      clientMessageId: row.clientMessageId,
      replyToId: row.replyToId,
      attachments: row.attachments,
      receipts: row.receipts,
    })),
    nextCursor: hasMore ? page[0].id : null,
  };
}

/** Everyone who should be told about a new message: members still in the room, minus sender. */
export async function recipientsOf(conversationId: string, senderId: string) {
  const members = await prisma.conversationMember.findMany({
    where: { conversationId, leftAt: null, userId: { not: senderId } },
    select: { userId: true },
  });
  return members.map((row) => row.userId);
}

export { isStaff };
