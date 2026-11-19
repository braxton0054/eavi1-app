"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { BellIcon } from "lucide-react";

import { disablePush, enablePush, pushStatus, pushSupported } from "@/lib/notifications/client";
import { useToast } from "@/components/ui/toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import styles from "./notification-bell.module.css";

/**
 * The notification bell.
 *
 * It owns the whole in-app experience: the unread count, the history, marking read, the
 * device's push toggle, and per-kind mutes. The feed is polled lightly (45s, and on
 * return to the tab) — the portal's real-time convention, which needs no extra
 * infrastructure and behaves the same behind any office proxy.
 *
 * It is a non-modal Popover rather than the kit's DropdownMenu: the menu variant is
 * modal — it locks the body while open — and this panel's rows are working controls
 * (mark read, toggles) that the user must be able to mix with the page behind.
 */

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  notificationType: string;
  targetUrl: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPES = [
  ["announcement", "Announcements"],
  ["fee", "Fees"],
  ["result", "Results"],
  ["chat", "Messages"],
] as const;

const POLL_MS = 15_000;

function ago(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const toast = useToast();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState<{ permission: string; subscribed: boolean }>({
    permission: "default",
    subscribed: false,
  });
  const [muted, setMuted] = useState<string[]>([]);

  // Ids already shown: a toast fires for a row the moment it first appears, whether the
  // person is on this tab or on another one. Keeping the set (rather than just the newest
  // id) means a burst of notifications is never silently swallowed between two polls.
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { items: NotificationItem[]; unread: number };

      setItems(data.items);
      setUnread(data.unread);

      const incoming = data.items.find((item) => !item.isRead && !seenIds.current.has(item.id));
      if (!firstLoad.current && incoming) {
        // A live popup like a notice arriving: show it as soon as the poll sees it,
        // regardless of whether the tab is in focus. The first load only seeds the set.
        toast({ title: incoming.title, description: incoming.body, variant: "info" });
      }
      for (const item of data.items) seenIds.current.add(item.id);
      firstLoad.current = false;
    } catch {
      // A poll that fails stays silent — the next one is 45 seconds away.
    }
  }, [toast]);

  useEffect(() => {
    // First load rides a callback too (same as every poll after it), so the effect
    // body itself never sets state.
    const initial = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Any navigation closes the panel: a notification list has nothing to do with the
  // page the person just moved to, and a stuck popover steals clicks from the new page.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    if (pathnameRef.current !== pathname) {
      pathnameRef.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  const openBell = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      void refresh();
      void pushStatus().then(setPush);
      void fetch("/api/notifications/preferences", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { mutedTypes: [] }))
        .then((d) => setMuted(d.mutedTypes ?? []))
        .catch(() => undefined);
    }
  };

  const markRead = async (ids?: string[]) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ids ? { ids } : { all: true }),
    });
    void refresh();
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.isRead) void markRead([item.id]);
    setOpen(false);
    if (item.targetUrl && item.targetUrl.startsWith("/")) {
      // A hard navigation: the portal re-renders the target page with the session intact.
      window.location.assign(item.targetUrl);
    }
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      if (push.subscribed) {
        const result = await disablePush();
        if (result.ok) {
          setPush((p) => ({ ...p, subscribed: false }));
          toast({ title: "Notifications off on this device", variant: "default" });
        } else {
          toast({ title: result.reason ?? "Could not turn notifications off", variant: "error" });
        }
      } else {
        const result = await enablePush();
        if (result.ok) {
          setPush((p) => ({ ...p, permission: "granted", subscribed: true }));
          toast({ title: "Notifications on for this device", variant: "success" });
        } else {
          toast({ title: result.reason ?? "Could not enable notifications", variant: "warning" });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleType = async (type: string) => {
    const next = muted.includes(type) ? muted.filter((t) => t !== type) : [...muted, type];
    setMuted(next);
    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mutedTypes: next }),
    });
  };

  const statusLine = !pushSupported()
    ? "Push is not supported on this browser."
    : push.subscribed
      ? "On for this device."
      : push.permission === "denied"
        ? "Blocked in browser settings."
        : "Off for this device.";

  return (
    <Popover open={open} onOpenChange={openBell}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={styles.bell}
          aria-label={`Notifications, ${unread} unread`}
          aria-expanded={open}
        >
          <BellIcon aria-hidden="true" />
          {unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} style={{ width: "min(92vw, 380px)" }}>
        <div className={styles.head} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2) var(--space-3) 0" }}>
          <strong style={{ fontSize: "var(--text-sm)" }}>Notifications</strong>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markRead()}
              style={{ marginLeft: "auto", fontSize: "var(--text-xs)", cursor: "pointer" }}
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className={styles.feed} role="feed">
          {items.length === 0 ? (
            <p className={styles.empty}>Nothing yet — notices, results and fee updates land here.</p>
          ) : (
            items.map((item) => (
              <button key={item.id} type="button" className={styles.item} onClick={() => void openItem(item)}>
                <span className={styles.itemHead}>
                  {!item.isRead && <span className={styles.dot} aria-label="unread" />}
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemTime}>{ago(item.createdAt)}</span>
                </span>
                <span className={styles.itemBody}>{item.body}</span>
              </button>
            ))
          )}
        </div>

        <div className={styles.push}>
          <div className={styles.toggleRow}>
            <span className={styles.pushStatus}>{statusLine}</span>
            <button type="button" onClick={() => void togglePush()} disabled={busy} style={{ cursor: "pointer" }}>
              {busy ? <span className={styles.spinner} aria-hidden="true" /> : push.subscribed ? "Disable" : "Enable"}
            </button>
          </div>

          {TYPES.map(([type, label]) => (
            <label key={type} className={styles.toggleRow}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={!muted.includes(type)}
                onChange={() => void toggleType(type)}
              />
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
