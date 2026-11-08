import { NextResponse } from "next/server";

import { ChatError, chatErrorResponse, requireChatUser } from "@/lib/chat/access";
import { attachmentForDownload } from "@/lib/chat/attachments";

export const dynamic = "force-dynamic";

/**
 * Downloads a shared document.
 *
 * The file is streamed from private object storage after membership is proven, so the bucket URL
 * never reaches a browser and a copied link stops working the moment the file expires or the
 * person is removed from the conversation.
 *
 * `Content-Disposition: attachment` is deliberate: even an image is downloaded rather than opened
 * inline, so a shared file can never render as a document on the portal's own origin. Combined
 * with `nosniff` and a restrictive CSP, that closes the usual trick of uploading something that
 * behaves like a page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewer = await requireChatUser();
    const { id } = await params;

    const file = await attachmentForDownload(id, viewer);

    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";

    /*
     * Images may be shown inline so a photo previews in the bubble; a shared PDF or office
     * document is always a download. Inline is limited to types a browser cannot execute.
     */
    const inlineSafe = /^image\/(png|jpeg|webp)$/.test(file.contentType);
    const disposition = inline && inlineSafe ? "inline" : "attachment";

    // Browsers must not go sniffing a type out of the bytes and deciding it is HTML.
    const encodedName = encodeURIComponent(file.fileName).replace(/['()]/g, escape);

    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.contentType,
        "Content-Length": String(file.bytes.byteLength),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        // A shared file is not cacheable: it has a deadline and a membership requirement.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const { message, status } = chatErrorResponse(error);
    if (!(error instanceof ChatError) && status === 500) console.error("attachment download failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
