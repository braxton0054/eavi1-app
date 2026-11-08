import { prisma } from "@/lib/prisma";

/**
 * Presence across the whole application.
 *
 * Being online means "signed in and using the portal", not "has the chat screen open". Someone
 * reading a student's fees is still at their desk and still reachable — treating them as offline
 * because they left one tab is both wrong and, for a school office, actively misleading.
 *
 * So presence has two inputs:
 *
 *  - **Session activity**, which `resolveSession` already records on every request to any page.
 *    This is the truth, and it needs no new heartbeat: reading the fees page is activity.
 *  - **Live sockets**, which make presence immediate but are only a hint about the chat screen.
 *
 * A session with a live socket is online even before its next request; a session with none is
 * online while its last request is recent. The dot therefore appears the moment the app opens and
 * does not flicker off when the chat tab is closed.
 */

/** How long an activity heartbeat counts as "online". Comfortably longer than the beat itself. */
export const ONLINE_WINDOW_MS = 90_000;

/** The interval the client should beat at. A third of the window, so two beats may be lost. */
export const HEARTBEAT_MS = 30_000;

const websocketUsers = new Map<string, number>();

/** Live socket connections per user, so a second tab closing does not mark the person offline. */
export function socketConnected(userId: string) {
  websocketUsers.set(userId, (websocketUsers.get(userId) ?? 0) + 1);
}

export function socketDisconnected(userId: string) {
  const count = (websocketUsers.get(userId) ?? 1) - 1;
  if (count <= 0) websocketUsers.delete(userId);
  else websocketUsers.set(userId, count);
}

export function hasLiveSocket(userId: string): boolean {
  return websocketUsers.has(userId);
}

/**
 * The most recent sign of life from any of a person's signed-in sessions.
 *
 * `Session.lastSeenAt` is already written by `resolveSession` on every authenticated request, so
 * this is the whole application's activity, not just chat's — no extra heartbeat table needed.
 */
export async function lastActivityFor(userIds: string[]): Promise<Map<string, Date>> {
  const result = new Map<string, Date>();
  if (userIds.length === 0) return result;

  const rows = await prisma.session.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds }, expiresAt: { gt: new Date() } },
    _max: { lastSeenAt: true },
  });

  for (const row of rows) {
    const seen = row._max.lastSeenAt;
    if (seen) result.set(row.userId, seen);
  }
  return result;
}

/**
 * Records that a person is using the application.
 *
 * Chat itself calls this when it opens, so someone who sits in a thread without navigating still
 * shows as online. Ordinary page views are covered by `resolveSession` and need no help.
 */
export async function recordActivity(userId: string): Promise<void> {
  const now = new Date();
  await prisma.session
    .updateMany({ where: { userId, expiresAt: { gt: now } }, data: { lastSeenAt: now } })
    .catch(() => {
      // A failed heartbeat must never break the page it came from.
    });
}

/**
 * Whether a person counts as online right now.
 *
 * Honours `showLastSeen`: someone who has switched presence off is reported offline to everyone
 * else, but still sees other people's presence. The asymmetry is intentional and standard — it is
 * the only way "hide my status" can mean anything.
 */
export function isOnline(
  userId: string,
  lastSeen: Date | null | undefined,
  viewerMaySee: boolean,
): boolean {
  if (!viewerMaySee) return false;
  if (hasLiveSocket(userId)) return true;
  return lastSeen ? Date.now() - lastSeen.getTime() < ONLINE_WINDOW_MS : false;
}

/**
 * The "last seen" text, rounded so that a slightly stale heartbeat never reads as a lie.
 *
 * Sub-minute ages say "Online" because that is what they mean; beyond that the person really is
 * away, and a precise timestamp is more useful than a fake "just now".
 */
export function describePresence(
  online: boolean,
  lastSeen: Date | null | undefined,
  hidden: boolean,
): string | null {
  if (hidden) return null;
  if (online) return "Online";
  if (!lastSeen) return "Offline";

  const ago = Date.now() - lastSeen.getTime();
  const minutes = Math.floor(ago / 60_000);

  if (minutes < 2) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Last seen ${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Last seen yesterday";
  if (days < 7) return `Last seen ${days} days ago`;

  const date = lastSeen.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return `Last seen ${date}`;
}

/** Test seam: forget every in-memory presence record. */
export function resetPresence() {
  websocketUsers.clear();
}
