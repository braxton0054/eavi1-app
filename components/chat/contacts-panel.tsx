"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatAvatar } from "@/components/chat/chat-avatar";
import { VerifiedBadge, TickLegend, type TickRole } from "@/components/chat/verified-badge";
import { cn } from "@/lib/utils";

/**
 * Contacts: the school phonebook.
 *
 * Rows are deliberately bare — a picture, a name and a tick — because that is all the server
 * is allowed to send. The order is random by default and stable for the whole visit: the seed
 * is chosen once and sent with every page, so scrolling can neither repeat nor skip a person.
 */

type Contact = {
  userId: string;
  name: string;
  photoThumbUrl: string | null;
  role: string;
  tick: TickRole;
  campusHint?: string;
  /** True while they are using the portal at all, not only the chat screen. */
  online?: boolean;
  /** "Online" or "Last seen 12 min ago". Absent when they have hidden their presence. */
  statusText?: string;
};

const TABS = [
  { id: "all", label: "Everyone" },
  { id: "admin", label: "Admins" },
  { id: "tutor", label: "Tutors" },
  { id: "student", label: "Students" },
] as const;

export function ContactsPanel({ onOpenPerson }: { onOpenPerson: (userId: string) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const [order, setOrder] = useState<"random" | "az">("random");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState<Contact[]>([]);
  const [cursor, setCursor] = useState<number | null>(0);
  const [loading, setLoading] = useState(true);
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000) + 1);
  const [total, setTotal] = useState<number | null>(null);
  const sentinel = useRef<HTMLLIElement | null>(null);

  // Typing is debounced so a name is searched once, not once per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (nextCursor: number, replace: boolean) => {
      const params = new URLSearchParams({
        order,
        seed: String(seed),
        cursor: String(nextCursor),
      });
      if (debounced) params.set("q", debounced);
      if (tab !== "all") params.set("role", tab);

      /*
       * Nothing here touches state synchronously. The effect that calls this would otherwise
       * force an extra render before the request left the browser; instead the first await
       * happens first and every update lands after it.
       */
      try {
        const response = await fetch(`/api/chat/contacts?${params}`);
        const data = await response.json();
        if (data.ok) {
          setRows((current) => (replace ? data.rows : [...current, ...data.rows]));
          setCursor(data.nextCursor);
          if (typeof data.total === "number") setTotal(data.total);
        }
      } finally {
        setLoading(false);
      }
    },
    [debounced, order, seed, tab],
  );

  /*
   * A changed filter starts again from the top. The reset happens inside the loader rather than
   * synchronously in this effect: setting state during an effect forces an extra render pass
   * before the fetch even begins, which the lint rules flag and which makes the list flicker.
   */
  useEffect(() => {
    void load(0, true);
  }, [load]);

  // Infinite scroll: the next page is fetched when the sentinel comes into view.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || cursor === null || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void load(cursor, false);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loading, load]);

  const startRandom = async () => {
    const response = await fetch("/api/chat/contacts?random=1");
    const data = await response.json();
    if (data.ok && data.person) onOpenPerson(data.person.userId);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--eavi-border)] p-3">
        <div className="flex items-center justify-between gap-2 pb-2">
          <p className="text-sm font-semibold text-[var(--eavi-on-bg)]">
            Contacts {total !== null ? <span className="font-normal text-[var(--eavi-muted-text)]">({total})</span> : null}
          </p>
          <button
            type="button"
            onClick={() => setOrder((current) => (current === "random" ? "az" : "random"))}
            className="min-h-11 rounded-lg border border-[var(--eavi-border)] px-3 text-xs font-medium text-[var(--eavi-primary-text)]"
          >
            {order === "random" ? "Random order" : "A to Z"}
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          aria-label="Search contacts by name"
          className="min-h-11 w-full rounded-lg border border-[var(--eavi-border)] bg-[var(--eavi-muted)] px-3 text-sm text-[var(--eavi-on-bg)] placeholder:text-[var(--eavi-muted-text)]"
        />

        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-pressed={tab === item.id}
              className={cn(
                "min-h-11 shrink-0 rounded-lg px-3 text-xs font-medium",
                tab === item.id
                  ? "bg-[var(--eavi-fill)] text-[var(--eavi-on-fill)]"
                  : "border border-[var(--eavi-border)] text-[var(--eavi-muted-text)]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={startRandom}
          className="mt-2 min-h-11 w-full rounded-lg bg-[var(--eavi-primary)] px-3 text-sm font-semibold text-[var(--eavi-on-bg)]"
        >
          Message someone random
        </button>

        <TickLegend className="mt-3" />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {rows.map((contact) => (
          <li key={contact.userId}>
            <button
              type="button"
              onClick={() => onOpenPerson(contact.userId)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-[var(--eavi-border)] px-3 py-2 text-left active:bg-[var(--eavi-muted)]"
            >
              <ChatAvatar name={contact.name} photoThumbUrl={contact.photoThumbUrl} size={40} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium text-[var(--eavi-on-bg)]">{contact.name}</span>
                  <VerifiedBadge role={contact.tick} size="sm" />
                </span>
                {/*
                  * Presence wins over the campus hint. The hint exists only to tell two people
                  * with the same name apart; whether someone is around is more useful day to day.
                */}
                {contact.statusText ? (
                  <span
                    className={cn(
                      "block truncate text-xs",
                      contact.online
                        ? "font-medium text-[var(--eavi-tick-student)]"
                        : "text-[var(--eavi-muted-text)]",
                    )}
                  >
                    {contact.statusText}
                  </span>
                ) : contact.campusHint ? (
                  <span className="block truncate text-xs text-[var(--eavi-muted-text)]">{contact.campusHint}</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}

        {loading ? (
          <li className="space-y-2 p-3" aria-busy="true">
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--eavi-muted)]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--eavi-muted)]" />
              </div>
            ))}
          </li>
        ) : null}

        {!loading && rows.length === 0 ? (
          <li className="p-6 text-center text-sm text-[var(--eavi-muted-text)]">
            {debounced ? `Nobody here matches “${debounced}”.` : "No contacts to show yet."}
          </li>
        ) : null}

        <li ref={sentinel} className="h-1" aria-hidden="true" />
      </ul>
    </div>
  );
}
