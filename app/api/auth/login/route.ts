import { NextResponse, type NextRequest } from "next/server";

import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  enforceLoginRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { clearRateLimit, RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

// Same shape as a real hash (16-byte salt, 64-byte key), so a wrong email costs
// exactly what a wrong password costs.
const DUMMY_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember === true;

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

  const invalid = NextResponse.json(
    { error: "Incorrect email or password. Check them and try again." },
    { status: 401 },
  );
  if (!email || !password || password.length > 200) return invalid;

  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !matches || user.status !== "ACTIVE") return invalid;

  await clearRateLimit("login-account", email).catch(() => undefined);

  const expiresAt = new Date(Date.now() + (remember ? 30 : 0.5) * 86_400_000);
  const token = await createSession(user.id, expiresAt);
  const response = NextResponse.json({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    campus: user.campusId,
    mustChangePassword: user.mustChangePassword,
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });

  return response;
}
