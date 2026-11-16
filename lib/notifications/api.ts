import type { NextRequest } from "next/server";
import { Status } from "@/generated/prisma/enums";

import { resolveSession, SESSION_COOKIE } from "@/lib/auth";

/**
 * Who is calling a notification API route.
 *
 * The same rule the chat routes use: the session cookie is resolved on every request,
 * and a disabled account is refused even with a cookie still in hand. Routes under
 * /api never trust a user id from the body — the caller is the session.
 */
export async function sessionUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await resolveSession(token);
  if (!user || user.status !== Status.ACTIVE) return null;
  return user;
}
