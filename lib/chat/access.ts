import { Role, Status } from "@/generated/prisma/enums";
import { resolveSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Who is chatting. Deliberately narrower than the session's user record: chat needs the id
 * and the role to decide permissions, and nothing else. A name or an email address here would
 * only invite someone to start returning them in a payload.
 */
export type ChatUser = {
  id: string;
  role: Role;
};

export class ChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const STAFF_ROLES: readonly Role[] = [Role.SUPERADMIN, Role.CAMPUS_ADMIN, Role.TUTOR];

export function isStaff(role: Role): boolean {
  return STAFF_ROLES.includes(role);
}

/**
 * Resolves a raw session token to a chat user. Used by the socket handshake and by every
 * route, so both paths agree on what a valid caller is.
 *
 * A disabled account is refused even with a token still in the database: switching someone
 * off must end their chat immediately, not in thirty days.
 */
export async function chatUserFromToken(token: string | undefined | null): Promise<ChatUser | null> {
  if (!token) return null;
  const user = await resolveSession(token);
  if (!user || user.status !== Status.ACTIVE) return null;
  return { id: user.id, role: user.role };
}

/** A route's caller, or a ChatError that the route turns into a status code. */
export async function requireChatUser(): Promise<ChatUser> {
  /*
   * Imported here rather than at the top of the file so that the Socket.IO layer — which only
   * ever authenticates from a raw cookie — does not drag `next/headers` into the server bundle.
   */
  const { chatUserFromCookies } = await import("@/lib/chat/cookies");
  const user = await chatUserFromCookies();
  if (!user) throw new ChatError("Unauthorized", 401);
  return user;
}

/** Turns a thrown ChatError into a response; anything else becomes a 500. */
export function chatErrorResponse(error: unknown): { message: string; status: number } {
  if (error instanceof ChatError) return { message: error.message, status: error.status };
  if (error instanceof Error && /too many|rate/i.test(error.message)) {
    return { message: error.message, status: 429 };
  }
  return { message: "Something went wrong.", status: 500 };
}

/**
 * Cached for the life of a socket connection's message send: an admin who restricts someone
 * expects the effect to be immediate, so this is deliberately not cached for long.
 */
export async function activeRestriction(userId: string) {
  const now = new Date();
  return prisma.chatRestriction.findFirst({
    where: {
      userId,
      OR: [{ restrictedUntil: null }, { restrictedUntil: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** True when either side has blocked the other. Either direction stops a conversation. */
export async function blockedBetween(a: string, b: string): Promise<boolean> {
  const block = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

/** The ids this person has blocked, and the ids who have blocked them. */
export async function blockSetsFor(userId: string) {
  const [mine, against] = await Promise.all([
    prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.userBlock.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
  ]);
  return {
    blockedByMe: new Set(mine.map((row) => row.blockedId)),
    blockedMe: new Set(against.map((row) => row.blockerId)),
  };
}

/**
 * Membership, proven from the database every time. The client never says which rooms it is
 * in; it says which rooms it would like to be in and this decides.
 */
export async function membershipFor(conversationId: string, userId: string) {
  return prisma.conversationMember.findFirst({
    where: { conversationId, userId, leftAt: null },
    include: {
      conversation: {
        select: {
          id: true,
          type: true,
          title: true,
          classId: true,
          postingMode: true,
          lastMessageAt: true,
        },
      },
    },
  });
}

export async function requireMembership(conversationId: string, userId: string) {
  const member = await membershipFor(conversationId, userId);
  if (!member) throw new ChatError("You are not part of this conversation.", 403);
  return member;
}

/**
 * May this person post here? Class rooms can be staff-only, and a muted conversation or an
 * admin restriction stops writing without hiding history.
 */
export async function canPost(
  member: NonNullable<Awaited<ReturnType<typeof membershipFor>>>,
  user: ChatUser,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const conversation = member.conversation;

  if (conversation.type === "CLASS" && conversation.postingMode === "STAFF_ONLY" && !isStaff(user.role)) {
    return { ok: false, reason: "Only tutors and admins can post in this class room." };
  }

  if (member.mutedUntil && member.mutedUntil.getTime() > Date.now()) {
    return { ok: false, reason: "You have muted this conversation." };
  }

  const restriction = await activeRestriction(user.id);
  if (restriction) return { ok: false, reason: "An administrator has restricted your chat access." };

  return { ok: true };
}
