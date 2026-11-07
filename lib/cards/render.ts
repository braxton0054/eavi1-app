import sharp from "sharp";
import type { OverlayOptions } from "sharp";

import { A4, CR80, SHEET, type Sheet } from "@/lib/cards/sheet";

/**
 * Print output.
 *
 * Cards are printed, not viewed, so the renderer works in millimetres at 300 DPI — the
 * resolution a card printer expects for a CR80-sized photo and bold name. Everything is
 * composed into one A4 canvas per sheet so the office sends a single PDF to the printer
 * instead of dozens of images.
 */

/**
 * 300 DPI is the floor for legible printing of a card; below it the photo and the fine
 * print at the bottom of the artwork turn to mush on PVC.
 */
export const PRINT_DPI = 300;

const MM_PER_INCH = 25.4;
const mmToPx = (mm: number) => Math.round((mm / MM_PER_INCH) * PRINT_DPI);

const A4_W = mmToPx(A4.widthMm);
const A4_H = mmToPx(A4.heightMm);

/**
 * Inlines remote assets as data URIs.
 *
 * The renderer reads the SVG from memory and has no document to resolve a relative or
 * remote `href` against — as an image library it fetches nothing. A photo stored on the
 * campus's object storage therefore has to be carried inside the document, or every card
 * prints with an empty photo frame and nobody notices until the plastic arrives.
 */
async function inlineAssets(svg: string) {
  // Both remote and site-relative sources: the logo and the signature live in `public/`
  // and are written as `/card-logo.png`, which an image library cannot resolve either.
  const urls = [
    ...new Set(
      [...svg.matchAll(/(?:href|xlink:href)="((?:https?:\/\/|\/)[^"]+)"/g)].map((m) => m[1]),
    ),
  ];

  let out = svg;
  for (const url of urls) {
    try {
      const loaded = url.startsWith("/") ? await readPublic(url) : await readRemote(url);
      if (loaded) out = out.split(url).join(loaded);
    } catch {
      // An asset that cannot be read leaves its frame empty and is reported as missing,
      // which is better than failing the whole print run over one student.
    }
  }

  return out;
}

/** A file shipped in `public/`, read from disk and carried inside the document. */
async function readPublic(url: string) {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");

  // The leading slash maps to the web root, so the file is under public/ and nowhere else.
  const file = path.join(process.cwd(), "public", decodeURIComponent(url.replace(/^\/+/, "")));
  const bytes = await readFile(file);
  const type = url.toLowerCase().endsWith(".svg") ? "image/svg+xml" : url.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** A photo already stored on the campus's object storage. */
async function readRemote(url: string) {
  const response = await fetch(url);
  if (!response.ok) return null;

  const type = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:${type};base64,${bytes.toString("base64")}`;
}

/** Renders one SVG face to a PNG at exactly the card's print size. */
export async function renderCardPng(svg: string, widthMm = CR80.widthMm, heightMm = CR80.heightMm) {
  const width = mmToPx(widthMm);
  const height = mmToPx(heightMm);

  const withAssets = await inlineAssets(svg);

  return sharp(Buffer.from(withAssets), { density: PRINT_DPI })
    .resize(width, height, { fit: "fill" })
    .png()
    .toBuffer();
}

/**
 * Corner cut guides, drawn in the gap so the guillotine has something to follow.
 *
 * The document is described in millimetres but rendered to the same pixel canvas as the
 * cards above it, so the viewBox is the pixel size while every coordinate inside is a
 * millimetre. Getting those two units confused puts the marks beside the card rather than
 * at its corners, which is worse than no marks at all.
 */
function cutMarksSvg(positions: { xMm: number; yMm: number }[], widthMm: number, heightMm: number) {
  const tick = 1.5;
  const marks = positions
    .flatMap(({ xMm, yMm }) => {
      const corners: [number, number, boolean, boolean][] = [
        [xMm, yMm, true, true],
        [xMm + widthMm, yMm, false, true],
        [xMm, yMm + heightMm, true, false],
        [xMm + widthMm, yMm + heightMm, false, false],
      ];
      return corners.map(([x, y, atLeft, atTop]) => {
        // Each mark is an L in the gap outside the corner, never crossing the artwork.
        const hx = atLeft ? `M${x - tick} ${y} H${x}` : `M${x} ${y} H${x + tick}`;
        const vy = atTop ? `M${x} ${y - tick} V${y}` : `M${x} ${y} V${y + tick}`;
        return `<path d="${hx} ${vy}" stroke="#9CA3AF" stroke-width="0.15" fill="none"/>`;
      });
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${A4_W}" height="${A4_H}" viewBox="0 0 ${A4.widthMm} ${A4.heightMm}">${marks}</svg>`;
}

/** A sheet rendered to a single PNG, ready to be placed in the PDF. */
export async function renderSheetPng(
  sheet: Sheet,
  side: "fronts" | "backs",
  caption: string,
) {
  const placements = sheet[side];

  const base = sharp({
    create: {
      width: A4_W,
      height: A4_H,
      channels: 3,
      background: "#ffffff",
    },
  });

  const layers: OverlayOptions[] = [];

  for (const { card, at } of placements) {
    const png = await renderCardPng(side === "fronts" ? card.frontSvg : card.backSvg);
    layers.push({
      input: png,
      left: mmToPx(at.xMm),
      top: mmToPx(at.yMm),
    });
  }

  const marks = await sharp(Buffer.from(cutMarksSvg(placements.map((p) => p.at), CR80.widthMm, CR80.heightMm)))
    .png()
    .toBuffer();
  layers.push({ input: marks, left: 0, top: 0 });

  // The caption names the sheet's purpose and page, so a pile of prints can be told apart.
  const captionSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4.widthMm}mm" height="${SHEET.captionMm}mm" viewBox="0 0 ${A4.widthMm} ${SHEET.captionMm}">
    <text x="${A4.widthMm / 2}" y="${SHEET.captionMm - 1.5}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="3.2" fill="#6B7280">${escapeForSvg(caption)}</text>
  </svg>`;
  layers.push({
    input: await sharp(Buffer.from(captionSvg)).png().toBuffer(),
    left: 0,
    top: A4_H - mmToPx(SHEET.captionMm),
  });

  return base.composite(layers).png().toBuffer();
}

function escapeForSvg(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
