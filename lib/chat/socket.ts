import type { Server, Socket } from "socket.io";

import { SESSION_COOKIE } from "@/lib/auth";
import {
  ChatError,
  chatUserFromToken,
  canPost,
  isStaff,
  membershipFor,
  type ChatUser,
} from "@/lib/chat/access";
import { recipientsOf } from "@/lib/chat/conversations";
import {
  ONLINE_WINDOW_MS,
  hasLiveSocket,
  lastActivityFor,
  socketConnected,
  socketDisconnected,
} from "@/lib/chat/presence";
import { markRead, sendMessage } from "@/lib/chat/messages";
import { prisma } from "@/lib/prisma";

/**
 * The real-time half of chat.
 *
 * Two rules hold everywhere in this file:
 *   1. The socket never trusts a claim. A room is joined only after the database confirms
 *      membership, and a send is refused unless the same confirmation succeeds again.
 *   2. Nothing personal is emitted. Messages carry a safe profile (name, thumbnail, role) and
 *      presence carries a user id and a timestamp.
 */

type AuthedSocket = Socket & {
  data: {
    user: ChatUser;
    rooms: Set<string>;
  };
};

/** A user's live sockets, so a message can be delivered to every device they are using. */
const socketsByUser = new Map<string, Set<string>>();

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const index = part.indexOf("=");
      if (index < 0) return [];
      return [[part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())]];
    }),
  );
}

/** Users who have turned last-seen off must never have a timestamp broadcast. */
async function sharesPresence(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { showLastSeen: true },
  });
  return row?.showLastSeen ?? true;
}

export function attachChat(io: Server) {
  /*
   * The handshake reads the portal's own session cookie. There is no second login and no token
   * in a query string to leak into a log.
   */
  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const user = await chatUserFromToken(cookies[SESSION_COOKIE]);
      if (!user) return next(new Error("Unauthorized"));
      (socket as AuthedSocket).data.user = user;
      (socket as AuthedSocket).data.rooms = new Set();
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (raw) => {
    const socket = raw as AuthedSocket;
    const { user } = socket.data;

    // Every signed-in person has a room of their own, used to reach all their devices.
    socket.join(`user:${user.id}`);

    socketConnected(user.id);
    const owned = socketsByUser.get(user.id) ?? new Set<string>();
    owned.add(socket.id);
    socketsByUser.set(user.id, owned);

    /*
     * A socket makes presence immediate, but going offline is not the mirror of it: the person may
     * still have the fees page open in another tab. The database decides, and the client re-reads
     * presence when this event arrives.
     */
    io.emit("presence:update", { userId: user.id, online: true });

    /**
     * Joining a room is the only way to receive its traffic, and it is granted from the
     * database. A socket that guesses a conversation id gets nothing.
     */
    socket.on("chat:join", async (payload: { conversationId?: string }, ack?: CallableFunction) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return ack?.({ ok: false, error: "conversationId is required" });

      const member = await membershipFor(conversationId, user.id);
      if (!member) return ack?.({ ok: false, error: "Forbidden" });

      socket.join(`conv:${conversationId}`);
      socket.data.rooms.add(conversationId);

      // Walking into a room marks it read, which is what updates the sender's ticks.
      const read = await markRead(conversationId, user.id).catch(() => null);
      if (read) io.to(`conv:${conversationId}`).emit("chat:read", { conversationId, userId: user.id });

      ack?.({ ok: true, conversationId });
    });

    socket.on("chat:leave", (payload: { conversationId?: string }, ack?: CallableFunction) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return ack?.({ ok: false });
      socket.leave(`conv:${conversationId}`);
      socket.data.rooms.delete(conversationId);
      ack?.({ ok: true });
    });

    socket.on("chat:send", async (payload: unknown, ack?: CallableFunction) => {
      try {
        const message = await sendMessage(user, payload);

        /*
         * Sent to the room for people already looking at it, and to each recipient's personal
         * room for their other devices and for the unread badge. A recipient who happens to be
         * in both only receives it once per socket because Socket.IO deduplicates per socket.
         */
        io.to(`conv:${message.conversationId}`).emit("chat:message", message);

        const recipients = await recipientsOf(message.conversationId, user.id);
        for (const recipient of recipients) {
          io.to(`user:${recipient}`).emit("chat:message-notify", {
            conversationId: message.conversationId,
            message,
          });
        }

        ack?.({ ok: true, message });
      } catch (error) {
        const messageText =
          error instanceof ChatError ? error.message : "Could not send that message.";
        ack?.({ ok: false, error: messageText });
      }
    });

    socket.on("chat:typing", async (payload: { conversationId?: string; typing?: boolean }) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return;

      const member = await membershipFor(conversationId, user.id);
      if (!member) return;

      socket.to(`conv:${conversationId}`).emit("chat:typing", {
        conversationId,
        userId: user.id,
        typing: Boolean(payload.typing),
      });
    });

    socket.on("chat:read", async (payload: { conversationId?: string; messageId?: string }) => {
      const conversationId = String(payload?.conversationId ?? "");
      if (!conversationId) return;
      try {
        await markRead(conversationId, user.id, payload.messageId);
        io.to(`conv:${conversationId}`).emit("chat:read", { conversationId, userId: user.id });
      } catch {
        // Not a member, or the message is gone: nothing to announce.
      }
    });

    /**
     * Reconnect catch-up. The client says the last message it holds; it gets everything after
     * that, in order, exactly once.
     */
    socket.on(
      "chat:catchup",
      async (
        payload: { rooms?: Array<{ conversationId: string; afterId?: string }> },
        ack?: CallableFunction,
      ) => {
        const rooms = Array.isArray(payload?.rooms) ? payload.rooms.slice(0, 50) : [];
        const result: Record<string, unknown[]> = {};

        for (const room of rooms) {
          const conversationId = String(room?.conversationId ?? "");
          const member = await membershipFor(conversationId, user.id);
          if (!member) continue;

          const after = room.afterId
            ? await prisma.message.findUnique({
                where: { id: String(room.afterId) },
                select: { createdAt: true },
              })
            : null;

          const rows = await prisma.message.findMany({
            where: {
              conversationId,
              ...(after ? { createdAt: { gt: after.createdAt } } : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 200,
          });
          result[conversationId] = rows.map((row) => row.id);
        }

        ack?.({ ok: true, rooms: result });
      },
    );

    socket.on("disconnect", async () => {
      socketDisconnected(user.id);
      const owned = socketsByUser.get(user.id);
      owned?.delete(socket.id);
      if (owned && owned.size === 0) socketsByUser.delete(user.id);

      /*
       * Closing the chat tab does not mean leaving the portal. The person is still signed in and
       * may be reading another page, so presence is read back from the database rather than
       * declared offline here. Only if they have gone quiet does this report them away.
       */
      const stillHere = hasLiveSocket(user.id);
      const lastSeen = (await lastActivityFor([user.id]).catch(() => new Map())).get(user.id) ?? null;

      if (stillHere) return;
      if (lastSeen && Date.now() - lastSeen.getTime() < ONLINE_WINDOW_MS) return;

      const visible = await sharesPresence(user.id).catch(() => true);
      if (!visible) return;

      io.emit("presence:update", {
        userId: user.id,
        online: false,
        lastSeenAt: (lastSeen ?? new Date()).toISOString(),
      });
    });
  });
}

/** Who has a live socket right now. Used by the verification script, not for display. */
export function onlineUserIds(): string[] {
  return [...socketsByUser.keys()];
}

export { isStaff, canPost };
