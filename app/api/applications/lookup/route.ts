import { NextResponse, type NextRequest } from "next/server";

import {
  enforceLookupRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";
import { normalizeKenyanPhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Public lookup intentionally reveals nothing. It is an anti-enumeration boundary, not a
 * record-returning endpoint. Admissions helps the applicant recover their own record through
 * a verified channel.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const raw = typeof body?.answer === "string" ? body.answer.trim() : "";
  const contact = raw.includes("@") ? raw.toLowerCase() : normalizeKenyanPhone(raw) ?? raw;

  try {
    await enforceLookupRateLimit(request, contact);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(unavailableSecurityControls(), { status: 503 });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many lookups. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterOf(error)) } },
      );
    }
    throw error;
  }

  return NextResponse.json({
    status: "unavailable",
    message:
      "For your privacy, application details are not shown online. Contact admissions with the phone number or email you used to apply.",
  });
}
