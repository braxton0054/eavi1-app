/**
 * The fee statement — a mini statement for one student: what was billed, what was
 * paid, the running balance, and the transactions behind them.
 *
 * Like the card artwork, the statement is SVG described in millimetres (10 units = 1mm,
 * A4 portrait) so the printed page is true to size: the render pipeline rasterises the
 * document at 300 DPI and hands it to pdf-lib. The builder is pure — it takes data, not
 * a database — so a proof can be generated anywhere the numbers are already known.
 */

export const A4_PORTRAIT = { widthMm: 210, heightMm: 297 } as const;

/** The transactions a statement shows, newest at the bottom like a bank statement. */
export type FeesStatementTx = {
  /** Already formatted for print, e.g. "12 Feb 2026". */
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
};

export type FeesStatementInput = {
  fullName: string;
  admissionNo: string;
  course: string;
  campus: string;
  intake?: string | null;
  /** Formatted for print, e.g. "16 Nov 2026". */
  statementDate: string;
  logoUrl?: string | null;
  website: string | null;
  contactEmail: string | null;
  transactions: FeesStatementTx[];
};

/** A mini statement stays one page: the most recent rows win, the oldest are summarised. */
const MAX_ROWS = 20;

const INK = "#1F2937";
const MUTED = "#6B7280";
const BRAND = "#800080";
const ACCENT = "#5c005c";
const LINE = "#E5E7EB";
const LIGHT = "#F3F4F6";

