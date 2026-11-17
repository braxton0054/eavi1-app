import { createHash } from "node:crypto";

import type { Job } from "bullmq";

import { prisma } from "@/lib/prisma";
import { pages } from "@/lib/content/dashboard";
import { buildPrintableCards } from "@/lib/dal/cards";
import { paginateSheets } from "@/lib/cards/sheet";
import { renderSheetPng } from "@/lib/cards/render";
import { buildCardsPdf } from "@/lib/cards/pdf";
import { storageConfigured, uploadFile } from "@/lib/storage";
import { recordAudit } from "@/lib/academics/audit";
import { sweepExpiredAttachments } from "@/lib/chat/attachments";

import type { CardBatchJobData } from "./queues";

const copy = pages.cards.generate;

/**
 * Renders one card print run: every sheet to PNG, then the whole PDF, then storage.
 *
 * This used to run inside the server action — a batch of four hundred cards held the HTTP
 * request for the better part of a minute. The work itself is unchanged, right down to the
 * audit row it writes; only the place it runs from has moved. It is safe to re-run: cards
 * are reused by student, and the batch row is overwritten, never duplicated.
 */
export async function processCardBatch(job: Job<CardBatchJobData>) {
  const { batchId, target, campusId, actorId, actorEmail } = job.data;

  // A retry after a failure must show as running again, not stay marked failed.
  await prisma.cardBatch.update({ where: { id: batchId }, data: { status: "PENDING" } });

  const { cards } = await buildPrintableCards(target, campusId);
  await job.updateProgress(15);

  /*
   * What the run will actually print: the serials and the merged faces. If a finished run
   * already holds this exact content, its PDF is the right file — the same cards, already
   * rendered and already stored. Reusing it saves the render and, more importantly, a second
   * copy of an identical PDF in object storage.
   */
  const contentHash = createHash("sha256")
    .update(cards.map((card) => `${card.serial}|${card.frontSvg}|${card.backSvg}`).join("\n"))
    .digest("hex");

  const sameContent =
    cards.length > 0
      ? await prisma.cardBatch.findFirst({
          where: {
            contentHash,
            status: "COMPLETE",
            fileUrl: { not: null },
            campusId,
            id: { not: batchId },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, fileUrl: true, sheetCount: true },
        })
      : null;

  if (sameContent) {
    await prisma.cardBatch.update({
      where: { id: batchId },
      data: {
        cardCount: cards.length,
        sheetCount: sameContent.sheetCount,
        fileUrl: sameContent.fileUrl,
        contentHash,
        status: "COMPLETE",
      },
    });
    await job.updateProgress(100);

    await recordAudit({
      campusId,
      actorId,
      actorEmail,
      action: "card.reuse",
      entityType: "card",
      entityId: batchId,
      detail: { cards: cards.length, reusedFrom: sameContent.id },
    });

    return { batchId, cards: cards.length, sheets: sameContent.sheetCount, reused: sameContent.id };
  }

  const { sheets } = paginateSheets(cards);

  // Fronts and backs are separate pages, in sheet order, so a duplex print flips cleanly.
  const images = [];
  for (const [index, sheet] of sheets.entries()) {
    const bind = copy.sheetCaption(sheet.page, sheets.length);
    images.push({ png: await renderSheetPng(sheet, "fronts", `${bind} · ${copy.frontLabel}`), label: "front" });
    images.push({ png: await renderSheetPng(sheet, "backs", `${bind} · ${copy.backLabel}`), label: "back" });
    // The sheet renders are the long part; progress that only moves once at the end
    // would leave the office staring at a static 15% for a minute.
    await job.updateProgress(15 + Math.round(((index + 1) / sheets.length) * 65));
  }

  const pdf = await buildCardsPdf(images);
  await job.updateProgress(85);

  // Without storage the batch is still recorded so the run can be seen, just not reopened.
  const fileUrl = storageConfigured()
    ? await uploadFile(`id-cards/${Date.now()}-${cards.length}-cards.pdf`, pdf, "application/pdf")
    : null;

  await prisma.cardBatch.update({
    where: { id: batchId },
    data: { cardCount: cards.length, sheetCount: sheets.length, fileUrl, contentHash, status: "COMPLETE" },
  });

  await job.updateProgress(100);

  await recordAudit({
    campusId,
    actorId,
    actorEmail,
    action: "card.generate",
    entityType: "card",
    entityId: batchId,
    detail: { cards: cards.length, sheets: sheets.length },
  });

  return { batchId, cards: cards.length, sheets: sheets.length };
}

/**
 * Deletes chat documents older than the retention window.
 *
 * The work is idempotent and safe to run twice at once: each attachment is deleted by key,
 * and a second runner finds the object already absent and treats that as success. The
 * summary is returned so it stays on the job for the jobs screen.
 */
export async function processAttachmentSweep(job: Job) {
  const started = Date.now();
  const result = await sweepExpiredAttachments();
  await job.updateProgress(100);

  console.log(
    `chat attachments: ${result.filesDeleted} file(s) and ${result.messagesDeleted} empty message(s) removed` +
      (result.failures ? `, ${result.failures} failure(s) to retry` : "") +
      ` in ${Date.now() - started}ms`,
  );

  // A failed sweep is retried by BullMQ; `failures` above counts the objects that could
  // not be removed this pass and are simply left for the next run.
  return result;
}
