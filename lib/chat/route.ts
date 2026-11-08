import { NextResponse } from "next/server";

import { ChatError, chatErrorResponse } from "@/lib/chat/access";

/**
 * One place where a chat route turns a thrown error into a status and a body.
 *
 * The message returned to the client is deliberately the message the rules chose, never the
 * database's. A Prisma error could name a constraint or an id; this never does.
 */
export async function chatRoute<T>(work: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await work();
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (error) {
    const { message, status } = chatErrorResponse(error);
    if (!(error instanceof ChatError) && status === 500) {
      // Logged server-side for diagnosis; the client still sees only the generic message.
      console.error("chat route failed:", error);
    }
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
