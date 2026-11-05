import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Liveness endpoint for container health checks. Deliberately reads nothing. */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
