import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/notifications/api";

/** Body: { ids?: string[], all?: true } — mark some, or all, of my notifications read. */
export async function POST(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    ids?: unknown;
    all?: unknown;
  } | null;

  // The recipient is always the session, so a posted id that is not one of theirs
  // simply matches nothing — one user cannot reach another's rows.
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
    : [];

  const result = await prisma.notification.updateMany({
    where: {
      recipientUserId: user.id,
      isRead: false,
      ...(body?.all === true ? {} : ids.length > 0 ? { id: { in: ids } } : { id: "none" }),
    },
    data: { isRead: true },
  });

  return NextResponse.json({ marked: result.count });
}
