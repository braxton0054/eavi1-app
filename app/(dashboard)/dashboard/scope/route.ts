import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";

import { SCOPE_COOKIE, requireSuperAdmin } from "@/lib/session";

/** Lets a super admin pick the campus every dashboard screen filters to, or none for the whole college. */
export async function GET(request: NextRequest) {
  await requireSuperAdmin();

  const campus = request.nextUrl.searchParams.get("campus");
  const store = await cookies();

  if (campus && campus !== "all" && /^\d+$/.test(campus)) {
    store.set(SCOPE_COOKIE, campus, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  } else {
    store.delete(SCOPE_COOKIE);
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
