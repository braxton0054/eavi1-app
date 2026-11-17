# Task: Reusable Class IDs, Student ID Card Generation, and Fee Document Templates

You are implementing this task in an ISOLATED GIT WORKTREE that is already created for
you. Do not work anywhere else.

## Worktree (already exists — do not create another)

- Path: `/home/brax/.local/share/opencode/worktree/39e5b7/feature/reusable-class-ids-fee-templates`
- Branch: `feature/reusable-class-ids-fee-templates` (clean, at main's tip)

## Setup before anything

```bash
cp /home/brax/Desktop/eavi1-app/.env .env   # the worktree has no .env
npm ci
npx prisma generate
```

## Things you must know (they changed recently — verify, don't assume)

1. The card artwork lives IN `components/id-card-svg.tsx` (`CARD_TEMPLATES`) —
   `card-templates/*.svg` no longer exist. Print rendering imports from there.
2. Contabo S3: every API call must address the bucket as
   `<S3_ACCOUNT_ID>:<S3_BUCKET>` (`lib/storage.ts` `apiBucket()`). The plain name gets
   `InvalidAccessKeyId`.
3. Notifications deliver fire-and-forget. NEVER add a static
   `import { after } from "next/server"` to any module the socket server imports
   (`lib/chat/messages.ts` -> `lib/notifications/service.ts`) — it crashed the app
   container at boot.
4. Card generation already reuses card serials per student AND has batch
   deduplication (`contentHash` on `card_batches` + the action-level `actionHash`).
   Verify it satisfies the reuse spec instead of rebuilding it.
5. An EMERGENCY hotfix sits at the end of `app/styles/motion.css`
   (`[data-state="closed"] { animation: none !important }`) — popup exit animations are
   broken by CSS-Modules name hashing. Moving the `eavi-*` animations into global
   motion.css (keyed by `data-slot`) is the real fix; delete the hotfix once yours works.

## The invoice mapping (decided — do not wait for another design)

The folder `incoice templete/` holds THREE svg designs: `eavi-receipt.svg` (titled
"FEE PAYMENT RECEIPT"), `eavi-statement-first-page.svg` and
`eavi-statement-next-page.svg`. There is no separate invoice artwork: the RECEIPT
template doubles as the INVOICE document.

- **Invoice view/download** = the receipt template filled from ONE invoice record:
  the `receipt_no` slot = the invoice NUMBER; item1..4 = that invoice's lines (more
  than four lines collapse into a fourth "Other charges" line); `amount_paid` = the
  payments applied to that invoice; `total_fees` = the invoice's total; `balance` = its
  outstanding.
- **Receipt view/download** = the same template filled from a receipt number's payment
  rows (as specified in the task).
- Do not invent a different layout for either; the band text stays as designed.

## Rules

- Inspect first; the supplied SVG templates in `incoice templete/` are the source of
  truth — do not redesign them.
- Run the full check set before reporting: `npm run lint` (0 errors),
  `npx tsc --noEmit`, `npm run build`, the `verify:*` scripts, and browser tests of
  every flow you touch at 375px / 1366x768 / 1920x1080.
- Merge into main with a normal merge, NEVER push --force, and watch CI and the Deploy
  workflow go green before reporting success.
- Report: files added/changed, migrations, how reuse works, test results, and anything
  left unfinished — no half-finished work.

## Report back

List: files added/changed, migrations, how class-ID reuse works, how the templates are
populated, how on-demand viewing/downloading works, the storage optimizations, the test
results, and anything left unfinished.
