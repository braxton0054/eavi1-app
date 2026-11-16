import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/notifications/api";

/**
 * The bell's feed: the latest notifications and the unread count, both scoped to the
 * signed-in user. Polled lightly by the bell, so the query is kept to two indexed reads.
 */
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        body: true,
        notificationType: true,
        targetUrl: true,
        isRead: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { recipientUserId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ items, unread });
}
