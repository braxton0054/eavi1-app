import { readFile } from "node:fs/promises";
import path from "node:path";

import QRCode from "qrcode";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { STATEMENT_TEMPLATE_DIR } from "@/lib/statements/fee-docs";

/**
 * Turns a filled fee-document SVG into the PDF the office hands over.
 *
 * Same pipeline as the card print runs (`lib/cards/render.ts`): the document is drawn in
 * its artwork's own units, rasterised at 300 DPI — the resolution a laser printer and a PDF
 * archive both want — and embedded on a page of the real paper size. Nothing is rendered
 * until it is asked for, and nothing is stored afterwards, so a document can never be an
 * out-of-date copy of the ledger.
 */

/** The paper each design is drawn for. */
export const PAPER = {
  /** The receipt/invoice is A5 (560 x 794 units). */
  a5: { widthMm: 148, heightMm: 210 },
  /** The statement is A4 portrait. */
  a4: { widthMm: 210, heightMm: 297 },
} as const;

export type Paper = keyof typeof PAPER;

const MM_PER_INCH = 25.4;
const PRINT_DPI = 300;

const mmToPx = (mm: number) => Math.round((mm / MM_PER_INCH) * PRINT_DPI);
const mmToPt = (mm: number) => (mm / MM_PER_INCH) * 72;

/**
 * Assets a document references are inlined before rasterising.
 *
 * The rasteriser is an image library: it fetches nothing and cannot resolve a relative
 * `href`, so the logo an SVG points at has to travel inside the document or every page
 * prints with an empty frame. The bytes are cached because the logo is the same file for
 * every document — re-reading it per receipt would spend disk time to produce the same
 * data URI.
 */
const assetCache = new Map<string, string>();

async function inlineAsset(href: string) {
  const cached = assetCache.get(href);
  if (cached) return cached;

  let file: string;
  if (href.startsWith("/")) {
    file = path.join(process.cwd(), "public", decodeURIComponent(href.replace(/^\/+/, "")));
  } else if (/^https?:\/\//.test(href)) {
    const response = await fetch(href);
    if (!response.ok) return null;
    const type = response.headers.get("content-type")?.split(";")[0] ?? "image/png";
    const data = `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
    assetCache.set(href, data);
    return data;
  } else {
    // The supplied artwork references its logo beside itself, not from `public/`.
    file = path.join(STATEMENT_TEMPLATE_DIR, decodeURIComponent(href));
  }

  const extension = path.extname(file).toLowerCase();
  const type = extension === ".svg" ? "image/svg+xml" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/png";
  // The path is resolved from the artwork's own directory or `public/`, never from user
  // input; the opt-out keeps Turbopack from tracing the whole project into the server build
  // for one logo.
  const data = `data:${type};base64,${(await readFile(/*turbopackIgnore: true*/ file)).toString("base64")}`;
  assetCache.set(href, data);
  return data;
}

async function inlineAssets(svg: string) {
  const hrefs = [
    ...new Set([...svg.matchAll(/(?:href|xlink:href)="((?:https?:\/\/|\/)?[^"{}]+\.(?:png|jpe?g|svg))"/gi)].map((m) => m[1])),
  ];

  let out = svg;
  for (const href of hrefs) {
    try {
      const data = await inlineAsset(href);
      if (data) out = out.split(href).join(data);
    } catch {
      // A missing asset leaves its frame empty; that is better than no receipt at all.
    }
  }
  return out;
}

/**
 * Replaces the artwork's QR placeholder with a real code, positioned by the artwork.
 *
 * A dashed box prints as a dashed box: the code has to be a real one, or "scan to confirm"
 * is an instruction nobody can follow. The group is inserted as vector paths so it stays
 * sharp at print size.
 */
export async function withQr(svg: string, url: string, box: { x: number; y: number; size: number }) {
  const match = svg.match(/<g[^>]*data-slot="qr"[^>]*>[\s\S]*?<\/g>/);
  if (!match) return svg;

  const code = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", version: 6 });
  const inner = code.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
  // The library's own viewBox is its module count (33 for version 6), hence size / 33.
  const scale = (box.size / 33).toFixed(4);

  return svg.replace(
    match[0],
    `<g data-slot="qr" transform="translate(${box.x},${box.y}) scale(${scale})">${inner}</g>`,
  );
}

/** Rasterises one page of a document at print resolution. */
async function pagePng(svg: string, paper: Paper) {
  const { widthMm, heightMm } = PAPER[paper];
  const withAssets = await inlineAssets(svg);

  return sharp(Buffer.from(withAssets), { density: PRINT_DPI })
    .resize(mmToPx(widthMm), mmToPx(heightMm), { fit: "fill" })
    .png()
    .toBuffer();
}

/**
 * Builds a PDF from one or more document pages.
 *
 * `title` is metadata a reader shows in its tab and its print dialogue; it is never drawn
 * on the page, because the artwork already carries the college's own heading.
 */
export async function documentPdf(pages: string[], options: { paper: Paper; title: string }) {
  if (pages.length === 0) throw new Error("A document needs at least one page.");

  const pdf = await PDFDocument.create();
  pdf.setTitle(options.title);
  pdf.setCreator("EAVI Portal");
  pdf.setProducer("EAVI Portal");

  const { widthMm, heightMm } = PAPER[options.paper];

  for (const svg of pages) {
    const png = await pagePng(svg, options.paper);
    const embedded = await pdf.embedPng(png);
    const page = pdf.addPage([mmToPt(widthMm), mmToPt(heightMm)]);
    page.drawImage(embedded, { x: 0, y: 0, width: mmToPt(widthMm), height: mmToPt(heightMm) });
  }

  return Buffer.from(await pdf.save());
}

/**
 * A PDF response that either shows in the browser or downloads, decided by the link the
 * user followed — the viewer for checking a receipt, the attachment for filing it.
 */
export function pdfResponse(request: Request, file: Buffer, name: string) {
  const download = new URL(request.url).searchParams.has("download");
  // A name from a record can carry anything; only the filename grammar survives.
  const safe = name.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "document";

  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${safe}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
