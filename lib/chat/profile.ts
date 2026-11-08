import { Role, Status } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * The only description of a person that chat is allowed to reveal.
 *
 * Deliberately tiny. Every field here is safe for any signed-in member of the school to see:
 * a name, a picture, and the tick that says what kind of account this is. There is no room in
 * this type for an admission number, a phone number or an email address, so no query written
 * against it can leak one by accident.
 */
export type ChatProfile = {
  userId: string;
  name: string;
  photoThumbUrl: string | null;
  role: Role;
  /** Which tick to draw. Derived here, from the server's own role, so it cannot be claimed. */
  tick: TickRole;
};

/** The three kinds of account a tick distinguishes. Admin-ish roles all share the blue tick. */
export type TickRole = "admin" | "tutor" | "student";

export function tickRoleFor(role: Role): TickRole {
  if (role === Role.TUTOR) return "tutor";
  return role === Role.STUDENT ? "student" : "admin";
}

/**
 * A student's picture was captured at enrolment and is the one the college already has, so
 * chat points at it rather than asking for a second upload. Staff have their own.
 */
function photoFor(user: {
  photoUrl: string | null;
  student: { profilePhotoUrl: string | null } | null;
}): string | null {
  return user.photoUrl ?? user.student?.profilePhotoUrl ?? null;
}

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  role: true,
  photoUrl: true,
  student: { select: { profilePhotoUrl: true } },
} as const;

function toProfile(user: {
  id: string;
  fullName: string;
  role: Role;
  photoUrl: string | null;
  student: { profilePhotoUrl: string | null } | null;
}): ChatProfile {
  const raw = photoFor(user);
  return {
    userId: user.id,
    name: user.fullName,
    // The raw storage URL is never handed to a client; chat shows a small authenticated
    // thumbnail cut from it, so a full-size enrolment photo cannot be hotlinked out of a
    // message payload.
    photoThumbUrl: raw ? `/api/chat/avatar/${user.id}` : null,
    role: user.role,
    tick: tickRoleFor(user.role),
  };
}

/**
 * Who may appear in contacts and be messaged: active accounts only. A withdrawn, disabled or
 * pending account is invisible to the rest of the school.
 */
export function reachableUserWhere() {
  return { status: Status.ACTIVE };
}

export async function chatProfiles(userIds: readonly string[]): Promise<Map<string, ChatProfile>> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return new Map();

  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: PROFILE_SELECT,
  });

  return new Map(users.map((user) => [user.id, toProfile(user)]));
}

export async function chatProfile(userId: string): Promise<ChatProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
  return user ? toProfile(user) : null;
}

/** The raw stored picture for the thumbnail route. Never returned to a client directly. */
export async function rawPhotoUrl(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { photoUrl: true, student: { select: { profilePhotoUrl: true } } },
  });
  return user ? photoFor(user) : null;
}

/**
 * The pair key that makes a DIRECT thread unique. Sorting the two ids means the same pair
 * produces the same key whichever of them starts the conversation.
 */
export function directKeyFor(a: string, b: string): string {
  return [a, b].sort().join(":");
}
