import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The chat screen.
 *
 * The page itself holds no conversation data: everything is fetched by the client after the
 * socket connects, so a slow query here can never delay the first paint of an empty thread.
 *
 * There is no page heading. Chat is a workspace, not a document: a title and a paragraph of
 * description above it cost about 116px of a phone screen, which is two messages. The workspace
 * carries its own header, where the name of the open conversation already tells you where you are.
 */
export default async function ChatPage() {
  const scope = await requirePortalUser();

  return <ChatWorkspace viewerId={scope.userId} viewerName={scope.fullName} />;
}
