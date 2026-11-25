# Document automation — five rebuilds

## Principle

Documents are **derived views of records**, never a thing a person clicks to "generate".
When the underlying record changes, the document reflects it on the next view. No button
says "generate" on a page whose only job is to view, print or share.

---

## 1. ID cards: generated once, stored, auto-refreshed

**Now:** `CardGenerator` form with a "Generate" button; cards are rows in `IdCard`, and the
card face is merged from live student data on every read (`getCardFace`). A new card row is
created per student; a photo added later does not update an existing face unless a new run is
made.

**Target:**
- On enrolment / when a student record is created, ensure an `IdCard` row exists automatically
  (serial + token). This already happens in `enrolStudent` — keep and verify it.
- The card artwork is **rendered from the stored card row + the live student record on read**,
  so a new profile photo, corrected name or programme change appears without a button.
  A content hash of the merged face is stored on the card row; if the hash changes, the
  preview/print route uses the new face. No "Generate" action on the card detail page.
- `app/(dashboard)/dashboard/cards/page.tsx` becomes a **view/print/share** page: the
  generator form is removed from the main list; a separate "Print run" action can still make
  a *batch PDF* for a class/intake (that is a print job, not card creation). Card detail page
  has View, Print, Download, Share only.
- Backfill on deploy: a route/action `ensureCardsForAllStudents` creates missing `IdCard`
  rows for existing enrolled students (one per student), idempotent by student id. Run from a
  one-off script at deploy time, not on every request.

## 2. Invoices: automatic on payment, no generate button

**Now:** invoices exist per fee period from `generateFeeSchedule`; PDF is rendered on demand
from `invoicePdf()` using the receipt SVG.

**Target:** the invoice PDF is a derived view — after every payment (`recordWizardPayment`,
`recordStudentPayment`), the ledger moves and the next invoice view already shows the new
paid/balance figures. No "generate invoice" action exists (verify and remove any remaining
button). If a payment lands on a future period via cascade, that invoice's view reflects it
immediately. A stored `invoice.contentHash` is optional; the document is rendered from the
invoice + payments on read, so it cannot go stale.

## 3. Invoice & transaction SVG layout repair

**Now:** `eavi-receipt.svg` used for both invoice and receipt. QR at x=84/y≈672 with the
"SCAN TO CONFIRM" text at x=156/y=640; statement templates have QR at bottom-left with
text; reports of overlap.

**Target:** re-layout the A4 artwork with a reserved QR column (bottom-left, inside a
bordered box), fixed text zones that never cross it, and a header/amount block that reads in
one pass. Repair both the receipt/invoice template and the statement first/next templates.
Render proofs from known data and inspect the PNG before shipping. Keep the same slot names
so the builders need no changes.

## 4. Student details preview: view-only, no fees

**Now:** `/api/students/[id]/print` prints the whole admin detail page, which includes fee
information.

**Target:** a dedicated `StudentDetailsDocument` — an A4 SVG template with the student's
enrolment details captured during enrolment (name, admission no, programme, intake, campus,
class, phone, guardian name/relationship/phone, previous school, birth certificate status,
profile photo). New route `/api/students/[id]/details` returning PDF/SVG, admin-scoped.
The student detail page's Preview/Download button points here. No fee figures anywhere in
this document. Rebrand with EAVI violet header and the ID-card design language.

## 5. Fee structures: automatic, grouped, browser-viewable

**Now:** generated from the plan (just built) with View/Download links; static links per
programme.

**Target:**
- The superadmin never clicks "generate". On `saveProgramFeePlan`, the document's content
  hash is computed and stored on the plan; the View link always renders from the current
  active plan. A changed amount/period automatically produces a changed document on the
  next view — no manual step.
- Campus admins **view only**: the programmes list groups fee structures by department and
  each one opens the generated PDF inline in the browser (`Content-Disposition: inline`),
  with a Share/Download control. They cannot edit fees (already enforced).
- Deploy-time backfill: for every active plan, compute and store its document hash so the
  system knows which documents exist without clicking. Idempotent script.

## Deploy-time backfill

One script `scripts/backfill-documents.ts` (run via `npm run db:backfill` in the release/deploy
step, or manually on VPS):
1. ensure one `IdCard` per enrolled student without one;
2. compute `contentHash` for active fee plans;
3. verify the templates parse; log counts.
It must be safe to run repeatedly and must not rewrite historical letters/cards.

## Order of work
1. Templates: repair receipt/invoice + statement QR layout; add student-details template.
2. Routes: student details (PDF/SVG), fee structure inline PDF.
3. Auto behaviour: card refresh-on-read, no generate buttons, plan hash on save.
4. Backfill script + deploy wiring.
5. Verify: render every document from known records, inspect PNG proofs, audit/tsc/lint/build,
   push, deploy, check live routes.

## Risks
- Card face must stay derived from live student data — a stored raster would go stale; store
  only a hash, not the artwork.
- Inline PDF for fee structures must still carry a safe filename and no-store cache headers.
- Student details document must include only fields the admin may see (campus scope enforced).
