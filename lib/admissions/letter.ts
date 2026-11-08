import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument } from "pdf-lib";

import { letterHtml } from "@/lib/admissions/letter-html";
import type { LetterView } from "@/components/admissions/offer-letter";
import { renderHtmlPdf } from "@/lib/print/pdf";
import { readFile as readStoredFile, storageConfigured } from "@/lib/storage";

/**
 * Assembles a four-page offer letter.
 *
 * The two halves are deliberately different tools:
 *
 *   - **Pages 1 and 3** are ours: text that has to reflow, so they are HTML rendered by Chromium.
 *   - **Pages 2 and 4** are the college's own documents — the programme's uploaded fee structure
 *     and the bursary form. They are inserted page-for-page at full A4 and never redrawn.
 *
 * Redrawing the fee structure would mean restating the college's prices in our own layout, and a
 * generated table that disagrees with the signed PDF is the worst thing an offer letter can do.
 */

const BURSARY_DEFAULT = "bursary-form.pdf";

export type AssembledLetter = { bytes: Uint8Array; pages: number; missing: string[] };

/** Reads a PDF we ship ourselves from `public/`. */
async function localPdf(name: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path.join(process.cwd(), "public", name)));
  } catch {
    return null;
  }
}

/**
 * Fetches one of the uploaded PDFs.
 *
 * Both shapes of value the upload action can produce are handled: a full URL (our storage is
 * public-read for programme documents) and a bare bucket key.
 */
async function fetchUploadedPdf(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url) return null;

  // A local path is only reachable in tests: production values are URLs or bucket keys.
  if (url.startsWith("file://") || url.startsWith("/tmp/")) {
    try {
      return new Uint8Array(await readFile(url.replace(/^file:\/\//, "")));
    } catch {
      return null;
    }
  }

  if (/^https?:\/\//i.test(url)) {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
  }

  if (!storageConfigured()) return null;
  try {
    const file = await readStoredFile(url);
    return file ? new Uint8Array(file.bytes) : null;
  } catch {
    return null;
  }
}

/**
 * Is this really a PDF, and is every page A4?
 *
 * Checked before merging. A fee structure uploaded as a photo of a printed page, or a scan in
 * Letter size, would otherwise land in an A4 letter at the wrong scale — so we say so instead of
 * printing a letter that is subtly wrong.
 */
function checkA4(doc: PDFDocument): { ok: boolean; reason?: string } {
  const pages = doc.getPages();
  if (pages.length === 0) return { ok: false, reason: "the document has no pages" };

  for (const [index, page] of pages.entries()) {
    const { width, height } = page.getSize();
    const wMm = (width * 25.4) / 72;
    const hMm = (height * 25.4) / 72;
    // 2mm tolerance: A4 is 210x297, and a PDF that rounds its points is still A4.
    const portrait = Math.abs(wMm - 210) <= 2 && Math.abs(hMm - 297) <= 2;
    const landscape = Math.abs(wMm - 297) <= 2 && Math.abs(hMm - 210) <= 2;
    if (!portrait && !landscape) {
      return {
        ok: false,
        reason: `page ${index + 1} is ${wMm.toFixed(0)}×${hMm.toFixed(0)}mm, not A4 (210×297mm)`,
      };
    }
  }
  return { ok: true };
}

/** Loads an inserted document, appending a readable reason to `missing` when it cannot be used. */
async function loadInsert(
  label: string,
  bytes: Uint8Array | null,
  missing: string[],
): Promise<PDFDocument | null> {
  if (!bytes) {
    missing.push(`${label} — not available`);
    return null;
  }

  const doc = await PDFDocument.load(bytes).catch(() => null);
  if (!doc) {
    missing.push(`${label} — not a readable PDF`);
    return null;
  }

  const status = checkA4(doc);
  if (!status.ok) {
    missing.push(`${label} — ${status.reason}`);
    return null;
  }
  return doc;
}

export async function assembleOfferLetter(
  view: LetterView,
  uploads: { feeStructureUrl: string | null; bursaryFormUrl: string | null },
): Promise<AssembledLetter> {
  const missing: string[] = [];

  const ours = await renderHtmlPdf(await letterHtml(view));

  /*
   * Our render produced two pages in the order they must finally appear apart: 1 (letter) and
   * 2 (requirements). The fee structure belongs between them, and the bursary form at the end,
   * so the pages are copied into the final document in the intended order rather than appended
   * and then shuffled.
   */
  const ownDoc = await PDFDocument.load(ours);

  const [feeDoc, bursaryDoc] = await Promise.all([
    loadInsert(
      "fee structure",
      await fetchUploadedPdf(uploads.feeStructureUrl),
      missing,
    ),
    loadInsert(
      "bursary form",
      (await fetchUploadedPdf(uploads.bursaryFormUrl)) ?? (await localPdf(BURSARY_DEFAULT)),
      missing,
    ),
  ]);

  const out = await PDFDocument.create();

  const [letter, requirements] = await out.copyPages(ownDoc, [0, ownDoc.getPageCount() - 1]);
  out.addPage(letter);

  if (feeDoc) {
    for (const page of await out.copyPages(feeDoc, feeDoc.getPageIndices())) out.addPage(page);
  }

  out.addPage(requirements);

  if (bursaryDoc) {
    for (const page of await out.copyPages(bursaryDoc, bursaryDoc.getPageIndices())) {
      out.addPage(page);
    }
  }

  const bytes = await out.save();
  return { bytes, pages: out.getPageCount(), missing };
}
