import { NextResponse } from "next/server";
import sharp from "sharp";

import { rawPhotoUrl } from "@/lib/chat/profile";
import { chatUserFromCookies } from "@/lib/chat/cookies";

export const dynamic = "force-dynamic";

/**
 * Chat avatars.
 *
 * The enrolment photo lives in object storage under a long public URL. Handing that URL to
 * every student in the school would let anyone link the full-size portrait from outside the
 * portal, long after they had any business seeing it. So chat shows this route instead: it
 * checks the caller is signed in, crops the picture to a square thumbnail, and caches it.
 *
 * Anyone signed in may request any avatar — that is what a school phonebook is. The protection
 * is against outsiders and against the full-size image, not against classmates.
 */
const SIZES = { 96: 96, 256: 256 } as const;
type Size = keyof typeof SIZES;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const viewer = await chatUserFromCookies();
  if (!viewer) return new NextResponse("Unauthorized", { status: 401 });

  const { userId } = await params;
  const requested = Number(new URL(request.url).searchParams.get("size") ?? 96);
  const size: Size = requested === 256 ? 256 : 96;

  const source = await rawPhotoUrl(userId);
  if (!source) return new NextResponse("Not found", { status: 404 });

  try {
    const response = await fetch(source, { cache: "no-store" });
    if (!response.ok) return new NextResponse("Not found", { status: 404 });

    const original = Buffer.from(await response.arrayBuffer());
    const thumbnail = await sharp(original)
      .rotate()
      .resize(SIZES[size], SIZES[size], { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();

    return new NextResponse(new Uint8Array(thumbnail), {
      headers: {
        "Content-Type": "image/webp",
        // Private: a shared proxy must not serve one person's avatar to the world.
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": String(thumbnail.byteLength),
      },
    });
  } catch {
    // A corrupt or unsupported image must not fill the log with stack traces; the client
    // falls back to initials.
    return new NextResponse("Not found", { status: 404 });
  }
}
