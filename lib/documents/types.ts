/** The documents that are saved as records rather than rebuilt when someone opens them. */
export const DOCUMENT_KINDS = [
  "ID_CARD",
  "INVOICE",
  "RECEIPT",
  "STUDENT_PROFILE",
  "FEE_STRUCTURE",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DOCUMENT_STATUS = { CURRENT: "CURRENT", STALE: "STALE" } as const;

/** A document's saved rendering. The SVG is the source of the stored PDF. */
export type RenderedDocument = {
  svg: string;
  pdf: Buffer;
  fileName: string;
};

/** Plain, deterministic data. No Date objects, decimals or Prisma rows cross this boundary. */
export type Snapshot = Record<string, unknown>;

export type DocumentDefinition = {
  /** Reads the current source data into a deterministic snapshot for this scope. */
  load: (scopeKey: string) => Promise<Snapshot | null>;
  /** Renders a snapshot. This is pure with respect to the database and the clock. */
  render: (snapshot: Snapshot) => Promise<RenderedDocument>;
};
