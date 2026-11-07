import { PDFDocument } from "pdf-lib";

import { A4 } from "@/lib/cards/sheet";

/**
 * Writes the sheets into a PDF.
 *
 * The page is declared in points at A4's true size, and the 300 DPI images are scaled to
 * fill it exactly, so the printed card is 85.6 × 53.98 mm on paper rather than whatever
 * a browser preview decided to scale to. That precision is the whole point of exporting a
 * PDF instead of a folder of PNGs.
 */

/** 1 mm is 72/25.4 points in PDF's own units. */
const MM_TO_PT = 72 / 25.4;

export type SheetImage = { png: Buffer; label: string };

export async function buildCardsPdf(images: SheetImage[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle("EAVI student ID cards");
  pdf.setCreator("EAVI Portal");
  pdf.setProducer("EAVI Portal");

  const width = A4.widthMm * MM_TO_PT;
  const height = A4.heightMm * MM_TO_PT;

  for (const image of images) {
    const png = await pdf.embedPng(image.png);
    const page = pdf.addPage([width, height]);
    page.drawImage(png, { x: 0, y: 0, width, height });
  }

  return Buffer.from(await pdf.save());
}
