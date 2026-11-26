import { NextResponse, type NextRequest } from "next/server";

import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { landingFor, safeNextPath } from "@/lib/landing";
import {
  enforceLoginRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { clearRateLimit, RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

/** Native fallback for the password form; it shares the JSON endpoint's security policy. */
const DUMMY_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = typeof form?.get("email") === "string" ? String(form.get("email")).trim().toLowerCase() : "";
  const password = typeof form?.get("password") === "string" ? String(form.get("password")) : "";
  const next = safeNextPath(typeof form?.get("next") === "string" ? String(form.get("next")) : null);

  try {
    await enforceLoginRateLimit(request, email);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(unavailableSecurityControls(), { status: 503 });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many attempts. Wait a few minutes and try again." },
        { status: 429, headers: { "Retry-After": String(retryAfterOf(error)) } },
      );
    }
    throw error;
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
  const fail = () => NextResponse.redirect(new URL("/login?error=credentials", origin), { status: 303 });

  if (!email || !password || password.length > 200) return fail();
  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches || user.status !== "ACTIVE") return fail();

  await clearRateLimit("login-account", email).catch(() => undefined);

  const expiresAt = new Date(Date.now() + 12 * 60 * 60_000);
  const token = await createSession(user.id, expiresAt);
  const destination = user.mustChangePassword ? "/set-password" : landingFor(user.role, next);
  const response = NextResponse.redirect(new URL(destination, origin), { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
  return response;
}
