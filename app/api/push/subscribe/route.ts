import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sessionUser } from "@/lib/notifications/api";

/**
 * Device subscription management.
 *
 * A subscription is the browser's own record — it is created only for the signed-in user
 * holding the cookie, and a user can only ever list or remove their own rows. The
 * endpoint is unique, so a re-subscription (a permission re-grant, a new key) updates the
 * row it already has rather than piling up duplicates.
 */

const text = (value: unknown, max: number) =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : null;

/** Body: { endpoint, keys: { p256dh, auth } } — exactly what pushManager.subscribe gave. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
    deviceName?: unknown;
  } | null;

  const endpoint = text(body?.endpoint, 2048);
  const p256dh = text(body?.keys?.p256dh, 256);
  const auth = text(body?.keys?.auth, 256);
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "That subscription is incomplete." }, { status: 400 });
  }

  const deviceName = text(body?.deviceName, 120);
  const userAgent = request.headers.get("user-agent")?.slice(0, 400) ?? null;

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: {
      // A browser can mint a new key pair for the same endpoint; the row must hold the
      // current pair or every later push would be rejected.
      p256dh,
      auth,
      userId: user.id,
      deviceName,
      userAgent,
      lastUsedAt: new Date(),
    },
    create: { endpoint, p256dh, auth, userId: user.id, deviceName, userAgent },
  });

  return NextResponse.json({ id: subscription.id });
}

/** Body: { endpoint } — removes this device only, and only from this user. */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = text(body?.endpoint, 2048);
  if (!endpoint) {
    return NextResponse.json({ error: "Which device?" }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}

/** The signed-in user's registered devices. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      endpoint: true,
      deviceName: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json({
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      // The endpoint is the row's identity; a client matches its own device against it.
      endpoint: s.endpoint,
      deviceName: s.deviceName,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
    })),
  });
}
