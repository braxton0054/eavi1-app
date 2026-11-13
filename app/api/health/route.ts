import { NextResponse } from "next/server";

import { storageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Liveness endpoint for container health checks. Deliberately reads nothing secret —
 *  it reports whether object storage is configured so a broken upload setup is visible
 *  from the outside instead of only as a 503 when someone tries to share a file. */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    storage: { configured: storageConfigured() },
  });
}
