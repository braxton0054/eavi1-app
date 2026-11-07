/**
 * Print sheet layout for ID cards.
 *
 * A card is not printed one to a page — it goes onto A4 with many others and is cut apart,
 * so the arithmetic here is the part that has to be exact. Every number is in millimetres
 * because that is what the card printer and the guillotine are set in, and because a PDF
 * that says "85.6mm" prints at 85.6mm on any machine while pixels never do.
 *
 * CR80 is the bank-card size (ISO/IEC 7810 ID-1). Card printers and holders are built for
 * it, so the college's artwork is drawn to it and nothing here may scale a card.
 */

/** ISO/IEC 7810 ID-1, the size of a bank card. The artwork is authored to match. */
export const CR80 = { widthMm: 85.6, heightMm: 53.98 } as const;

/** A4, the paper the office actually has. */
export const A4 = { widthMm: 210, heightMm: 297 } as const;

/**
 * Margin and gap are set to leave room for a guillotine: cards butted together cannot be
 * cut without clipping the artwork, so a gap is deliberately kept between them.
 */
export const SHEET = {
  marginMm: 8,
  gapMm: 4,
  /** Space reserved along the bottom for the caption line, so it never lands on a card. */
  captionMm: 6,
} as const;

export type SheetGrid = {
  columns: number;
  rows: number;
  perPage: number;
  /** Where the first card starts, so the grid is centred rather than left-aligned. */
  offsetXMm: number;
  offsetYMm: number;
  usableWidthMm: number;
  usableHeightMm: number;
};

/**
 * How many cards fit on one A4 sheet, with fronts and backs alternating.
 *
 * A card is placed only if a whole card plus the gap after it fits; the leftover strip at
 * the right and bottom is left blank rather than squeezing one more card in, because a card
 * that overruns the paper margin is a wasted print.
 */
export function sheetGrid(page: "A4" | "A4-portrait" = "A4"): SheetGrid {
  const paper = page === "A4-portrait" ? { widthMm: A4.heightMm, heightMm: A4.widthMm } : A4;

  const usableWidthMm = paper.widthMm - SHEET.marginMm * 2;
  const usableHeightMm = paper.heightMm - SHEET.marginMm * 2 - SHEET.captionMm;

  // One card plus its gap, except the last in a row needs no trailing gap.
  const fits = (available: number, card: number) => {
    const count = Math.floor((available + SHEET.gapMm) / (card + SHEET.gapMm));
    return Math.max(0, count);
  };

  const columns = fits(usableWidthMm, CR80.widthMm);
  const rows = fits(usableHeightMm, CR80.heightMm);

  // Centre the block so the white margins are equal, which looks deliberate on a proof.
  const blockWidth = columns * CR80.widthMm + Math.max(0, columns - 1) * SHEET.gapMm;
  const blockHeight = rows * CR80.heightMm + Math.max(0, rows - 1) * SHEET.gapMm;

  return {
    columns,
    rows,
    perPage: columns * rows,
    offsetXMm: SHEET.marginMm + (usableWidthMm - blockWidth) / 2,
    offsetYMm: SHEET.marginMm + (usableHeightMm - blockHeight) / 2,
    usableWidthMm,
    usableHeightMm,
  };
}

export type CardPlacement = {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  /** Column and row on the sheet, for the cut marks and for the caption. */
  column: number;
  row: number;
};

/** Where each card on a sheet goes, given its index on that sheet. */
export function placementAt(index: number, grid: SheetGrid): CardPlacement {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);

  return {
    xMm: grid.offsetXMm + column * (CR80.widthMm + SHEET.gapMm),
    yMm: grid.offsetYMm + row * (CR80.heightMm + SHEET.gapMm),
    widthMm: CR80.widthMm,
    heightMm: CR80.heightMm,
    column,
    row,
  };
}

/** One card to print, already merged against the artwork. */
export type PrintableCard = {
  /** Used for the filename and the cut-out caption, never trusted as markup. */
  serial: string;
  label: string;
  frontSvg: string;
  backSvg: string;
};

export type Sheet = {
  page: number;
  /** Fronts on the sheet, back to back with the same order. */
  fronts: { card: PrintableCard; at: CardPlacement }[];
  backs: { card: PrintableCard; at: CardPlacement }[];
};

/**
 * Splits cards into sheets of fronts and backs.
 *
 * Fronts and backs are produced as separate sheets rather than interleaved pages, because a
 * duplex printer flips the sheet: the back grid must be the exact mirror of the front grid
 * or the reverse of every card lands on the wrong person's face.
 */
export function paginateSheets(cards: PrintableCard[], page: "A4" | "A4-portrait" = "A4") {
  const grid = sheetGrid(page);
  if (grid.perPage === 0 || cards.length === 0) return { grid, sheets: [] as Sheet[] };

  const sheets: Sheet[] = [];
  for (let start = 0; start < cards.length; start += grid.perPage) {
    const slice = cards.slice(start, start + grid.perPage);
    sheets.push({
      page: sheets.length + 1,
      fronts: slice.map((card, i) => ({ card, at: placementAt(i, grid) })),
      backs: slice.map((card, i) => ({ card, at: placementAt(i, grid) })),
    });
  }

  return { grid, sheets };
}