/** Statement columns, in template units (10 units = 1mm). */
const COLS = {
  left: 120,
  date: 120,
  description: 460,
  debit: 1420,
  credit: 1700,
  balance: 1980,
} as const;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const money = (value: number) =>
  `KSh ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A long reference must not push into the amounts column; an ellipsis says it was cut. */
function fit(text: string, max: number) {
  return text.length <= max ? escapeXml(text) : `${escapeXml(text.slice(0, max - 1))}…`;
}

/**
 * Builds the statement document.
 *
 * Totals are derived from the same transactions the table shows — a statement whose
 * summary disagreed with its own rows would be worse than no statement at all.
 */
export function feesStatementSvg(input: FeesStatementInput): string {
  const ordered = [...input.transactions]
  // Oldest first, like a bank statement; rows without a date keep their given order.
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const billed = ordered.reduce((sum, tx) => sum + (tx.debit ?? 0), 0);
  const paid = ordered.reduce((sum, tx) => sum + (tx.credit ?? 0), 0);
  const balance = billed - paid;

  const omitted = Math.max(0, ordered.length - MAX_ROWS);
  const shown = ordered.slice(omitted === 0 ? 0 : ordered.length - MAX_ROWS);
  // The carried balance is what the hidden older rows added up to, so the first visible
  // row continues a story instead of starting one mid-air.
  const opening = ordered.slice(0, omitted).reduce((sum, tx) => sum + (tx.debit ?? 0) - (tx.credit ?? 0), 0);

  const rows: string[] = [];

  if (omitted > 0) {
    rows.push(`
    <rect x="${COLS.left}" y="952" width="1860" height="56" fill="${LIGHT}"/>
    <text x="${COLS.date + 10}" y="988" font-size="24" font-style="italic" fill="${MUTED}">Opening balance — ${omitted} older transaction${omitted === 1 ? "" : "s"}</text>
    <text x="${COLS.balance}" y="988" text-anchor="end" font-size="24" font-weight="bold" fill="${INK}">${escapeXml(money(opening))}</text>`);
  }

  shown.forEach((tx, index) => {
    const y = (omitted > 0 ? 1008 : 952) + index * 62;
    const shade = (omitted > 0 ? index + 1 : index) % 2 === 1;
    rows.push(`
    ${shade ? `<rect x="${COLS.left}" y="${y}" width="1860" height="56" fill="${LIGHT}"/>` : ""}
    <text x="${COLS.date + 10}" y="${y + 38}" font-size="24" fill="${MUTED}">${escapeXml(tx.date)}</text>
    <text x="${COLS.description}" y="${y + 38}" font-size="24" fill="${INK}">${fit(tx.description, 44)}</text>
    ${tx.debit !== null ? `<text x="${COLS.debit}" y="${y + 38}" text-anchor="end" font-size="24" fill="${INK}">${escapeXml(money(tx.debit))}</text>` : ""}
    ${tx.credit !== null ? `<text x="${COLS.credit}" y="${y + 38}" text-anchor="end" font-size="24" fill="${INK}">${escapeXml(money(tx.credit))}</text>` : ""}
    <text x="${COLS.balance}" y="${y + 38}" text-anchor="end" font-size="24" font-weight="bold" fill="${INK}">${escapeXml(money(opening + ordered.slice(omitted, omitted + index + 1).reduce((sum, t) => sum + (t.debit ?? 0) - (t.credit ?? 0), 0)))}</text>`);
  });

  if (shown.length === 0) {
    rows.push(`
    <text x="1050" y="1050" text-anchor="middle" font-size="26" font-style="italic" fill="${MUTED}">No transactions on this account yet.</text>`);
  }

  const student = (
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
  ) => `
    <text x="${x}" y="${y}" font-size="20" fill="${MUTED}" letter-spacing="1.5">${escapeXml(label)}</text>
    <text x="${x}" y="${y + 40}" font-size="30" font-weight="bold" fill="${INK}" data-max-width="${width}">${escapeXml(value)}</text>`;

  const summary = (label: string, value: string, x: number, emphasis: boolean) => `
    <rect x="${x}" y="660" width="600" height="150" rx="16" fill="${emphasis ? BRAND : LIGHT}"/>
    <text x="${x + 300}" y="705" text-anchor="middle" font-size="20" letter-spacing="1.5" fill="${emphasis ? "#FFFFFF" : MUTED}">${escapeXml(label)}</text>
    <text x="${x + 300}" y="768" text-anchor="middle" font-size="44" font-weight="bold" fill="${emphasis ? "#FFFFFF" : INK}">${escapeXml(value)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 2100 2970" font-family="'Liberation Sans', Arial, Helvetica, sans-serif">
  <!-- EAVI fee statement — mini statement | A4 portrait | 10 units = 1mm -->
  <rect width="2100" height="2970" fill="#FFFFFF"/>

  <!-- header -->
  <image href="${escapeXml(input.logoUrl || "/card-logo.png")}" x="120" y="70" width="170" height="170" preserveAspectRatio="xMidYMid meet"/>
  <text x="340" y="150" font-size="46" font-weight="bold" fill="${INK}">EAST AFRICA VISION INSTITUTE</text>
  <text x="340" y="200" font-size="26" font-weight="bold" fill="${BRAND}" letter-spacing="2">FEE STATEMENT — MINI STATEMENT</text>
  <text x="1980" y="130" text-anchor="end" font-size="22" fill="${MUTED}">Issued ${escapeXml(input.statementDate)}</text>
  <text x="1980" y="165" text-anchor="end" font-size="22" fill="${MUTED}">${escapeXml(input.website ?? "")}</text>
  <line x1="120" y1="270" x2="1980" y2="270" stroke="${BRAND}" stroke-width="4"/>
  <line x1="120" y1="280" x2="1980" y2="280" stroke="${ACCENT}" stroke-width="2"/>

  <!-- student -->
  ${student("FULL NAME", input.fullName, COLS.left, 340, 1800)}
  ${student("REG NO.", input.admissionNo, 1450, 340, 530)}
  ${student("COURSE", input.course, COLS.left, 440, 900)}
  ${student("CAMPUS", input.campus, 1450, 440, 530)}
  ${input.intake ? student("INTAKE", input.intake, COLS.left, 540, 900) : ""}

  <!-- summary: billed, paid, balance -->
  ${summary("TOTAL BILLED", money(billed), 120, false)}
  ${summary("TOTAL PAID", money(paid), 750, false)}
  ${summary(balance > 0 ? "BALANCE DUE" : "BALANCE", money(balance), 1380, true)}

  <!-- table -->
  <rect x="${COLS.left}" y="880" width="1860" height="52" fill="${INK}"/>
  <text x="${COLS.date + 10}" y="915" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">DATE</text>
  <text x="${COLS.description}" y="915" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">DESCRIPTION</text>
  <text x="${COLS.debit}" y="915" text-anchor="end" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">DEBIT</text>
  <text x="${COLS.credit}" y="915" text-anchor="end" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">CREDIT</text>
  <text x="${COLS.balance}" y="915" text-anchor="end" font-size="22" font-weight="bold" fill="#FFFFFF" letter-spacing="1.5">BALANCE</text>
  ${rows.join("\n")}

  <!-- footer -->
  <line x1="120" y1="2820" x2="1980" y2="2820" stroke="${LINE}" stroke-width="3"/>
  <text x="120" y="2870" font-size="20" fill="${MUTED}">Computer generated statement — valid without a signature.</text>
  <text x="1050" y="2870" text-anchor="middle" font-size="20" fill="${MUTED}">${escapeXml(input.website ?? "")}</text>
  <text x="1980" y="2870" text-anchor="end" font-size="20" fill="${MUTED}">${escapeXml(input.contactEmail ?? "")}</text>
</svg>`;
}
