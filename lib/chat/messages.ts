import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  ChatError,
  canPost,
  requireMembership,
  type ChatUser,
} from "@/lib/chat/access";
import { MAX_BODY } from "@/lib/chat/conversations";
import { limitMessages } from "@/lib/chat/rate-limit";
import { chatProfiles } from "@/lib/chat/profile";
import { storeAttachment } from "@/lib/chat/attachments";
import { notifyUser } from "@/lib/notifications/service";

/**
 * Sending is one function, called by the socket and by the HTTP fallback, so both paths agree
 * on permissions, ordering and the shape of what is broadcast.
 */

export const sendSchema = z.object({
  conversationId: z.string().min(1).max(64),
  /*
   * Optional because a message may be an attachment on its own. Whether it is allowed to be
   * empty is decided after permissions are checked: empty with a file is fine, empty on its own
   * is not.
   */
  body: z.string().trim().max(MAX_BODY, `A message cannot be longer than ${MAX_BODY} characters.`).default(""),
  clientMessageId: z.string().min(1).max(64).optional(),
  replyToId: z.string().max(64).optional(),
});

export type SendInput = z.infer<typeof sendSchema>;

export async function sendMessage(
  user: ChatUser,
  raw: unknown,
  options?: { attachment?: File | null },
) {
  const input = sendSchema.parse(raw);

  const member = await requireMembership(input.conversationId, user.id);

  const allowed = await canPost(member, user);
  if (!allowed.ok) throw new ChatError(allowed.reason, 403);

  if (!input.body && !options?.attachment) {
    throw new ChatError("A message cannot be empty.", 400);
  }

  limitMessages(user.id);

  /*
   * A clientMessageId makes the send idempotent: a retry after a dropped connection finds the
   * row it already created instead of posting twice. The unique index on
   * (senderId, clientMessageId) is what guarantees it.
   */
  if (input.clientMessageId) {
    const existing = await prisma.message.findFirst({
      where: { senderId: user.id, clientMessageId: input.clientMessageId },
      select: { id: true },
    });
    if (existing) return serialize(user, existing.id);
  }

  // A reply target must live in the same conversation, or a message could quote a stranger's.
  if (input.replyToId) {
    const target = await prisma.message.findFirst({
      where: { id: input.replyToId, conversationId: input.conversationId },
      select: { id: true },
    });
    if (!target) throw new ChatError("That message is not in this conversation.", 400);
  }

  /*
   * The file is stored before the transaction so a rejected upload never leaves a message behind.
   * Permissions have already passed at this point, so nothing is written for a non-member.
   */
  const stored = options?.attachment ? await storeAttachment(options.attachment, input.conversationId) : null;

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: user.id,
        body: input.body,
        clientMessageId: input.clientMessageId,
        replyToId: input.replyToId,
        ...(stored ? { attachments: { create: stored } } : {}),
      },
      select: { id: true },
    });

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: new Date() },
    });

    // Sender has by definition read their own message.
    await tx.conversationMember.update({
      where: { id: member.id },
      data: { lastReadMessageId: message.id },
    });

    return message;
  });

  // The other members hear about it, each under their own privacy setting: someone who
  // hides message text is told a message arrived, not what it says. One notification per
  // message per person — a retried send cannot ring twice.
  const others = await prisma.conversationMember.findMany({
    where: { conversationId: input.conversationId, userId: { not: user.id } },
    select: { userId: true, user: { select: { hideMessageText: true } } },
  });
  if (others.length > 0) {
    const sender = await prisma.user.findUnique({
      where: { id: user.id },
      select: { fullName: true },
    });
    const preview = input.body.length > 120 ? `${input.body.slice(0, 119)}…` : input.body;
    await Promise.all(
      others.map((other) =>
        notifyUser(other.userId, {
          title: `New message from ${sender?.fullName ?? "someone"}`,
          body: other.user.hideMessageText ? "Open the chat to read it." : preview || "Sent an attachment.",
          notificationType: "chat",
          targetUrl: "/portal/chat",
          dedupeKey: `chat:message:${created.id}`,
        }),
      ),
    );
  }

  return serialize(user, created.id);
}

