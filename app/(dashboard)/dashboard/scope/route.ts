import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { SCOPE_COOKIE, requireSuperAdmin } from "@/lib/session";

/**
 * Lets a super admin pick the campus every dashboard screen filters to, or none for the whole
 * college. Both verbs are accepted: the header picker posts here, and an older bookmark or
 * link may still GET it.
 */
export async function GET(request: NextRequest) {
  return applyScope(request, new URL("/dashboard", request.url));
}

export async function POST(request: NextRequest) {
  // The caller re-reads the current screen itself, so no redirect is wanted here.
  return applyScope(request, null);
}

async function applyScope(request: NextRequest, redirectTo: URL | null) {
  await requireSuperAdmin();

  const campus = request.nextUrl.searchParams.get("campus");
  const store = await cookies();

  if (campus && campus !== "all" && /^\d+$/.test(campus)) {
    store.set(SCOPE_COOKIE, campus, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete(SCOPE_COOKIE);
  }

  return redirectTo ? NextResponse.redirect(redirectTo) : NextResponse.json({ campus: campus ?? "all" });
}
