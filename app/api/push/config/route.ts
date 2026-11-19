import { NextResponse, type NextRequest } from "next/server";

import { sessionUser } from "@/lib/notifications/api";

/**
 * The public VAPID key for the browser's push subscription call.
 *
 * It is public by design (the push service needs it too), but the endpoint still sits
 * behind a session so the college's push identity is not handed to every passing bot.
 * Serving it at runtime avoids depending on a NEXT_PUBLIC_ value being inlined at build
 * time — easy to lose in a container, which left the bell saying "not configured".
 */
export async function GET(request: NextRequest) {
  const user = await sessionUser(request);
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  if (!publicKey) {
    return NextResponse.json({ error: "Notifications are not configured on the server." }, { status: 503 });
  }

  return NextResponse.json({ publicKey });
}
