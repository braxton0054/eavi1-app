"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BellIcon } from "lucide-react";

import { disablePush, enablePush, pushStatus, pushSupported } from "@/lib/notifications/client";
import { useToast } from "@/components/ui/toast";
import {
  Menu,
  MenuContent,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";

import styles from "./notification-bell.module.css";

/**
 * The notification bell.
 *
 * It owns the whole in-app experience: the unread count, the history, marking read, the
 * device's push toggle, and per-kind mutes. The feed is polled lightly (45s, and on
 * return to the tab) — the portal's real-time convention, which needs no extra
 * infrastructure and behaves the same behind any office proxy.
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

const POLL_MS = 45_000;

function ago(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function NotificationBell() {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [busy, setBusy] = useState(false);
  const [push, setPush] = useState<{ permission: string; subscribed: boolean }>({
    permission: "default",
    subscribed: false,
  });
  const [muted, setMuted] = useState<string[]>([]);

  // The newest id seen: toasts fire only for rows that arrive after this.
  const newestSeen = useRef<string | null>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as { items: NotificationItem[]; unread: number };

      setItems(data.items);
      setUnread(data.unread);

      const newest = data.items[0]?.id ?? null;
      if (newest && newest !== newestSeen.current) {
        const incoming = data.items.find((item) => item.id === newest && !item.isRead);
        if (!firstLoad.current && incoming && document.hidden) {
          // Real-time in-app toast: the person is on another tab, so the portal
          // surfaces what arrived instead of waiting for the bell to be opened.
          toast({ title: incoming.title, description: incoming.body, variant: "info" });
        }
        newestSeen.current = newest;
      }
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

  const openBell = () => {
    void refresh();
    void pushStatus().then(setPush);
    void fetch("/api/notifications/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { mutedTypes: [] }))
      .then((d) => setMuted(d.mutedTypes ?? []))
      .catch(() => undefined);
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
    <Menu>
      <MenuTrigger asChild>
        <button type="button" className={styles.bell} aria-label={`Notifications, ${unread} unread`} onClick={openBell}>
          <BellIcon aria-hidden="true" />
          {unread > 0 && <span className={styles.badge}>{unread > 99 ? "99+" : unread}</span>}
        </button>
      </MenuTrigger>

      <MenuContent align="end" style={{ width: "min(92vw, 380px)" }}>
        <MenuLabel>
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            Notifications
            {unread > 0 && (
              <button
                type="button"
                onClick={() => void markRead()}
                style={{ marginLeft: "auto", fontSize: "var(--text-xs)", cursor: "pointer" }}
              >
                Mark all as read
              </button>
            )}
          </span>
        </MenuLabel>
        <MenuSeparator />

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

        <MenuSeparator />
        <MenuLabel>Push notifications</MenuLabel>
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
                disabled={muted === null}
              />
            </label>
          ))}
        </div>
      </MenuContent>
    </Menu>
  );
}
