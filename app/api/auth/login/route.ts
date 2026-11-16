import { NextResponse, type NextRequest } from "next/server";

import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60_000;

// Best-effort throttle: it lives in this process, so it slows down guessing
// without pretending to be a distributed rate limiter.
const attempts = new Map<string, { count: number; resetAt: number }>();

// Same shape as a real hash (16-byte salt, 64-byte key), so a wrong email costs
// exactly what a wrong password costs.
const DUMMY_HASH = `scrypt$32768$8$1$${Buffer.alloc(16).toString("base64")}$${Buffer.alloc(64).toString("base64")}`;

function throttled(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function cleared(key: string) {
  attempts.delete(key);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const remember = body.remember === true;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${ip}|${email}`;
  if (throttled(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

  const invalid = NextResponse.json(
    { error: "Incorrect email or password. Check them and try again." },
    { status: 401 },
  );

  const user = await prisma.user.findUnique({ where: { email } });
  const matches = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );

  if (!user || !matches) return invalid;

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      {
        error:
          user.status === "PENDING"
            ? "A superadmin still needs to approve this account."
            : "This account has been disabled.",
      },
      { status: 403 },
    );
  }

  cleared(key);

  const token = await createSession(user.id);
  const response = NextResponse.json({
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    campus: user.campusId,
  });

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12,
  });

  return response;
}
