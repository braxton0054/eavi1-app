import { z } from "zod";

import { ChatError, requireChatUser, requireMembership } from "@/lib/chat/access";
import { chatRoute } from "@/lib/chat/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  messageId: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Reporting a message. The reporter must be a member of the thread it lives in, so a report can
 * only ever be about something the reporter could see.
 */
export async function POST(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { messageId, reason } = schema.parse(await request.json());

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, senderId: true },
    });
    if (!message) throw new ChatError("Message not found.", 404);
    if (message.senderId === viewer.id) throw new ChatError("You cannot report your own message.", 400);

    await requireMembership(message.conversationId, viewer.id);

    await prisma.messageReport.create({
      data: { messageId: message.id, reporterId: viewer.id, reason },
    });

    return { reported: true };
  });
}
