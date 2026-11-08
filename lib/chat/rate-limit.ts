/**
 * Rate limiting for chat writes.
 *
 * A token bucket per user per action, held in memory. That is enough because the portal runs
 * as one container; if a second instance is ever added the buckets must move to Redis, or each
 * instance would allow its own allowance and the real limit would double. The comment is the
 * contract: do not add a replica without moving this.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

/** Cheap sweep so a long-lived process does not accumulate one entry per user forever. */
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 10 * 60_000) buckets.delete(key);
  }
}

/**
 * Spends one token, or throws. `limit` tokens refill over `windowMs`, so the allowance is a
 * sustained rate rather than a hard per-minute cliff.
 */
export function spendToken(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };
  const refill = ((now - bucket.updatedAt) / windowMs) * limit;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    throw new Error("Too many messages — slow down for a moment.");
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
}

/** ~20 messages per 10 seconds, matching the brief. */
export function limitMessages(userId: string): void {
  spendToken(`msg:${userId}`, 20, 10_000);
}

/** New DIRECT threads per hour, so one account cannot open hundreds of chats to spam. */
export function limitNewDirectChats(userId: string): void {
  spendToken(`direct:${userId}`, 30, 60 * 60_000);
}

/** Test seam: forget every bucket. */
export function resetRateLimits(): void {
  buckets.clear();
}