/** The message in the shape every client sees. Sender identity comes from the safe profile. */
export async function serialize(user: ChatUser, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      conversationId: true,
      body: true,
      senderId: true,
      createdAt: true,
      clientMessageId: true,
      replyToId: true,
      deletedAt: true,
      attachments: {
        where: { deletedAt: null },
        select: { id: true, fileName: true, contentType: true, sizeBytes: true, expiresAt: true },
      },
    },
  });
  if (!message) throw new ChatError("Message not found.", 404);

  const profiles = await chatProfiles([message.senderId]);

  return {
    id: message.id,
    conversationId: message.conversationId,
    body: message.deletedAt ? "" : message.body,
    deleted: Boolean(message.deletedAt),
    senderId: message.senderId,
    sender: profiles.get(message.senderId) ?? null,
    createdAt: message.createdAt,
    clientMessageId: message.clientMessageId,
    replyToId: message.replyToId,
    // The id only; the file itself is fetched through an authenticated route.
    attachments: message.attachments,
    receipts: [] as Array<{ userId: string; readAt: Date | null; deliveredAt: Date | null }>,
    _self: user.id,
  };
}

/** Marks everything up to a message as read for this member. */
export async function markRead(conversationId: string, userId: string, messageId?: string) {
  const member = await prisma.conversationMember.findFirst({
    where: { conversationId, userId, leftAt: null },
    select: { id: true, lastReadMessageId: true },
  });
  if (!member) throw new ChatError("You are not part of this conversation.", 403);

  const latest = messageId
    ? await prisma.message.findFirst({
        where: { id: messageId, conversationId },
        select: { id: true, createdAt: true },
      })
    : await prisma.message.findFirst({
        where: { conversationId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      });

  if (!latest) return { ok: true as const };

  await prisma.conversationMember.update({
    where: { id: member.id },
    data: { lastReadMessageId: latest.id },
  });

  // Receipts for everything in the room the reader had not yet marked, so the sender's double
  // tick reflects reality rather than only the newest message.
  await prisma.messageReceipt.createMany({
    data: (
      await prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: userId },
          createdAt: { lte: latest.createdAt },
          deletedAt: null,
        },
        select: { id: true },
      })
    ).map((row) => ({
      messageId: row.id,
      userId,
      deliveredAt: new Date(),
      readAt: new Date(),
    })),
    skipDuplicates: true,
  });

  return { ok: true as const, lastReadMessageId: latest.id };
}

/** Deletes one of your own messages, softly, keeping the row for moderation. */
export async function deleteOwnMessage(userId: string, messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { senderId: true, conversationId: true },
  });
  if (!message) throw new ChatError("Message not found.", 404);
  if (message.senderId !== userId) throw new ChatError("You can only delete your own messages.", 403);

  await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  });

  return { conversationId: message.conversationId };
}

/** Every missed message after the last id the client had, for reconnect catch-up. */
export async function messagesSince(conversationId: string, afterId: string | undefined, limit = 200) {
  const after = afterId
    ? await prisma.message.findUnique({ where: { id: afterId }, select: { createdAt: true } })
    : null;

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(after ? { createdAt: { gt: after.createdAt } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      body: true,
      senderId: true,
      createdAt: true,
      clientMessageId: true,
      replyToId: true,
      deletedAt: true,
    },
  });

  const profiles = await chatProfiles(rows.map((row) => row.senderId));

  return rows.map((row) => ({
    id: row.id,
    conversationId,
    body: row.deletedAt ? "" : row.body,
    deleted: Boolean(row.deletedAt),
    senderId: row.senderId,
    sender: profiles.get(row.senderId) ?? null,
    createdAt: row.createdAt,
    clientMessageId: row.clientMessageId,
    replyToId: row.replyToId,
    receipts: [],
  }));
}
