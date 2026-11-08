import { requireChatUser } from "@/lib/chat/access";
import { deleteOwnMessage, sendMessage } from "@/lib/chat/messages";
import { chatRoute } from "@/lib/chat/route";

export const dynamic = "force-dynamic";

/**
 * The HTTP way to send, used when WebSockets are unavailable (an office behind a proxy that
 * strips them). Identical rules to the socket: same function, same checks.
 */
export async function POST(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const message = await sendMessage(viewer, await request.json());
    return { message };
  });
}

export async function DELETE(request: Request) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { messageId } = (await request.json()) as { messageId?: string };
    return deleteOwnMessage(viewer.id, String(messageId ?? ""));
  });
}
