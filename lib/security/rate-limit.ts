import { createHash } from "node:crypto";
import { isIP } from "node:net";

import IORedis, { type Redis } from "ioredis";

import { redisUrl } from "@/lib/queue/connection";

export class RateLimitUnavailableError extends Error {
  readonly status = 503;

  constructor() {
    super("Security controls are temporarily unavailable. Try again shortly.");
    this.name = "RateLimitUnavailableError";
  }
}

let client: Redis | null = null;

/** Request-path Redis is deliberately non-blocking; BullMQ's worker options are not safe here. */
function redis(): Redis {
  if (client) return client;
  client = new IORedis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    commandTimeout: 1_000,
    retryStrategy: (attempt) => Math.min(attempt * 100, 500),
  });
  client.on("error", () => {
    // The command that triggered the error returns the fail-closed error to the caller.
  });
  return client;
}

const WINDOW_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return { current, ttl }
`;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
};

export class RateLimitExceededError extends Error {
  readonly status = 429;

  constructor(readonly retryAfter: number) {
    super("Too many attempts. Wait before trying again.");
    this.name = "RateLimitExceededError";
  }
}

/** Hashes identifiers so raw emails, phone numbers, and IP addresses never become Redis keys. */
export async function checkRateLimit(input: {
  scope: string;
  identifier: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const digest = createHash("sha256").update(input.identifier).digest("hex");
  const key = `eavi:rl:v1:${input.scope}:${digest}`;
  try {
    const connection = redis();
    if (connection.status === "wait") await connection.connect();
    const [count, ttl] = (await connection.eval(
      WINDOW_SCRIPT,
      1,
      key,
      String(input.windowMs),
    )) as [number, number];
    const retryAfter = Math.max(1, Math.ceil((ttl > 0 ? ttl : input.windowMs) / 1000));
    return {
      allowed: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfter,
    };
  } catch {
    throw new RateLimitUnavailableError();
  }
}

/** Test/maintenance seam for one exact bucket; never flushes shared Redis. */
export async function clearRateLimit(scope: string, identifier: string): Promise<void> {
  const digest = createHash("sha256").update(identifier).digest("hex");
  try {
    const connection = redis();
    if (connection.status === "wait") await connection.connect();
    await connection.del(`eavi:rl:v1:${scope}:${digest}`);
  } catch {
    throw new RateLimitUnavailableError();
  }
}

function forwardedAddresses(request: Request): string[] {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return [];
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) return [];
  return forwarded
    .split(",")
    .map((value) => value.trim().replace(/^::ffff:/, "").toLowerCase())
    .filter((value) => Boolean(isIP(value)));
}

/**
 * The origin is bound to loopback in production, so the right-most forwarded address is
 * the hop Caddy added. In development, or when proxy trust is disabled, callers share an
 * explicit untrusted bucket rather than trusting a spoofable header.
 */
export function clientIp(request: Request): string {
  const forwarded = forwardedAddresses(request);
  return forwarded.at(-1) ?? "untrusted";
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return result.allowed ? {} : { "Retry-After": String(result.retryAfter) };
}
