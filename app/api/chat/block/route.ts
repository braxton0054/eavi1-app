import { z } from "zod";

import { ChatError, requireChatUser } from "@/lib/chat/access";
import { chatRoute } from "@/lib/chat/route";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({ userId: z.string().min(1).max(64), blocked: z.boolean() });

/**
 * Blocking is one-directional and immediate: the blocked person can no longer write to the
 * blocker, and disappears from their contacts and from the blocker's.
 */
export async function POST(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { userId, blocked } = schema.parse(await request.json());

    if (userId === viewer.id) throw new ChatError("You cannot block yourself.", 400);

    if (blocked) {
      await prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: userId } },
        create: { blockerId: viewer.id, blockedId: userId },
        update: {},
      });
    } else {
      await prisma.userBlock.deleteMany({ where: { blockerId: viewer.id, blockedId: userId } });
    }

    return { blocked };
  });
}
