import { z } from "zod";

import { requireChatUser } from "@/lib/chat/access";
import { listConversations, openDirectConversation } from "@/lib/chat/conversations";
import { chatRoute } from "@/lib/chat/route";

export const dynamic = "force-dynamic";

const openSchema = z.object({ userId: z.string().min(1).max(64) });

/** The chat list, most recent activity first. */
export async function GET() {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    return { conversations: await listConversations(viewer.id) };
  });
}

/** Opens (or reuses) the DIRECT thread with someone, which is what tapping a contact does. */
export async function POST(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { userId } = openSchema.parse(await request.json());
    const conversation = await openDirectConversation(viewer, userId);
    return { conversationId: conversation.id };
  });
}
