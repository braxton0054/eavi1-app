import {
  checkRateLimit,
  clientIp,
  RateLimitExceededError,
  type RateLimitResult,
} from "@/lib/security/rate-limit";

type Limit = {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
};

async function enforce(limits: Limit[]): Promise<void> {
  const results = await Promise.all(
    limits.map((limit) => checkRateLimit(limit).then((result) => ({ ...result, scope: limit.scope }))),
  );
  const blocked = results.filter((result) => !result.allowed);
  if (blocked.length > 0) {
    throw new RateLimitExceededError(Math.max(...blocked.map((result) => result.retryAfter)));
  }
}

export async function enforceLoginRateLimit(request: Request, email: string): Promise<void> {
  const account = email || "invalid-account";
  await enforce([
    { scope: "login-account", identifier: account, limit: 8, windowMs: 15 * 60_000 },
    { scope: "login-ip", identifier: clientIp(request), limit: 30, windowMs: 15 * 60_000 },
    { scope: "login-global", identifier: "all", limit: 120, windowMs: 15 * 60_000 },
  ]);
}

export async function enforceRegistrationRateLimit(request: Request, email: string, phone: string): Promise<void> {
  await enforce([
    { scope: "register-contact", identifier: `${email}|${phone}`, limit: 5, windowMs: 60 * 60_000 },
    { scope: "register-ip", identifier: clientIp(request), limit: 10, windowMs: 60 * 60_000 },
    { scope: "register-global", identifier: "all", limit: 30, windowMs: 60 * 60_000 },
  ]);
}

export async function enforceApplicationRateLimit(request: Request, email: string, phone: string): Promise<void> {
  await enforce([
    { scope: "application-contact", identifier: `${phone}|${email}`, limit: 5, windowMs: 60 * 60_000 },
    { scope: "application-ip", identifier: clientIp(request), limit: 10, windowMs: 60 * 60_000 },
    { scope: "application-global", identifier: "all", limit: 50, windowMs: 60 * 60_000 },
  ]);
}

export async function enforceLookupRateLimit(request: Request, contact: string): Promise<void> {
  await enforce([
    { scope: "lookup-contact", identifier: contact || "empty", limit: 12, windowMs: 60 * 60_000 },
    { scope: "lookup-ip", identifier: clientIp(request), limit: 30, windowMs: 60 * 60_000 },
    { scope: "lookup-global", identifier: "all", limit: 120, windowMs: 60 * 60_000 },
  ]);
}

export async function enforceOAuthRateLimit(request: Request): Promise<void> {
  await enforce([
    { scope: "oauth-ip", identifier: clientIp(request), limit: 60, windowMs: 5 * 60_000 },
    { scope: "oauth-global", identifier: "all", limit: 300, windowMs: 5 * 60_000 },
  ]);
}

export async function enforcePasswordSetupRateLimit(userId: string): Promise<void> {
  await enforce([
    { scope: "password-setup-account", identifier: userId, limit: 10, windowMs: 15 * 60_000 },
  ]);
}

export function retryAfterOf(error: unknown): number {
  return error instanceof RateLimitExceededError ? error.retryAfter : 1;
}

export function unavailableSecurityControls() {
  return { error: "Security controls are temporarily unavailable. Try again shortly." };
}

export type { RateLimitResult };
