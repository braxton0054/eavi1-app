import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { PageHeader } from "@/components/dashboard/panel";
import { pages } from "@/lib/content/dashboard";
import { requirePortalUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const copy = pages.chat;

/**
 * The chat screen.
 *
 * The page itself holds no conversation data: everything is fetched by the client after the
 * socket connects, so a slow query here can never delay the first paint of an empty thread.
 */
export default async function ChatPage() {
  const scope = await requirePortalUser();

  return (
    <div className="space-y-4">
      <PageHeader title={copy.title} description={copy.description} />
      <ChatWorkspace viewerId={scope.userId} viewerName={scope.fullName} />
    </div>
  );
}
