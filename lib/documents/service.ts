/**
 * Saved documents.
 *
 * A document is a row, not an action. Opening one loads the row and returns the saved PDF;
 * it never re-reads the source or re-renders the artwork. Editing the source marks the row
 * STALE and hands a job to the worker, which is the only place that overwrites a document.
 * A missing row is the one allowed synchronous render — the lazy fallback for records that
 * predate this service or whose hook could not run.
 */

import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { enqueueDocumentRefresh } from "@/lib/queue/queues";
import { keyFromUrl, readFile, storageConfigured, uploadFile } from "@/lib/storage";

import { DEFINITIONS } from "./registry";
import type { DocumentKind, Snapshot } from "./types";

export type SavedDocument = Awaited<ReturnType<typeof ensureDocument>>;

function snapshotHash(snapshot: Snapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function objectKey(kind: string, scopeKey: string, hash: string) {
  const safe = scopeKey.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 80);
  return `generated/${kind.toLowerCase()}/${safe}/${hash.slice(0, 16)}.pdf`;
}

/** Loads the saved document. Only a missing row ever renders synchronously. */
export async function ensureDocument(kind: DocumentKind, scopeKey: string) {
  const row = await prisma.generatedDocument.findUnique({
    where: { kind_scopeKey: { kind, scopeKey } },
  });
  return row ?? regenerateDocument(kind, scopeKey);
}

/**
 * Source changed: mark the saved document stale and queue one refresh.
 *
 * The job id is the document's identity, so ten edits inside a second still produce one
 * render — with the final state of the source, not ten copies of an intermediate one.
 */
export async function touchDocument(kind: DocumentKind, scopeKey: string) {
  await prisma.generatedDocument.updateMany({
    where: { kind, scopeKey },
    data: { status: "STALE" },
  });
  try {
    await enqueueDocumentRefresh({ kind, scopeKey });
  } catch (error) {
    // Redis being down must not fail the write that caused the change. The row is STALE;
    // the next worker start, or the next ensureDocument for a missing row, repairs it.
    console.error(`document refresh queue unavailable (${kind}:${scopeKey}):`, error);
  }
}

/**
 * Renders a document and upserts its single row. Idempotent: an unchanged source hash
 * returns the saved row without touching storage.
 */
export async function regenerateDocument(kind: DocumentKind, scopeKey: string) {
  const definition = DEFINITIONS[kind];
  if (!definition) throw new Error(`Unknown document kind: ${kind}`);

  const snapshot = await definition.load(scopeKey);
  if (!snapshot) return null;

  const hash = snapshotHash(snapshot);
  const existing = await prisma.generatedDocument.findUnique({
    where: { kind_scopeKey: { kind, scopeKey } },
    select: { id: true, sourceHash: true, storageUrl: true, status: true },
  });
  if (existing && existing.sourceHash === hash && existing.storageUrl) {
    if (existing.status !== "CURRENT") {
      await prisma.generatedDocument.update({ where: { id: existing.id }, data: { status: "CURRENT" } });
    }
    return prisma.generatedDocument.findUnique({ where: { id: existing.id } });
  }

  const rendered = await definition.render(snapshot);
  const storageUrl = storageConfigured()
    ? await uploadFile(
        objectKey(kind, scopeKey, hash),
        rendered.pdf,
        "application/pdf",
      )
    : null;

  const values = {
    sourceHash: hash,
    snapshot: snapshot as Prisma.InputJsonValue,
    svgText: rendered.svg,
    storageUrl,
    fileName: rendered.fileName,
    status: "CURRENT",
    version: { increment: 1 },
  };

  return prisma.generatedDocument.upsert({
    where: { kind_scopeKey: { kind, scopeKey } },
    create: {
      kind,
      scopeKey,
      sourceHash: hash,
      snapshot: snapshot as Prisma.InputJsonValue,
      svgText: rendered.svg,
      storageUrl,
      fileName: rendered.fileName,
      status: "CURRENT",
      version: 1,
    },
    update: values,
  });
}

/** Serves the saved PDF. A storage miss falls back to the saved snapshot, never live data. */
export async function documentPdf(row: {
  storageUrl: string | null;
  kind: string;
  snapshot: unknown;
}): Promise<Buffer> {
  if (row.storageUrl) {
    const stored = await readFile(keyFromUrl(row.storageUrl));
    if (stored) return stored.bytes;
  }
  const definition = DEFINITIONS[row.kind];
  if (!definition) throw new Error(`Unknown document kind: ${row.kind}`);
  return (await definition.render(row.snapshot as Snapshot)).pdf;
}

/** Scope helpers: one call site for each kind of source change. */
export async function touchStudent(studentId: string) {
  const cards = await prisma.idCard.findMany({ where: { studentId }, select: { id: true } });
  await Promise.all([
    ...cards.map((card) => touchDocument("ID_CARD", card.id)),
    touchDocument("STUDENT_PROFILE", studentId),
  ]);
}

export async function touchCardsForStudents(studentIds: string[]) {
  const cards = await prisma.idCard.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true },
  });
  await Promise.all(cards.map((card) => touchDocument("ID_CARD", card.id)));
}

export async function touchInvoice(invoiceId: string) {
  await touchDocument("INVOICE", invoiceId);
}

export async function touchInvoicesForStudent(studentId: string) {
  const rows = await prisma.invoice.findMany({ where: { studentId }, select: { id: true } });
  await Promise.all(rows.map((row) => touchDocument("INVOICE", row.id)));
}

export async function touchReceipt(receiptNo: string) {
  await touchDocument("RECEIPT", receiptNo);
}

export async function touchProgram(programId: string) {
  await touchDocument("FEE_STRUCTURE", programId);
}

/** Template edit: refresh every saved card so artwork changes reach existing students. */
export async function touchAllCards() {
  const rows = await prisma.generatedDocument.findMany({
    where: { kind: "ID_CARD" },
    select: { scopeKey: true },
  });
  await Promise.all(rows.map((row) => touchDocument("ID_CARD", row.scopeKey)));
}
