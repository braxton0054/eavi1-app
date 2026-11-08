"use client";

import { ChatAvatar } from "@/components/chat/chat-avatar";
import { VerifiedBadge, type TickRole } from "@/components/chat/verified-badge";
import { cn } from "@/lib/utils";

/**
 * The chat list. One row per conversation: photo, name and tick, the last line of what was
 * said, when, and how much of it is unread.
 */
export type ConversationRow = {
  id: string;
  type: "DIRECT" | "CLASS" | "GROUP";
  title: string;
  unread: number;
  updatedAt: string;
  preview: { body: string; createdAt: string; mine: boolean } | null;
  other: { userId: string; name: string; photoThumbUrl: string | null; tick: TickRole } | null;
  memberCount: number;
};

function shortTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function ChatListPanel({
  rows,
  activeId,
  onSelect,
  loading,
}: {
  rows: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2 p-3" aria-busy="true">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--eavi-muted)]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--eavi-muted)]" />
              <div className="h-2.5 w-48 animate-pulse rounded bg-[var(--eavi-muted)]" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm font-medium text-[var(--eavi-on-bg)]">No chats yet</p>
        <p className="mt-1 text-xs text-[var(--eavi-muted-text)]">
          Open Contacts to find someone and start a conversation.
        </p>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {rows.map((row) => {
        const active = row.id === activeId;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex min-h-16 w-full items-center gap-3 border-b border-[var(--eavi-border)] px-3 py-2 text-left",
                active ? "bg-[var(--eavi-muted)]" : "active:bg-[var(--eavi-muted)]",
              )}
            >
              <ChatAvatar
                name={row.title}
                photoThumbUrl={row.other?.photoThumbUrl ?? null}
                size={44}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-[var(--eavi-on-bg)]">{row.title}</span>
                  {row.other ? <VerifiedBadge role={row.other.tick} size="sm" /> : null}
                  {row.type === "CLASS" ? (
                    <span className="shrink-0 rounded bg-[var(--eavi-primary-soft)] px-1.5 text-[10px] uppercase tracking-wide text-[var(--eavi-primary-text)]">
                      Class
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-[var(--eavi-muted-text)]">
                  {row.preview ? (
                    <>
                      {row.preview.mine ? <span className="shrink-0">You:</span> : null}
                      <span className="truncate">{row.preview.body || "Message deleted"}</span>
                    </>
                  ) : (
                    <span className="truncate italic">No messages yet</span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-[11px] text-[var(--eavi-muted-text)]">{shortTime(row.updatedAt)}</span>
                {row.unread > 0 ? (
                  <span className="min-w-5 rounded-full bg-[var(--eavi-tick-admin)] px-1.5 text-center text-[11px] font-bold text-[#1a2340]">
                    {row.unread > 99 ? "99+" : row.unread}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
