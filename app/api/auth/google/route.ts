import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/landing";
import {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  authorizeUrl,
  callbackUrl,
  googleConfigured,
  publicOrigin,
} from "@/lib/oauth/google";

export const dynamic = "force-dynamic";

/**
 * Step one of "Sign in with Google".
 *
 * The whole of the state handling lives here and in the callback: a random nonce is minted,
 * stashed in an httpOnly cookie and sent to Google as `state`. Google echoes it back, and the
 * callback refuses to continue unless the two match — that is what stops an attacker from
 * making a victim's browser complete a sign-in the attacker started (login CSRF).
 *
 * The `next` path travels inside the cookie rather than in the URL, so it is never sent to
 * Google and cannot be tampered with on the way back.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);

  // A deployment with no Google client should say so rather than bounce through a broken page.
  if (!googleConfigured()) {
    const target = new URL("/login", origin);
    target.searchParams.set("error", "unconfigured");
    return NextResponse.redirect(target);
  }

  const state = randomBytes(32).toString("base64url");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  const response = NextResponse.redirect(
    authorizeUrl({ state, redirectUri: callbackUrl(origin) }),
  );

  response.cookies.set(OAUTH_STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    // `lax` is what lets the cookie survive Google's cross-site redirect back to us.
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  return response;
}
