# Document system rebuild — plan

## Scope (must not drift)
- SVG edits are limited to: **QR position only** in the invoice and transaction templates;
  **branding + fixed safe zones** in the ID card template; **font sizes only** in the
  admission letter. Student profile and fee structure templates keep their design — content
  or rendering only.
- EAVI brand comes from the existing ID card artwork: ink `#1F2937`, violet `#800080`,
  accent `#5c005c`, muted `#6B7280`, logo `public/card-logo.png` (not the Anthropic palette).
- UI rules: 4/8 spacing, 4.5:1 text contrast, 44px targets, visible focus, no template look.

## 0. Shared storage + auto-regenerate layer
`GeneratedDocument` row: `kind, scopeKey, sourceHash, snapshot Json, svgText, storageUrl,
fileName, status, version, updatedAt`, unique on `(kind, scopeKey)`.
`lib/documents/service.ts`:
- `ensureDocument(kind, key, loader)` — load saved row; return it unchanged when it exists.
  Missing row is rendered once as a lazy fallback (idempotent upsert).
- `touchDocument(kind, key)` — source changed: mark `STALE`, enqueue one deduplicated
  background `document-refresh` job; never render in the request.
- refresh job re-reads the snapshot, compares hashes, renders and uploads only on change,
  increments `version`, writes the new hash and returns the row to `CURRENT`.
Hooks on writes: enrolment/student change, payment, fee-plan save.

## 1. ID cards
- Auto-create at enrolment (already) + backfill migration for older students.
- Saved card document holds front/back on A4; any student change calls `touchStudent`,
  which touches the card and profile documents. Photo/name/class changes need no click.
- ID page: view / print / download / share + bulk print and bulk download by intake, class
  or individual. Removing the "Generate" tab and button everywhere.
- Template-change bulk regeneration: one action that touches all card documents.

## 2. Invoices
- `touchInvoice` after every successful payment (all three payment paths) and on void;
  invoice is saved by invoice id, view/print/download/share only. Manual generation removed.

## 3. QR position only
- Reserve a clear box away from text in `eavi-receipt.svg` and both statement pages; the
  real QR is drawn in that box. Short and very long sample data rendered to PNG and checked.

## 4. Student profile
- Saved document; snapshot contains every field filled during enrolment, no fee fields.
  Template design unchanged; add only the missing text fields in the existing panels.

## 5. Fee structures
- Saved per active plan, loaded on view; `touchProgram` on fee-plan save regenerates it in
  the background. Grouped by department, individual view, inline browser PDF. No generate.

## 6. Admission letter
- Raise body text to ~11–12pt and headings; only spacing needed to prevent overlap. Test
  long names and programme titles.

## Order and verification
0 storage → 1 cards → 2 invoices + QR → 3 fee structures → 4 profile → 5 letter.
Verify: PNG proofs for short/long data, `tsc`, lint, UI audit, build, live routes, then
summary of tables and files touched.
