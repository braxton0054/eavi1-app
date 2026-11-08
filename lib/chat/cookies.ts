import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth";
import { chatUserFromToken, type ChatUser } from "@/lib/chat/access";

/**
 * The API routes' caller, read from the portal's own session cookie.
 *
 * Kept apart from access.ts so that the socket server, which authenticates from the handshake
 * header, never has to load Next's request-scoped `cookies()`.
 */
export async function chatUserFromCookies(): Promise<ChatUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return chatUserFromToken(token);
}
