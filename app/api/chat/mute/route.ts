import { z } from "zod";

import { requireChatUser, requireMembership } from "@/lib/chat/access";
import { chatRoute } from "@/lib/chat/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  conversationId: z.string().min(1).max(64),
  /** null clears the mute, a number mutes for that many minutes. */
  minutes: z.number().int().min(0).max(60 * 24 * 365).nullable(),
});

/** Mute is per person per thread: it silences pop-ups, never hides the conversation. */
export async function POST(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { conversationId, minutes } = schema.parse(await request.json());
    const member = await requireMembership(conversationId, viewer.id);

    const mutedUntil =
      minutes === null || minutes === 0 ? null : new Date(Date.now() + minutes * 60_000);

    await prisma.conversationMember.update({
      where: { id: member.id },
      data: { mutedUntil },
    });

    return { mutedUntil };
  });
}
