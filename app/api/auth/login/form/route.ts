import { NextResponse, type NextRequest } from "next/server";

import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { landingFor, safeNextPath } from "@/lib/landing";

/**
 * Native fallback for the password form.
 *
 * The client form normally posts JSON to /api/auth/login. When the browser bundle has not
 * loaded yet — a slow link to the VPS, or JS disabled — the same form submits here as a
 * plain HTML form. The endpoint verifies the same way, sets the same session cookie, and
 * redirects, so signing in never depends on a chunk arriving in time.
 */
const DUMMY_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const email = typeof form?.get("email") === "string" ? String(form?.get("email")).trim().toLowerCase() : "";
  const password = typeof form?.get("password") === "string" ? String(form?.get("password")) : "";
  const next = safeNextPath(typeof form?.get("next") === "string" ? String(form?.get("next")) : null);

  // A standalone server can report request.url as localhost:3000; the configured public
  // origin is the one the browser must land on.
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.trim() || new URL(request.url).origin;
  const fail = () => NextResponse.redirect(new URL("/login?error=credentials", origin), { status: 303 });

  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches || user.status !== "ACTIVE") return fail();

  const token = await createSession(user.id);
  const response = NextResponse.redirect(new URL(landingFor(user.role, next), origin), { status: 303 });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
