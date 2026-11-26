import { sendNotification } from "web-push";
import { Role, Status } from "@/generated/prisma/enums";

import { prisma } from "@/lib/prisma";
import { vapid } from "@/lib/notifications/config";
import type { PushPayload } from "@/lib/notifications/types";

/**
 * The notification service.
 *
 * Everything the college tells a person goes through here, so the rules live in one
 * place: the row is saved first (the bell reads it even if push never arrives), the
 * person's own mute list is respected, an event cannot reach the same person twice
 * (the dedupe key), and the browser pushes go out without holding the caller's request
 * — queued when Redis is up, delivered after the response otherwise.
 */

export type NotifyInput = {
  title: string;
  /** One short sentence. Nothing confidential: this can appear on a lock screen. */
  body: string;
  notificationType: string;
  /** In-app path the notification opens; null opens the portal home. */
  targetUrl?: string | null;
  data?: Record<string, unknown>;
  /** Names the event, so a retried action cannot notify the same person twice. */
  dedupeKey?: string | null;
};

const payloadOf = (input: NotifyInput): PushPayload => ({
  title: input.title,
  body: input.body,
  url: input.targetUrl ?? null,
  type: input.notificationType,
});

/** One person. */
export function notifyUser(userId: string, input: NotifyInput) {
  return notifyUsers([userId], input);
}

/**
 * Specific people — the ids should be resolved by the caller from whatever the event
 * already knows (an exam's enrolled students, a conversation's members), so this module
 * never needs to understand every feature's shape of "who is involved".
 */
export async function notifyUsers(userIds: string[], input: NotifyInput) {
  if (userIds.length === 0) return { notified: 0 };

  // A muted kind is a person's own choice; the bell still shows the history row.
  const muted = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, mutedTypes: { has: input.notificationType } },
    select: { userId: true },
  });
  const mutedSet = new Set(muted.map((row) => row.userId));
  const targets = [...new Set(userIds)].filter((id) => !mutedSet.has(id));
  if (targets.length === 0) return { notified: 0 };

  const created = await prisma.notification.createMany({
    data: targets.map((userId) => ({
      recipientUserId: userId,
      title: input.title,
      body: input.body,
      notificationType: input.notificationType,
      targetUrl: input.targetUrl ?? null,
      data: (input.data ?? undefined) as never,
      dedupeKey: input.dedupeKey ?? null,
    })),
    skipDuplicates: true,
  });

  scheduleDelivery(targets, payloadOf(input));
  return { notified: created.count };
}

/** Everyone holding a role — optionally one campus's share of them. */
export async function notifyRole(
  role: Role,
  input: NotifyInput,
  campusId: number | null = null,
) {
  const users = await prisma.user.findMany({
    where: { role, status: Status.ACTIVE, ...(campusId === null ? {} : { campusId }) },
    select: { id: true },
  });
  return notifyUsers(users.map((user) => user.id), input);
}

export const notifyStudents = (input: NotifyInput, campusId: number | null = null) =>
  notifyRole(Role.STUDENT, input, campusId);

export const notifyTutors = (input: NotifyInput, campusId: number | null = null) =>
  notifyRole(Role.TUTOR, input, campusId);

/** A class, through its membership: the students the class actually holds today. */
export async function notifyClass(classId: string, input: NotifyInput) {
  const members = await prisma.classMembership.findMany({
    where: { classId, leftAt: null },
    select: { enrollment: { select: { student: { select: { userId: true } } } } },
  });
  return notifyUsers(
    members.map((member) => member.enrollment.student.userId),
    input,
  );
}

/**
 * The whole college — or one campus's whole college. A campus-scoped sender (the compose
 * form's "campus" choice) reaches only that campus; a super admin's "college" choice
 * reaches everyone.
 */
export async function notifyEveryone(input: NotifyInput, campusId: number | null = null) {
  const users = await prisma.user.findMany({
    where: { status: Status.ACTIVE, ...(campusId === null ? {} : { campusId }) },
    select: { id: true },
  });
  return notifyUsers(users.map((user) => user.id), input);
}

/* --------------------------------------------------------------------------
 * Delivery
 * ----------------------------------------------------------------------- */

type DeliveryOutcome = "ok" | "gone" | "retry";

async function sendOne(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload,
): Promise<DeliveryOutcome> {
  vapid();
  try {
    await sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      // A push that outlives four days is a lie about news; the bell holds the history.
      { TTL: 4 * 24 * 60 * 60 },
    );
    return "ok";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // Gone (the browser forgot the subscription) and permanently rejected (bad key,
    // wrong auth, sender refused) are dead ends: the endpoint will never work again.
    if (status && [400, 401, 403, 404, 410].includes(status)) return "gone";
    // Rate limits, broker hiccups, network — the queue's retry policy handles these.
    return "retry";
  }
}

/** Pushes to every subscription, drops the dead ones, and stamps the ones that worked. */
export async function deliverPushes(
  subscriptions: Array<{ id: string; endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload,
) {
  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendOne(subscription, payload)),
  );

  const ok: string[] = [];
  const gone: string[] = [];
  let retried = 0;
  results.forEach((result, index) => {
    const outcome = result.status === "fulfilled" ? result.value : "retry";
    if (outcome === "ok") ok.push(subscriptions[index].id);
    else if (outcome === "gone") gone.push(subscriptions[index].id);
    else retried += 1;
  });

  // A dead endpoint is deleted, not kept: expired subscriptions must leave the table,
  // or every future send pays for them forever.
  if (gone.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  }
  if (ok.length > 0) {
    await prisma.pushSubscription.updateMany({
      where: { id: { in: ok } },
      data: { lastUsedAt: new Date() },
    });
  }

  if (retried > 0) {
    // surfaced for the queue's retry bookkeeping and for the logs either way
    console.warn(`[notify] ${retried} of ${subscriptions.length} pushes need a retry`);
  }
  return { sent: ok.length, removed: gone.length };
}

/** Every subscription these people own — phone and laptop alike. */
async function deliverTo(userIds: string[], payload: PushPayload) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds }, user: { status: "ACTIVE", mustChangePassword: false } },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  return deliverPushes(subscriptions, payload);
}

/**
 * Fire-and-forget: the promise keeps running after the response is written — this is a
 * long-lived server (a container, plus the chat's socket process, which imports this
 * module from outside any Next request), not a frozen lambda. The row is already saved,
 * so the bell never waited on the push; a failed delivery is logged, never thrown into
 * the request that caused it.
 */
function scheduleDelivery(userIds: string[], payload: PushPayload) {
  void deliverTo(userIds, payload).catch((error: Error) =>
    console.error("[notify] delivery failed:", error.message),
  );
}
