"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/chat/chat-avatar";
import { VerifiedBadge } from "@/components/chat/verified-badge";
import type { ChatMessage } from "@/hooks/use-chat-socket";
import { cn } from "@/lib/utils";

/**
 * One conversation.
 *
 * Reading order matters more than anything else here: history comes back newest-last, the view
 * sticks to the bottom while you are at the bottom, and a "jump to latest" button appears the
 * moment you scroll away so a new message is never silently appended below the fold.
 */

function timeLabel(value: string): string {
  return new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Own messages show a small grey double tick, distinct from the coloured verified ticks. */
function MessageStatus({ message }: { message: ChatMessage }) {
  if (message.failed) return <span className="text-[var(--eavi-destructive)]">Not sent</span>;
  if (message.pending) return <span className="text-[var(--eavi-muted-text)]">Sending…</span>;

  const read = message.receipts?.some((receipt) => receipt.readAt);
  return (
    <span className="inline-flex items-center gap-0.5 text-[var(--eavi-muted-text)]" title={read ? "Read" : "Sent"}>
      <svg width="14" height="10" viewBox="0 0 20 12" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M1 6.5l3.2 3.2L11 3" />
        <path d={read ? "M7.4 9.7L13.4 3" : "M13.4 9.7L19.3 3"} opacity={read ? 1 : 0.9} />
      </svg>
      <span className="sr-only">{read ? "Read" : "Sent"}</span>
    </span>
  );
}

export function ThreadPanel({
  conversationId,
  title,
  tick,
  photoThumbUrl,
  messages,
  online,
  typingNames,
  onSend,
  onBack,
  onMarkRead,
  onTyping,
  onLoadOlder,
  hasOlder,
  disabledReason,
  canSend,
}: {
  conversationId: string;
  title: string;
  tick: "admin" | "tutor" | "student" | null;
  photoThumbUrl: string | null;
  messages: ChatMessage[];
  online?: boolean;
  typingNames: string[];
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
  onMarkRead: () => void;
  onTyping: (typing: boolean) => void;
  onLoadOlder: () => Promise<void>;
  hasOlder: boolean;
  disabledReason?: string | null;
  canSend: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTyping = useRef(false);

  // Stay pinned to the newest message unless the reader has deliberately scrolled up.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !atBottom) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, atBottom]);

  useEffect(() => {
    onMarkRead();
    // Only on entering the conversation; later reads happen as messages arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    setAtBottom(distance < 80);

    // Fetching older history when the top is reached keeps the scroll position stable because
    // the browser anchors on what is already rendered above.
    if (node.scrollTop < 60 && hasOlder) void onLoadOlder();
  };

  const handleDraft = (value: string) => {
    setDraft(value);

    // One "started" and one "stopped" event per burst, not one per keystroke.
    if (value && !wasTyping.current) {
      wasTyping.current = true;
      onTyping(true);
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (wasTyping.current) {
        wasTyping.current = false;
        onTyping(false);
      }
    }, 1800);
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || !canSend) return;
    setDraft("");
    if (wasTyping.current) {
      wasTyping.current = false;
      onTyping(false);
    }
    await onSend(body);
    setAtBottom(true);
  };

  /*
   * Which messages open a new day, computed once from the list. Tracking this with a variable
   * mutated during render breaks under StrictMode's double render and under React's concurrent
   * rendering, where a render can be thrown away and replayed.
   */
  const dayStarts = messages.map((message, index) => {
    const day = dayLabel(message.createdAt);
    return index === 0 || day !== dayLabel(messages[index - 1].createdAt) ? day : null;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--eavi-border)] p-2">
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 min-w-11 rounded-lg text-[var(--eavi-primary-text)] lg:hidden"
          aria-label="Back to chats"
        >
          ←
        </button>
        <ChatAvatar name={title} photoThumbUrl={photoThumbUrl} size={36} online={online} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-[var(--eavi-on-bg)]">{title}</span>
            {tick ? <VerifiedBadge role={tick} size="sm" /> : null}
          </div>
          <p className="truncate text-xs text-[var(--eavi-muted-text)]">
            {typingNames.length > 0
              ? `${typingNames.join(", ")} ${typingNames.length === 1 ? "is" : "are"} typing…`
              : online === undefined
                ? ""
                : online
                  ? "Online"
                  : "Offline"}
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {hasOlder ? (
          <div className="py-2 text-center">
            <button
              type="button"
              onClick={() => void onLoadOlder()}
              className="min-h-11 rounded-lg border border-[var(--eavi-border)] px-3 text-xs text-[var(--eavi-primary-text)]"
            >
              Load earlier messages
            </button>
          </div>
        ) : null}

        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--eavi-muted-text)]">
            No messages yet. Say hello.
          </p>
        ) : null}

        {messages.map((message, index) => {
          const mine = message.mine ?? false;
          const day = dayStarts[index];

          return (
            <div key={message.id}>
              {day ? (
                <div className="my-3 flex items-center gap-2">
                  <span className="h-px flex-1 bg-[var(--eavi-border)]" />
                  <span className="text-[11px] uppercase tracking-wide text-[var(--eavi-muted-text)]">{day}</span>
                  <span className="h-px flex-1 bg-[var(--eavi-border)]" />
                </div>
              ) : null}

              <div className={cn("mb-1.5 flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm sm:max-w-[75%]",
                    mine
                      ? "bg-[var(--eavi-fill)] text-[var(--eavi-on-fill)]"
                      : "bg-[var(--eavi-muted)] text-[var(--eavi-on-bg)]",
                    message.failed && "opacity-70",
                  )}
                >
                  {!mine && message.sender ? (
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="text-xs font-semibold">{message.sender.name}</span>
                      <VerifiedBadge role={message.sender.tick} size="sm" />
                    </div>
                  ) : null}

                  <p className={cn("whitespace-pre-wrap break-words", message.deleted && "italic opacity-70")}>
                    {message.deleted ? "This message was deleted." : message.body}
                  </p>

                  <div className={cn("mt-0.5 flex items-center gap-1 text-[10px]", mine ? "justify-end" : "")}>
                    <span className="opacity-80">{timeLabel(message.createdAt)}</span>
                    {mine ? <MessageStatus message={message} /> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!atBottom ? (
        <button
          type="button"
          onClick={() => setAtBottom(true)}
          className="mx-auto -mt-12 mb-2 min-h-11 rounded-full bg-[var(--eavi-fill)] px-4 text-xs font-semibold text-[var(--eavi-on-fill)] shadow"
        >
          Jump to latest ↓
        </button>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="border-t border-[var(--eavi-border)] p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {disabledReason ? (
          <p className="mb-2 text-xs text-[var(--eavi-warn-text)]">{disabledReason}</p>
        ) : null}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => handleDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends on a desktop keyboard; Shift+Enter is a new line.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            maxLength={2000}
            disabled={!canSend}
            placeholder={canSend ? "Write a message" : "You cannot post here"}
            aria-label="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-[var(--eavi-border)] bg-[var(--eavi-muted)] px-3 py-2.5 text-sm text-[var(--eavi-on-bg)] placeholder:text-[var(--eavi-muted-text)] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canSend || draft.trim().length === 0}
            className="min-h-11 min-w-11 rounded-xl bg-[var(--eavi-primary)] px-4 text-sm font-semibold text-[var(--eavi-on-bg)] disabled:opacity-50"
          >
            Send
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[var(--eavi-muted-text)]">
          Be respectful. Admins can review reported messages.
        </p>
      </form>
    </div>
  );
}
