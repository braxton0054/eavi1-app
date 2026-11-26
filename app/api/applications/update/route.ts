import { NextResponse, type NextRequest } from "next/server";

import {
  enforceLookupRateLimit,
  retryAfterOf,
  unavailableSecurityControls,
} from "@/lib/security/auth-rate-limit";
import { RateLimitExceededError, RateLimitUnavailableError } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

/** Programme changes are office-only until a separate, short-lived applicant capability exists. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  try {
    await enforceLookupRateLimit(request, reference);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return NextResponse.json(unavailableSecurityControls(), { status: 503 });
    }
    if (error instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(retryAfterOf(error)) } },
      );
    }
    throw error;
  }

  return NextResponse.json(
    { error: "Programme changes must be completed by the admissions office." },
    { status: 410 },
  );
}
