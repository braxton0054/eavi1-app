import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/notifications/api";

/**
 * What this person does not want to hear about — a mute list of notification types,
 * held per person. The service reads it before sending, so a muted kind never becomes
 * a push or an unread dot; the history rows it already has stay.
 */

const KNOWN_TYPES = ["announcement", "fee", "result", "chat"] as const;

export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
    select: { mutedTypes: true },
  });

  return NextResponse.json({ mutedTypes: prefs?.mutedTypes ?? [] });
}

export async function PUT(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { mutedTypes?: unknown } | null;
  const mutedTypes = Array.isArray(body?.mutedTypes)
    ? [...new Set(body.mutedTypes.filter((t): t is (typeof KNOWN_TYPES)[number] =>
        typeof t === "string" && (KNOWN_TYPES as readonly string[]).includes(t),
      ))]
    : null;

  if (!mutedTypes) {
    return NextResponse.json({ error: "That preference list makes no sense." }, { status: 400 });
  }

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: { mutedTypes },
    create: { userId: user.id, mutedTypes },
    select: { mutedTypes: true },
  });

  return NextResponse.json({ mutedTypes: prefs.mutedTypes });
}
