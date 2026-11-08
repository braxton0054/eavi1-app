import { NextResponse } from "next/server";

import { ChatError, requireChatUser, requireMembership } from "@/lib/chat/access";
import { attachmentRoute } from "@/lib/chat/attachment-route";
import { MAX_ATTACHMENT_BYTES, validateAttachment } from "@/lib/chat/attachments";
import { sendMessage } from "@/lib/chat/messages";
import { storageConfigured } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Shares a document in a conversation.
 *
 * Multipart rather than a pre-signed upload URL: the file passes through here, so the size limit
 * and the type allow-list are enforced on bytes we actually hold rather than on a promise from
 * the browser. The attached message is sent through `sendMessage`, so it obeys exactly the same
 * membership, mute, restriction, rate-limit and staff-only rules as text.
 */
export async function POST(request: Request) {
  return attachmentRoute(async () => {
    const viewer = await requireChatUser();

    if (!storageConfigured()) {
      throw new ChatError("File storage is not configured, so documents cannot be shared yet.", 503);
    }

    const form = await request.formData();
    const conversationId = String(form.get("conversationId") ?? "");
    if (!conversationId) throw new ChatError("conversationId is required.", 400);

    // Membership before anything is read from the multipart body.
    await requireMembership(conversationId, viewer.id);

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ChatError("No file was attached.", 400);
    if (file.size > MAX_ATTACHMENT_BYTES) throw new ChatError("That file is larger than 10 MB.", 413);
    validateAttachment({ name: file.name, type: file.type, size: file.size });

    const body = String(form.get("body") ?? "");
    const clientMessageId = form.get("clientMessageId");
    const replyToId = form.get("replyToId");

    const message = await sendMessage(
      viewer,
      {
        conversationId,
        body,
        ...(clientMessageId ? { clientMessageId: String(clientMessageId) } : {}),
        ...(replyToId ? { replyToId: String(replyToId) } : {}),
      },
      { attachment: file },
    );

    return NextResponse.json({ ok: true, message });
  });
}
