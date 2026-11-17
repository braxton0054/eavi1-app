# Task: Reconcile all Git trees, then fix the popup freeze (B + H) in the u/ux-fix worktree

## Context

main has moved far past your `perf/redis-bullmq` worktree (@ 0bad5ff). It now carries, all
deployed and verified:

- Web push + notification bell (lib/notifications/*, public/sw.js, API routes)
- Google OAuth ending in the portal's own session (lib/oauth, api/auth/google/*)
- The card artwork moved into components/id-card-svg.tsx (single source, screen + print)
- Fee statement PDF (lib/statements/fees-statement.ts + GET /student/fees/statement)
- Contabo storage fix: API calls must use `accountId:bucket` (lib/storage.ts `apiBucket()`)
- Admin identities from .env (SUPER_ADMIN_EMAIL / MAIN_CAMPUS_ADMIN_EMAIL /
  WEST_CAMPUS_ADMIN_EMAIL) with seed alignment
- Dashboard CSS repairs: Panel/StatTile as CSS Modules (panel.module.css); sticky sidebar
  with a scroll-contained nav; the bell as a non-modal Popover that closes on navigation
- Next.js upgraded 16.4.4 -> 16.4.6 for the security advisory (keep
  `experimental.agentUpgrade: "security"`)
- EMERGENCY HOTFIX already on main: app/styles/motion.css ends with
  `[data-state="closed"] { animation: none !important; }` — popups unmount instantly so the
  body lock always releases. It kills every exit animation. Your section B below replaces
  it; delete it once the real fix ships.

## 1. Reconcile your branch (perf/redis-bullmq @ 0bad5ff)

- From your worktree: `git fetch origin` then `git rebase origin/main`.
- Conflicts you will hit: lib/dal/cards.ts, prisma/schema.prisma, lib/cards/batch.ts,
  worker.ts, lib/queue/*. Resolve keeping BOTH intents: the queue is yours; the artwork
  move (templates() importing CARD_TEMPLATES from components/id-card-svg) and the storage
  `apiBucket()` fix are main's.
- CRITICAL: notifications deliver fire-and-forget on purpose — a static
  `import { after } from "next/server"` inside anything the socket server imports
  (lib/chat/messages.ts -> lib/notifications/service.ts) crashed the app container at
  boot. When you re-wire BullMQ, swap ONLY `scheduleDelivery()` in
  lib/notifications/service.ts to enqueue; never add a static next/server import back
  into that module graph.
- After the rebase run ALL of: `npm run lint` (0 errors), `npx tsc --noEmit`,
  `npm run build` (if the security nudge appears once, rerun the same command),
  `npx tsx scripts/verify-cards.ts` (40 checks), `verify-fees-statement.ts` (13),
  `verify-google-oauth.ts` (36).
- Merge into main with a regular merge or fast-forward. NEVER push --force to main; it
  has moved and is deployed. Push, then watch CI and the Deploy workflow succeed.

## 2. B. FROZEN UI AFTER ANY DROPDOWN, SELECT, MENU, BELL OR DIALOG (probable single root cause)

Symptom: after opening a dropdown, select, list, the bell or a dialog, the app stops
responding until a full reload. The bell stays "active".

Cause (confirmed at runtime on the built CSS): components/ui/{menu,select,popover,dialog,
sheet,tooltip}.module.css use `animation: eavi-pop-in/out`, `eavi-fade-in/out` and
`eavi-sheet-in/out`. The @keyframes are defined in the global app/styles/motion.css, but
CSS Modules localise animation names to hashed ones (verified in the build:
`animation: cbYvwG_eavi-pop-out ...`) that have no matching keyframes. Radix Presence
reads the closed state's animation-name, sees it is not "none", and waits for an
animationend event that never fires. The popup never unmounts, so Radix never releases
body pointer-events:none, the scroll lock (`data-scroll-locked`) or aria-hidden.

Scope: all four signed-in areas ((dashboard), (student), (tutor), (portal)) share these
components; login and public pages are unaffected.

Fix — option 1 is MANDATORY (not one of several choices):
- Move every `animation: eavi-*` rule OUT of the .module.css files into the global
  app/styles/motion.css, keyed by attribute selectors, e.g.
  `[data-slot="menu-content"][data-state="open"] { animation: eavi-pop-in ... }` and the
  same for select, popover, dialog, sheet, tooltip. Global CSS keeps the keyframe names
  unhashed so Radix receives its animationend.
- This also applies to the other module-referenced animations: the spinners (`eavi-spin`
  in button/spinner/bell), the skeleton shimmer (`eavi-shimmer`), the toast slide
  (`eavi-slide-up`) and the drawer overlay fade (`eavi-fade-in`) — none of them animate
  today for the same reason.
- Do NOT leave any `animation: eavi-*` rule inside a .module.css file when you are done.
- DELETE the emergency hotfix rule from motion.css once exit animations work again.

Also (already done on main, keep it): the bell uses components/ui/popover.tsx (non-modal),
is controlled (open/onOpenChange), closes on route change, and closes in `openItem`
before the hard navigation.

### Verification (mandatory)
Open and close every kind of popup 10 times — bell, account menu, select, searchable
select, dialog, sheet — in all four areas ((dashboard), (student), (tutor), (portal)).
After each close:
- `document.body.style.pointerEvents` must not be `"none"`
- `document.body` must not carry `data-scroll-locked`
- no element with `data-state="closed"` may remain in the DOM
Also verify the built CSS contains the unhashed keyframes
(`grep -o "animation:[^;]*pop-out[^;]*" .next/static/chunks/*.css` must show plain
`eavi-pop-out`, not a hashed name).

## 3. H. POPUP Z-INDEX

The menu, select, popover, dialog, sheet, tooltip and the mobile sidebar drawer all use
`z-index: var(--z-overlay)` (40). Add tokens `--z-dropdown: 50`, `--z-modal: 55`,
`--z-popover: 58` (below `--z-toast: 60`), so a select opened inside a dialog or sheet
always stays on top. Apply them per component: dropdown 50, dialog/sheet 55, popover 58,
tooltip 58.

## 4. D. Cards and panels (already done on main — do not regress)

Panel and StatTile are CSS Modules (components/dashboard/panel.module.css): flush body,
`--card-pad` everywhere, DetailList rows padded with the same var. Keep it that way.

## 5. E. Shell (already done on main — do not regress)

`.content` in app-shell.module.css is centred (`margin-inline: auto`); the dead
`.container/.appShell/.appMain/.appContent` rules are gone from app/styles/layout.css.

## 6. Migration order after B and H

Port the remaining (dashboard) pages from Tailwind to modules, worst first: calendar,
students/[id], classes/[id], accounts, programs/[id], classes/merge, applications,
dashboard/page.tsx. When nothing uses Tailwind any more, remove the Tailwind imports and
globals.css. Test at 375px, 1366x768 and 1920x1080 after each step. Do not remove
features.

## 7. Worktree discipline

- Your current worktree: redis-bullmq-perf (merge + delete per section 1).
- The NEW worktree for the UX fixes: /home/brax/.local/share/opencode/worktree/39e5b7/u/ux-fix
  (checked out from main @ 411521e). `git checkout -b <branch>` there and do sections
  B/H and the page ports there — never in main directly.
- NEVER push --force to main. NEVER rewrite pushed history.
- Scratch files you may delete: scripts/_test-live.mjs, ui-ux/shots/.

## Report back

List: the rebase result, what you merged, what you deleted, the B/H verification numbers
(the 10x open/close test results per area), the built-CSS keyframe check, and the deploy
run URL. If a rebase conflict cannot be resolved cleanly, stop and report it instead of
guessing.
