import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { landingFor, safeNextPath } from "@/lib/landing";
import { prisma } from "@/lib/prisma";
import { enforceOAuthRateLimit } from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import {
  OAUTH_STATE_COOKIE,
  callbackUrl,
  exchangeCode,
  googleConfigured,
  googleProfile,
  publicOrigin,
} from "@/lib/oauth/google";

export const dynamic = "force-dynamic";

/** Length-independent comparison, so a wrong state does not leak its prefix through timing. */
function stateMatches(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Step two: Google returns here with a code.
 *
 * Everything that decides who is signing in happens on this side. The token exchange uses
 * the client secret, the profile comes from Google rather than the query string, and the
 * result is a row in the same `sessions` table and the same `eavi_session` cookie the
 * password form produces — so `resolveSession()` and every role guard work unchanged, and
 * there is no second notion of "signed in" in the app.
 *
 * Sign-ins are not written to the audit log because password sign-ins are not either
 * (`app/api/auth/login/route.ts` writes nothing). Adding one here alone would make the log
 * a record of only half the ways into the system, which is worse than neither.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const { searchParams } = request.nextUrl;

  /** Back to the login page with a reason the page can turn into a sentence. */
  const refuse = (reason: string) => {
    const target = new URL("/login", origin);
    target.searchParams.set("error", reason);
    const response = NextResponse.redirect(target);
    // Single-use: the nonce must not survive a failed attempt.
    response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return response;
  };

  try {
    await enforceOAuthRateLimit(request);
  } catch (error) {
    return refuse(error instanceof RateLimitExceededError ? "throttled" : error instanceof RateLimitUnavailableError ? "unavailable" : "exchange");
  }

  if (!googleConfigured()) return refuse("unconfigured");

  // The person pressed "cancel", or Google itself reported a problem.
  if (searchParams.get("error")) return refuse("denied");

  const returnedState = searchParams.get("state");
  const code = searchParams.get("code");

  // ---- CSRF check -------------------------------------------------------
  const rawStateCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!rawStateCookie) return refuse("state");

  let expectedState: string | null = null;
  let nextPath: string | null = null;
  try {
    const parsed = JSON.parse(rawStateCookie) as { state?: unknown; next?: unknown };
    expectedState = typeof parsed.state === "string" ? parsed.state : null;
    nextPath = safeNextPath(typeof parsed.next === "string" ? parsed.next : null);
  } catch {
    expectedState = null;
  }

  if (!expectedState || !returnedState || !stateMatches(expectedState, returnedState)) {
    return refuse("state");
  }

  if (!code) return refuse("exchange");

  // ---- prove the identity, server side ----------------------------------
  const accessToken = await exchangeCode(code, callbackUrl(origin));
  if (!accessToken) return refuse("exchange");

  const profile = await googleProfile(accessToken);
  // Google said the address is not verified. An unverified address proves nothing, so it
  // can never claim an existing account.
  if (!profile) return refuse("unverified");

  const link = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: { provider: "google", providerAccountId: profile.subject },
    },
    include: { user: true },
  });

  let user = link?.user ?? null;

  if (!user) {
    /*
     * First Google sign-in for this address. It is allowed only when an EAVI account already
     * exists on that exact (lower-cased) email — the college issues accounts, Google does not
     * create them. Nothing here can mint a user, and no role is ever inferred from Google.
     */
    const existing = await prisma.user.findUnique({ where: { email: profile.email } });
    if (!existing) return refuse("noaccount");

    user = existing;

    // Remember the link so a later Google email change still resolves to this account: the
    // subject is stable, the address is not. `createMany` + skipDuplicates keeps two
    // simultaneous first sign-ins from colliding on the unique key.
    await prisma.oAuthAccount.createMany({
      data: [{ userId: existing.id, provider: "google", providerAccountId: profile.subject }],
      skipDuplicates: true,
    });
  }

  // ---- the same refusals the password form gives -------------------------
  if (user.status !== "ACTIVE") {
    return refuse(user.status === "PENDING" ? "pending" : "disabled");
  }

  const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);
  const token = await createSession(user.id, expiresAt);

  // A Google account has no portal password. If the college marked this account as still
  // needing one, the session exists but every other page stays shut until it is set.
  const destination = user.mustChangePassword ? "/set-password" : landingFor(user.role, nextPath);

  const response = NextResponse.redirect(new URL(destination, origin));

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // Matches the password form's default (a session, not "remember me").
    expires: expiresAt,
  });
  // The nonce has done its job.
  response.cookies.set(OAUTH_STATE_COOKIE, "", { maxAge: 0, path: "/" });

  return response;
}
