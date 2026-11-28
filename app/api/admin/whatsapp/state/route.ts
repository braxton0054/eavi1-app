import { NextResponse } from "next/server";

import { whatsappPairingState } from "@/lib/delivery/whatsapp";
import { requireSuperAdmin } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Super-admin polling endpoint for the WhatsApp pairing screen. */
export async function GET() {
  await requireSuperAdmin();
  return NextResponse.json(await whatsappPairingState(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
