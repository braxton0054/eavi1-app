import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

type ScryptParams = { N: number; r: number; p: number; maxmem: number };

// scrypt's options overload is the one we need, and promisify cannot pick it.
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptParams,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (error, derived) =>
      error ? reject(error) : resolve(derived),
    );
  });
}

const KEY_LENGTH = 64;
const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
// Node caps scrypt at 32 MiB by default; N=2^15, r=8 needs 128*N*r = 32 MiB of
// memory plus overhead, so raise the ceiling or every hash throws.
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
export const SESSION_COOKIE = "eavi_session";
export const SESSION_TTL_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(
    password.normalize("NFKC"),
    salt,
    KEY_LENGTH,
    { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: SCRYPT_MAX_MEMORY },
  )) as Buffer;

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, key] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !key) return false;

  const expected = Buffer.from(key, "base64");
  const derived = (await scryptAsync(
    password.normalize("NFKC"),
    Buffer.from(salt, "base64"),
    expected.length,
    { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT_MAX_MEMORY },
  )) as Buffer;

  return timingSafeEqual(derived, expected);
}

/** Sessions are stored as a digest, so a database leak cannot replay a cookie. */
function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      tokenHash: digestToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000),
    },
  });

  return token;
}

export async function resolveSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: digestToken(token) },
    include: { user: { include: { campus: true } } },
  });

  if (!session || session.expiresAt.getTime() < Date.now()) return null;

  await prisma.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  });

  return session.user;
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session
    .deleteMany({ where: { tokenHash: digestToken(token) } })
    .catch(() => undefined);
}
