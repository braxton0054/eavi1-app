# Fee structure: generated from the programme's own fee inputs

## What exists today

- **Programme form** uploads an optional `feeStructure` PDF. It is stored in object storage as
  `program.feeStructureUrl` (`lib/actions/college/programs.ts` → `programmeDocuments`).
- **Programme fee editor** already holds the real figures: `ProgramFeePlan` (version, cadence,
  duration, total) and `FeeItem` rows (label, amount, year, semester, due offset).
- **Admission letter** (`lib/admissions/letter.ts`) fetches the uploaded PDF and appends it to
  the letter. `OfferLetter` freezes `feeStructureUrl` at issue time.
- **Programme cards** show "No fee sheet" when no PDF was uploaded, even when a full fee plan
  with amounts is published.
- **Artwork pattern**: ID cards and statements are SVG templates with `{{slots}}`, filled by a
  pure merge engine (`lib/cards/template.ts`) and rendered from the same string on screen and
  on paper (`components/id-card-svg.tsx`, `lib/statements/fee-docs.ts`). The project already
  has A4 templates and a logo in `lib/statements/templates/`.

The problem: the office types the fee amounts into the programme once, then has to create and
upload a separate PDF that can drift out of date. The published plan is authoritative for
invoices but not for the document applicants receive.

## Decision

Remove the upload. Generate the fee structure **from the published fee plan** with an A4 SVG
template built the same way as the ID card artwork. One source of figures.

## What to build

### 1. A4 fee-structure template (SVG, slot-based)
- New `lib/statements/templates/eavi-fee-structure.svg`: A4 (210 × 297 mm, viewBox in the
  same unit scale as the statement templates), EAVI violet header, logo slot, programme name,
  code, level, duration, version, effective note, and a table of periods with amount columns.
- Slots (`{{program_name}}`, `{{program_code}}`, `{{cadence}}`, `{{duration}}`, `{{version}}`,
  `{{issued_on}}`, `{{period_rows}}`, `{{total}}`, `{{logo_url}}`) filled by a pure merge
  function — same escaping and missing-value rules as the card template.
- `{{period_rows}}` is built from the `FeeItem` rows in sequence order: label, year/semester,
  amount. A compact footer states that fees are billed per period and instalments are allowed.

### 2. Generator (`lib/statements/fee-structure.ts`)
- `buildFeeStructureSvg(input)` → merged SVG string, no clock and no database.
- `feeStructureFilename(program)` for a safe download name.
- Render to PDF with the existing `renderAdmissionLetterPdf` (Chromium) path, with the same
  fallback behaviour already used by the letter route.

### 3. Route
- `GET /api/programs/[id]/fee-structure?format=svg|pdf` (signed-in admin + student/applicant
  with a token where needed). The admin programme page links to it; the admission letter uses
  the generated URL instead of an uploaded file.
- Public applicant access uses the same `reference + verifyToken` pattern already in
  `/letter/[reference]`, so no new authority model is invented.

### 4. Remove the upload
- Remove the `feeStructure` file field from the programme form and from
  `programmeDocuments`/`saveProgrammeDocuments`; keep the curriculum upload.
- Copy changes: "No fee sheet" → "Set fees" / "View fee structure" now reflects the plan.
- Stop appending a fetched PDF in `lib/admissions/letter.ts` when a plan exists; append the
  generated document instead. Keep the old `feeStructureUrl` column in the database for
  historical programmes (read-only fallback), but no new uploads write to it.

### 5. Behaviour rules
- No published plan → the fee-structure link says "Publish a fee plan first" (honest empty
  state), not an uploaded-file placeholder.
- A plan with zero total is rejected at save time already (`zeroTotal`).
- Historical letters keep the file they were issued with, so the document a student already
  received does not change.

## Order of work
1. SVG template + pure builder + unit proof from a known plan.
2. Route and links in the programme fee page/card.
3. Admission-letter integration (generated PDF instead of uploaded PDF).
4. Remove the upload field and dead copy.
5. Verify: generate SVG + PDF, open both, check amounts match the plan, check letter contains
   the generated document, audit/tsc/lint/build, push, deploy.

## Risks
- The existing A4 statement template has a fixed table width; the fee table must fit any
  number of periods a programme can publish. Use a flowing table rows block and a page-break
  rule rather than hard-coded rows.
- The generated PDF must remain readable on a phone; the SVG is the primary document and the
  PDF is for printing.
