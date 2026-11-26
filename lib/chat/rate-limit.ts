import { checkRateLimit } from "@/lib/security/rate-limit";

/** Shared Redis token windows. These functions are async so HTTP and socket paths fail closed. */
async function spendToken(key: string, limit: number, windowMs: number): Promise<void> {
  const result = await checkRateLimit({ scope: key, identifier: "bucket", limit, windowMs });
  if (!result.allowed) {
    throw new Error(`Too many messages — slow down for ${result.retryAfter} seconds.`);
  }
}

/** ~20 messages per 10 seconds, matching the brief. */
export async function limitMessages(userId: string): Promise<void> {
  await spendToken(`msg:${userId}`, 20, 10_000);
}

/** New DIRECT threads per hour, so one account cannot open hundreds of chats to spam. */
export async function limitNewDirectChats(userId: string): Promise<void> {
  await spendToken(`direct:${userId}`, 30, 60 * 60_000);
}
