import { requireChatUser, requireMembership } from "@/lib/chat/access";
import { listMessages } from "@/lib/chat/conversations";
import { chatRoute } from "@/lib/chat/route";

export const dynamic = "force-dynamic";

/**
 * History for one thread.
 *
 * Membership is proven before a single row is read, so a guessed conversation id returns 403
 * and no messages, rather than an empty thread that would still confirm it exists.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return chatRoute(async () => {
    const viewer = await requireChatUser();
    const { id } = await params;
    await requireMembership(id, viewer.id);

    const url = new URL(request.url);
    const before = url.searchParams.get("before") ?? undefined;

    return listMessages(id, viewer.id, { before });
  });
}
