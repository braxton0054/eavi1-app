import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { ChatError, type ChatUser } from "@/lib/chat/access";
import { deleteFile, readFile, uploadPrivateFile } from "@/lib/storage";

/**
 * Documents shared in chat.
 *
 * Two rules shape this file.
 *
 * 1. **Files are private.** They are uploaded without public access and downloaded through an
 *    authenticated route that re-checks conversation membership. Handing out a bucket URL would
 *    make the browser let go of it once and keep it forever; a copied link would still work after
 *    the owner had deleted the message.
 * 2. **Seven days, enforced by a sweep, not by hope.** Every attachment carries `expiresAt`, and
 *    a scheduled job removes the object, then the message it belongs to. The UI shows the same
 *    deadline so nobody is surprised when a file disappears.
 */

export const RETENTION_DAYS = 7;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * An allow-list, not a blocklist. Chat documents are for notes, worksheets and forms; an
 * unbounded `contentType` would let any file through, including HTML that a browser would then
 * happily render on our own origin if it were ever served inline.
 */
const ALLOWED_TYPES: Record<string, readonly string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "text/plain": [".txt"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
};

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}

/**
 * A display name that cannot be used to reach a path. The name is shown and used for the
 * download header only; the object key is generated separately from it.
 */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._ -]/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}

/** Throws with a message fit to show a person, rather than a bare boolean to guess at. */
export function validateAttachment(file: { name: string; type: string; size: number }) {
  const type = file.type || "application/octet-stream";
  const extensions = ALLOWED_TYPES[type];
  if (!extensions) {
    throw new ChatError(
      "That kind of file cannot be shared. Send a PDF, an image, a Word or Excel document, or a text file.",
      415,
    );
  }

  /*
   * The declared type must agree with the extension. A `.pdf` that claims to be a PNG is the
   * usual sign of a renamed file, and the two disagreeing is enough reason to refuse.
   */
  if (!extensions.includes(extensionOf(file.name))) {
    throw new ChatError("The file's name does not match its type.", 415);
  }

  if (file.size <= 0) throw new ChatError("That file is empty.", 400);
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ChatError("That file is larger than 10 MB.", 413);
  }
}

/** Stores the object and returns the row to write alongside the message. */
export async function storeAttachment(
  file: File,
  conversationId: string,
): Promise<{ storageKey: string; fileName: string; contentType: string; sizeBytes: number; expiresAt: Date }> {
  validateAttachment({ name: file.name, type: file.type, size: file.size });

  const bytes = Buffer.from(await file.arrayBuffer());
  const fileName = safeFileName(file.name);

  /*
   * The key is generated, never taken from the file's name: two people sharing "report.pdf"
   * must not collide, and a name with path characters must not be able to steer the write.
   */
  const storageKey = `chat-attachments/${conversationId}/${randomUUID()}${extensionOf(fileName)}`;

  await uploadPrivateFile(storageKey, bytes, file.type);

  return {
    storageKey,
    fileName,
    contentType: file.type,
    sizeBytes: file.size,
    expiresAt: new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}

/**
 * Fetches a file for a viewer, proving membership first.
 *
 * The membership check happens here rather than in the route so that every caller inherits it —
 * a route added later cannot forget.
 */
export async function attachmentForDownload(attachmentId: string, viewer: ChatUser) {
  const attachment = await prisma.chatAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      message: {
        select: {
          conversationId: true,
          deletedAt: true,
          conversation: { select: { members: { where: { leftAt: null }, select: { userId: true } } } },
        },
      },
    },
  });

  if (!attachment) throw new ChatError("File not found.", 404);

  const isMember = attachment.message.conversation.members.some((m) => m.userId === viewer.id);
  if (!isMember) throw new ChatError("You are not part of this conversation.", 403);

  // An expired or already-swept file is gone even if the row is still on its way out.
  if (attachment.deletedAt || attachment.expiresAt.getTime() <= Date.now()) {
    throw new ChatError("This file has expired.", 410);
  }

  const object = await readFile(attachment.storageKey);
  if (!object) throw new ChatError("File not found.", 404);

  return { ...attachment, bytes: object.bytes, contentType: object.contentType };
}

/**
 * Deletes everything older than the retention window.
 *
 * The object goes first and the row second: a crash between the two leaves a row pointing at a
 * missing object, which the next sweep retries harmlessly. The reverse order would leave files
 * nobody can see or ever delete again.
 */
export async function sweepExpiredAttachments(now = new Date()): Promise<{
  filesDeleted: number;
  messagesDeleted: number;
  failures: number;
}> {
  const due = await prisma.chatAttachment.findMany({
    where: { expiresAt: { lte: now }, deletedAt: null },
    select: { id: true, storageKey: true, messageId: true },
    take: 500,
  });

  let filesDeleted = 0;
  let failures = 0;
  const emptiedMessages = new Set<string>();

  for (const attachment of due) {
    try {
      await deleteFile(attachment.storageKey);
      await prisma.chatAttachment.update({
        where: { id: attachment.id },
        data: { deletedAt: new Date() },
      });
      filesDeleted += 1;
      emptiedMessages.add(attachment.messageId);
    } catch {
      // Left for the next run; the row stays visible in the table rather than vanishing.
      failures += 1;
    }
  }

  /*
   * A message whose only content was a file would otherwise survive as an empty bubble. One that
   * still has text stays, with the document simply gone.
   */
  let messagesDeleted = 0;
  for (const messageId of emptiedMessages) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { body: true, attachments: { where: { deletedAt: null }, select: { id: true } } },
    });
    if (!message) continue;
    if (message.attachments.length > 0) continue;
    if (message.body.trim().length > 0) continue;

    await prisma.message.delete({ where: { id: messageId } });
    messagesDeleted += 1;
  }

  // Rows whose object could not be removed stay until they succeed; hard-delete the markers of
  // files that are long gone so the table does not grow without bound.
  await prisma.chatAttachment.deleteMany({
    where: { expiresAt: { lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, deletedAt: { not: null } },
  });

  return { filesDeleted, messagesDeleted, failures };
}
