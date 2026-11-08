import { NextResponse } from "next/server";

import { ChatError, chatErrorResponse } from "@/lib/chat/access";

/**
 * Attachments travel as multipart form data, so this route answers in its own shape rather than
 * the JSON `chatRoute` envelope used by the rest of the API.
 *
 * A thrown `ChatError` becomes an error response with no stack or database detail in it: the
 * message a person sees is the one the rules chose.
 */
export async function attachmentRoute(work: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await work();
  } catch (error) {
    const { message, status } = chatErrorResponse(error);
    if (!(error instanceof ChatError) && status === 500) console.error("attachment route failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
