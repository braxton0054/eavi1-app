import { NextResponse } from "next/server";

import { sweepExpiredAttachments } from "@/lib/chat/attachments";

export const dynamic = "force-dynamic";

/**
 * Scheduled cleanup, callable over HTTP.
 *
 * For hosts where cron cannot reach the container — a platform scheduler that only knows how to
 * call a URL. It is guarded by a shared secret in `CHAT_SWEEP_TOKEN`; without that variable set
 * the endpoint refuses everything rather than defaulting open, so a missing secret can never turn
 * into an unauthenticated delete.
 */
export async function POST(request: Request) {
  const expected = process.env.CHAT_SWEEP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: "Scheduled cleanup is not configured." },
      { status: 503 },
    );
  }

  const provided =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("token") ??
    "";

  // Length-independent comparison, so a wrong token does not leak its length through timing.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const result = await sweepExpiredAttachments();
  return NextResponse.json({ ok: true, ...result });
}

function timingSafeEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
