"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatListPanel, type ConversationRow } from "@/components/chat/chat-list-panel";
import { ContactsPanel } from "@/components/chat/contacts-panel";
import { ThreadPanel } from "@/components/chat/thread-panel";
import { useChatSocket, type ChatMessage } from "@/hooks/use-chat-socket";
import { cn } from "@/lib/utils";

/**
 * The chat screen.
 *
 * Desktop is two panes; a phone is one pane at a time with a back button. Both use the same
 * components, so there is no second mobile layout to keep in step — only whether the list or
 * the thread is visible.
 */
export function ChatWorkspace({ viewerId, viewerName }: { viewerId: string; viewerName: string }) {
  const [tab, setTab] = useState<"chats" | "contacts">("chats");
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [older, setOlder] = useState<Record<string, string | null>>({});
  const joined = useRef<Set<string>>(new Set());

  const socket = useChatSocket(true);

  /*
   * Fetches the list and applies it. No state is touched before the request is dispatched, so
   * calling this from an effect does not schedule a render before any work has happened.
   */
  const loadList = useCallback(async () => {
    const pending = fetch("/api/chat/conversations");
    const response = await pending;
    const data = await response.json();
    if (data.ok) setRows(data.conversations);
    setLoadingList(false);
  }, []);

  // The initial fetch is started, not awaited, so the first paint is never blocked by it.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/chat/conversations");
      const data = await response.json();
      if (cancelled) return;
      if (data.ok) setRows(data.conversations);
      setLoadingList(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * A message arriving anywhere refreshes the list, so the preview and unread badge stay honest
   * without the reader having to reload. The fetch is awaited before any state changes, which
   * keeps this effect from scheduling a render of its own.
   */
  const lastEventId = socket.lastEvent?.id ?? null;
  useEffect(() => {
    if (!lastEventId) return;
    let cancelled = false;

    void (async () => {
      const response = await fetch("/api/chat/conversations");
      const data = await response.json();
      if (!cancelled && data.ok) setRows(data.conversations);
    })();

    return () => {
      cancelled = true;
    };
  }, [lastEventId]);

  const active = rows.find((row) => row.id === activeId) ?? null;

  const history = useCallback(
    async (conversationId: string) => {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      const data = await response.json();
      if (data.ok) {
        // Prepend the page by seeding the socket store through a join then merging.
        for (const message of [...data.rows].reverse()) socket.merge(message);
        setOlder((current) => ({ ...current, [conversationId]: data.nextCursor }));
      }
    },
    [socket],
  );

  const open = useCallback(
    (conversationId: string) => {
      setActiveId(conversationId);
      setTab("chats");
      if (!joined.current.has(conversationId)) {
        joined.current.add(conversationId);
        socket.join(conversationId);
        void history(conversationId);
      }
    },
    [socket, history],
  );

  const openPerson = useCallback(
    async (userId: string) => {
      const response = await fetch("/api/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (data.ok) {
        await loadList();
        open(data.conversationId);
      }
    },
    [loadList, open],
  );

  const send = useCallback(
    async (body: string) => {
      if (!activeId) return;
      const clientMessageId = `${viewerId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const optimistic: ChatMessage = {
        id: clientMessageId,
        conversationId: activeId,
        body,
        senderId: viewerId,
        sender: null,
        createdAt: new Date().toISOString(),
        clientMessageId,
        mine: true,
        pending: true,
      };
      socket.addOptimistic(optimistic);

      const result = await socket.send({ conversationId: activeId, body, clientMessageId });
      if (!result.ok) socket.markFailed(activeId, clientMessageId);
    },
    [activeId, socket, viewerId],
  );

  const messages = (activeId ? socket.messages[activeId] ?? [] : []).map((message) => ({
    ...message,
    mine: message.senderId === viewerId,
  }));

  const typingNames =
    activeId && active
      ? (socket.typing[activeId] ?? []).filter((id) => id !== viewerId).map(() => active.title)
      : [];

  return (
    /*
     * Sized against the real chrome rather than a guessed number of rems: the header, the page
     * heading above, and the fixed mobile navigation below all take space out of the viewport.
     * `dvh` (not `vh`) so a phone's collapsing browser toolbar cannot push the composer behind
     * the nav bar. The subtracting values are the measured header (56px), heading block (~116px)
     * and mobile bar (57px + safe-area).
     */
    <div className="flex h-[calc(100dvh-15.5rem)] min-h-0 overflow-hidden rounded-xl border border-[var(--eavi-border)] bg-[var(--eavi-card)] max-lg:mb-2 lg:h-[calc(100dvh-9rem)]">
      {/* List pane: full width on a phone, fixed column on desktop. */}
      <div
        className={cn(
          "flex min-h-0 w-full flex-col border-r border-[var(--eavi-border)] lg:w-80 lg:shrink-0",
          activeId ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="flex border-b border-[var(--eavi-border)]" role="tablist" aria-label="Chat sections">
          {(["chats", "contacts"] as const).map((item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "min-h-11 flex-1 text-sm font-semibold capitalize",
                tab === item
                  ? "border-b-2 border-[var(--eavi-primary-text)] text-[var(--eavi-on-bg)]"
                  : "text-[var(--eavi-muted-text)]",
              )}
            >
              {item}
            </button>
          ))}
        </div>

        {tab === "chats" ? (
          <ChatListPanel
            rows={rows}
            activeId={activeId}
            onSelect={open}
            loading={loadingList}
          />
        ) : (
          <ContactsPanel onOpenPerson={openPerson} />
        )}
      </div>

      {/* Thread pane. */}
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden lg:flex")}>
        {active ? (
          <ThreadPanel
            conversationId={active.id}
            title={active.title}
            tick={active.other?.tick ?? null}
            photoThumbUrl={active.other?.photoThumbUrl ?? null}
            messages={messages}
            online={active.other ? socket.presence[active.other.userId]?.online : undefined}
            typingNames={typingNames}
            onSend={send}
            onBack={() => setActiveId(null)}
            onMarkRead={() => socket.markRead(active.id)}
            onTyping={(typing) => socket.setTypingState(active.id, typing)}
            onLoadOlder={() => history(active.id)}
            hasOlder={Boolean(older[active.id])}
            canSend
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold text-[var(--eavi-on-bg)]">Welcome, {viewerName.split(" ")[0]}</p>
            <p className="mt-1 max-w-xs text-xs text-[var(--eavi-muted-text)]">
              Pick a chat, or open Contacts to find anyone in the school.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
