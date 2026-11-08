"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import type { TickRole } from "@/components/chat/verified-badge";

/**
 * The client half of the socket.
 *
 * One connection for the whole tab, opened on first use and reused. Messages are keyed by id in
 * a Map so a message that arrives twice — once live, once in a catch-up — is stored once, which
 * is what makes reconnect exactly-once from the reader's point of view.
 */

export type ChatPerson = {
  userId: string;
  name: string;
  photoThumbUrl: string | null;
  role: string;
  tick: TickRole;
};

export type ChatAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  expiresAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  body: string;
  deleted?: boolean;
  senderId: string;
  sender: ChatPerson | null;
  createdAt: string;
  clientMessageId?: string | null;
  replyToId?: string | null;
  /** Set by the client from the viewer's own id; the server never needs to say who is "me". */
  mine?: boolean;
  /** Present only on the optimistic copy the sender made before the server answered. */
  pending?: boolean;
  failed?: boolean;
  receipts?: Array<{ userId: string; readAt: string | null; deliveredAt: string | null }>;
  attachments?: ChatAttachment[];
};

export type Presence = { online: boolean; lastSeenAt?: string };

export function useChatSocket(enabled: boolean) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({});
  const [typing, setTyping] = useState<Record<string, string[]>>({});
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [lastEvent, setLastEvent] = useState<ChatMessage | null>(null);

  const merge = useCallback((incoming: ChatMessage) => {
    setMessages((current) => {
      const list = current[incoming.conversationId] ?? [];
      const index = list.findIndex(
        (row) =>
          row.id === incoming.id ||
          (incoming.clientMessageId && row.clientMessageId === incoming.clientMessageId),
      );

      const next =
        index >= 0
          ? list.map((row, i) => (i === index ? { ...incoming, pending: false, failed: false } : row))
          : [...list, incoming];

      next.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { ...current, [incoming.conversationId]: next };
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    /*
     * The socket authenticates with the portal's own session cookie during the handshake, so
     * there is no token in a URL and no second login.
     */
    const socket = io({ path: "/socket.io", withCredentials: true, transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("chat:message", (message: ChatMessage) => {
      merge(message);
      setLastEvent(message);
    });

    socket.on("chat:message-notify", (payload: { message: ChatMessage }) => {
      merge(payload.message);
    });

    socket.on("chat:typing", (payload: { conversationId: string; userId: string; typing: boolean }) => {
      setTyping((current) => {
        const list = new Set(current[payload.conversationId] ?? []);
        if (payload.typing) list.add(payload.userId);
        else list.delete(payload.userId);
        return { ...current, [payload.conversationId]: [...list] };
      });
    });

    socket.on("presence:update", (payload: { userId: string; online: boolean; lastSeenAt?: string }) => {
      setPresence((current) => ({
        ...current,
        [payload.userId]: { online: payload.online, lastSeenAt: payload.lastSeenAt ?? current[payload.userId]?.lastSeenAt },
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, merge]);

  const join = useCallback((conversationId: string) => {
    socketRef.current?.emit("chat:join", { conversationId });
  }, []);

  const leave = useCallback((conversationId: string) => {
    socketRef.current?.emit("chat:leave", { conversationId });
  }, []);

  const markRead = useCallback((conversationId: string, messageId?: string) => {
    socketRef.current?.emit("chat:read", { conversationId, messageId });
  }, []);

  const setTypingState = useCallback((conversationId: string, isTyping: boolean) => {
    socketRef.current?.emit("chat:typing", { conversationId, typing: isTyping });
  }, []);

  const send = useCallback(
    (input: { conversationId: string; body: string; clientMessageId: string; replyToId?: string }) => {
      return new Promise<{ ok: boolean; error?: string }>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          // No socket: fall back to HTTP so a blocked WebSocket degrades instead of failing.
          fetch("/api/chat/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          })
            .then(async (response) => {
              const data = await response.json();
              if (data.ok && data.message) merge(data.message);
              resolve({ ok: Boolean(data.ok), error: data.error });
            })
            .catch(() => resolve({ ok: false, error: "Could not send that message." }));
          return;
        }

        socket.timeout(15_000).emit("chat:send", input, (error: Error | null, reply: { ok: boolean; error?: string }) => {
          resolve(error ? { ok: false, error: "Could not send that message." } : reply);
        });
      });
    },
    [merge],
  );

  /**
   * Shares a document. Multipart over HTTP rather than the socket: a socket payload would have
   * to carry the file's bytes, and the size and type limits belong on the server anyway.
   */
  const sendAttachment = useCallback(
    async (input: { conversationId: string; file: File; body: string; clientMessageId: string }) => {
      const form = new FormData();
      form.set("conversationId", input.conversationId);
      form.set("file", input.file);
      form.set("body", input.body);
      form.set("clientMessageId", input.clientMessageId);

      const pending = fetch("/api/chat/attachments", { method: "POST", body: form });
      const response = await pending;
      const data = await response.json().catch(() => null);

      if (data?.ok && data.message) {
        merge(data.message);
        return { ok: true as const };
      }
      return { ok: false as const, error: data?.error ?? "Could not share that file." };
    },
    [merge],
  );

  const addOptimistic = useCallback((message: ChatMessage) => {
    setMessages((current) => ({
      ...current,
      [message.conversationId]: [...(current[message.conversationId] ?? []), message],
    }));
  }, []);

  const markFailed = useCallback((conversationId: string, clientMessageId: string) => {
    setMessages((current) => ({
      ...current,
      [conversationId]: (current[conversationId] ?? []).map((row) =>
        row.clientMessageId === clientMessageId ? { ...row, pending: false, failed: true } : row,
      ),
    }));
  }, []);

  return useMemo(
    () => ({
      connected,
      messages,
      typing,
      presence,
      unreadTotal,
      lastEvent,
      join,
      leave,
      send,
      markRead,
      setTypingState,
      addOptimistic,
      markFailed,
      setUnreadTotal,
      merge,
      sendAttachment,
    }),
    [connected, messages, typing, presence, unreadTotal, lastEvent, join, leave, send, markRead, setTypingState, addOptimistic, markFailed, merge, sendAttachment],
  );
}
