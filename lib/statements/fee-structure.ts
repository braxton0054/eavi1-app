/**
 * The fee structure is built from the programme's published fee plan — the same rows that
 * raise invoices. There is no uploaded PDF to keep in step with it.
 *
 * Pure by design: no clock, no database. The caller supplies every value, so a proof can be
 * generated from a known plan and the document is reproducible.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { escapeXml, kes } from "./fee-docs";

const TEMPLATE_PATH = path.join(process.cwd(), "lib", "statements", "templates", "eavi-fee-structure.svg");
let cached: string | null = null;

function template(): string {
  if (!cached) cached = readFileSync(TEMPLATE_PATH, "utf8");
  return cached;
}

export type FeeStructurePeriod = {
  label: string;
  amount: number;
  yearIndex: number | null;
  semesterNo: number | null;
};

export type FeeStructureInput = {
  programName: string;
  programCode: string;
  level: string;
  durationMonths: number;
  version: number;
  issuedOn: string;
  periods: FeeStructurePeriod[];
  logoUrl?: string;
};

/** The two columns a period carries on the page, ordered like an invoice. */
function stageOf(period: FeeStructurePeriod): string {
  const parts: string[] = [];
  if (period.yearIndex) parts.push(`Year ${period.yearIndex}`);
  if (period.semesterNo) parts.push(`Semester ${period.semesterNo}`);
  return parts.join(" · ") || "Programme fee";
}

/**
 * Flowing rows, not fixed slots: a programme may publish any number of periods, and a fixed
 * row count would either clip a long plan or waste a page on a short one.
 */
function periodRows(periods: FeeStructurePeriod[]): { rows: string; endY: number } {
  const rowHeight = 34;
  const firstY = 340;
  const rows = periods
    .map((period, index) => {
      const y = firstY + index * rowHeight;
      const band = index % 2 === 0 ? ' fill="#FAFAFA"' : ' fill="#FFFFFF"';
      return `<rect x="40" y="${y - 20}" width="714" height="${rowHeight}"${band}/>` +
        `<text x="56" y="${y}" font-size="12" class="ink">${escapeXml(period.label || `Period ${index + 1}`)}</text>` +
        `<text x="470" y="${y}" text-anchor="end" font-size="11" class="muted">${escapeXml(stageOf(period))}</text>` +
        `<text x="738" y="${y}" text-anchor="end" font-size="12" font-weight="bold" class="ink">${kes(period.amount)}</text>`;
    })
    .join("\n");
  return { rows, endY: firstY + (periods.length - 1) * rowHeight + 24 };
}

/** Fill every slot; a missing value becomes an em dash rather than raw template text. */
export function buildFeeStructureSvg(input: FeeStructureInput): string {
  const { rows, endY } = periodRows(input.periods);
  const total = input.periods.reduce((sum, period) => sum + (Number.isFinite(period.amount) ? period.amount : 0), 0);
  const values: Record<string, string> = {
    logo_url: input.logoUrl ?? "eavi-logo.png",
    program_name: input.programName,
    program_code: input.programCode,
    level: input.level,
    duration: input.durationMonths === 1 ? "1 month" : `${input.durationMonths} months`,
    version: String(input.version),
    issued_on: input.issuedOn,
    period_rows: rows,
    total_y: String(endY),
    total_text_y: String(endY + 30),
    total: kes(total),
    note_y: String(endY + 56),
    note_text_y: String(endY + 82),
    note_text2_y: String(endY + 104),
  };

  return template().replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
    key === "period_rows" ? values[key] ?? "" : escapeXml(values[key] ?? "—"));
}

/** Safe, readable filename for the download. */
export function feeStructureFilename(programCode: string): string {
  return `Fee-Structure-${programCode.replace(/[^A-Za-z0-9]+/g, "-")}.svg`;
}
