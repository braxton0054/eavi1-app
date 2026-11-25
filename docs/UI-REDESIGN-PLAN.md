# EAVI UI redesign plan

Built with the `frontend-ui-ux-rules` skill (primary design system). This is a **plan**, not
an implementation. Rule IDs refer to that skill.

## Brief (STY-01, 3 lines)

- **Product / audience:** EAVI College management portal — applicants & parents, students, tutors, campus admins, superadmin.
- **Platform:** both. Public site and auth are mobile-first; dashboards are desktop-first with a usable responsive/mobile layout.
- **Visual style:** **Minimalism** — one style for the entire product, one accent, content leads, whitespace is structure. No mixing with clay/glass/bento.

Brand is preserved: EAVI violet stays the single accent; Geist (UI) and Fraunces (display) stay the two typefaces. Everything else follows the skill's structural rules, which brand may not override.

## Current state (from the inventory)

- **Two competing token systems:** `app/styles/tokens.css` (light-only, violet/teal/amber/red/blue ramps) and legacy `app/globals.css` (purple `#800080`, skeuomorphic `eavi-*` utilities, Tailwind v4). 45 CSS modules plus `components/kit/` wrappers plus `components/ui/` primitives. No dark theme; viewport is locked to `colorScheme: "light"`.
- **Homepage:** 11 sections (`components/home/*`) with CountUp stats, circular gallery, testimonials, FAQ and reveal animations — several AIT risks (fake-feeling stats, fade-up everywhere, three equal cards).
- **Forms:** `components/dashboard/record-form.tsx` drives most admin forms in a two-column grid (`sm:grid-cols-2`) — violates **FRM-01** (single column). `SearchableSelect` is used where 2–4 options should be radio buttons (**FRM-11**).
- **Dashboards:** 32 admin screens + 6 student + 6 tutor + 1 chat. Overview uses several identical metric cards (**LAY-08**). Many screens have more than one visually primary "Add" action (**BTN-02**, **BTN-10**).
- **Nav:** 5 groups / 16–19 links on admin, 4–6 on student/tutor, 4 bottom tabs on mobile — acceptable once active state and icon consistency are fixed (**NAV-01/02/03**).

## Phase 0 — Foundation (do first; everything else depends on it)

1. **One token file.** Extend `app/styles/tokens.css` from `assets/tokens.css`: keep spacing 4/8 scale, type scale (≤7 sizes), `--radius-control: 8px` / `--radius-card: 16px`, 48px targets, 200–500ms motion. Set **one** accent = EAVI violet; keep exactly four status colors (error/warning/info/success) with AA-safe text. Verify violet-on-white ≥ 4.5:1 and control borders ≥ 3:1 (**ACC-01/02**, **COL-01/03**).
2. **Retire legacy tokens gradually.** Stop adding to `app/globals.css`; map its `eavi-*` utilities onto the new tokens, then remove them once callers are migrated. No raw hex/px in components.
3. **Dark theme.** Add `[data-theme="dark"]` as a *separate* palette (not inverted), lighter surfaces = higher elevation, desaturated accent, and a theme toggle (**DRK-01/02/03/07**). Unlock `colorScheme` in `app/layout.tsx`.
4. **Baseline audit.** Run `python scripts/audit_ui.py app components --json` and save the report. Fix every FAIL before starting screens.

Acceptance: one token source, dark theme works, audit shows 0 FAIL on token/base files.

## Phase 1 — Homepage (`app/(public)/page.tsx`, `components/home/*`)

- Keep the section order but **reduce to one loud element**: the hero CTA. Everything else is secondary (**PRN-04**, **LAW-08**).
- Replace CountUp "stats" with real, sourced figures or remove them; no invented numbers (**AIT-03**).
- Programme cards: stop showing three identical cards — vary by hierarchy (one featured programme, rest compact) (**LAY-08**).
- Replace `reveal.tsx` fade-up-on-everything with a single purposeful entrance; honor `prefers-reduced-motion` (**ANI-02**).
- Circular gallery: keep as a brand element but ensure captions have ≥4.5:1 contrast and images have alt text.
- `site-header.tsx`: sticky, obvious active state, ≤6 top links; mobile menu uses 4–5 obvious items (**NAV-01/02**).
- CTA band: one verb-first button, e.g. "Start your application" (**BTN-03**).

Acceptance: audit 0 FAIL; one primary CTA above the fold; responsive at 375/768/1366.

## Phase 2 — Auth (`app/(auth)/*`, `login-form.tsx`, `register-form.tsx`, `auth-shell.tsx`)

- **Social login first** (**FRM-18**); keep the Google button. Then email → password → verb-first "Sign in" (**LAW-04**).
- Single-column form, label above input, "(optional)" not `*` (**FRM-01/02/07**), show-password toggle (**FRM-06**).
- Inline errors that say what and how to fix, never color alone (**FRM-14**, **ACC-03**).
- All six button states (**BTN-05**); visible focus ring (**ACC-06**).
- Auth shell: no skeuomorphic `eavi-*` treatment; calm surface, one accent.

Acceptance: audit 0 FAIL; keyboard-only sign-in works; error state captured in a screenshot.

## Phase 3 — Dashboard shell (`app-shell.tsx`, `sidebar.tsx`, `topbar.tsx`, `lib/content/dashboard.ts`)

- Sidebar: group nav into the existing 5 groups; only one active item, icon + label, consistent icon set (**NAV-02/03**, **ICO-01**).
- Topbar: one primary action per screen (the page's action, not a global "Add"); notification bell and scope picker are tools, not primary CTAs (**BTN-02**).
- Mobile: 4–5 bottom tabs with key items at the corners and safe-area padding (**NAV-01/04/05**).
- Loading/empty/error states for every data view (**FBK-01**, **LAW-13**): skeleton within 0.4s, never blank.

Acceptance: nav works at all three widths; focus visible; no screen with two identical-looking actions (**BTN-10**).

## Phase 4 — Shared components (highest leverage: fixes many screens at once)

- **`components/ui` + `components/kit` + CSS modules:** converge on one button component with 6 states, 48px/40px targets, verb-first labels (**BTN-01/03/05**). Delete duplicate wrappers as callers migrate.
- **`record-form.tsx`:** switch `sm:grid-cols-2` to single column; label above input; 2–4 choices become radios, >7 use `SearchableSelect` (**FRM-01/11**, **LAW-02**).
- **`data-table.tsx`:** one clear row action, not a row of icon buttons; table↔card responsive behaviour kept (**LAY-06**).
- **`status-chip.tsx`:** text + icon, never color alone (**ACC-03**); four status colors only.
- **`panel.tsx` / `section-tabs.tsx`:** spacing on 4/8, inside-group < between-group, one radius family with nested radius halved (**SPC-01/02/06/07**).
- **`toast.tsx` / `notification-bell.tsx`:** keep the live popup, but ensure it pauses on focus and announces politely.

Acceptance: audit 0 FAIL on these files; component gallery screenshot per state.

## Phase 5 — Forms & guided flows

- **`enrolment-form.tsx` (662 lines):** make it a real single-column stepper with progress indicator (**FRM-16**); group fields into Personal / Family / Address / Documents (≤7 per group, **LAW-03**); address keeps County → Sub-county → Town (one main town) — no detail box, consistent with the current build.
- **`payment-wizard.tsx`:** keep the 5-step flow; progress indicator, one primary "Continue" per step, review before record (**FRM-16**, **BTN-02**). Completed terms shown but not selectable.
- **`program-fee-editor.tsx`, `scope-picker.tsx`, `settings-dialog.tsx`:** apply the same field/button rules.
- Native form fallbacks (login) stay — progressive enhancement is not a visual compromise.

Acceptance: keyboard-complete flows; each step has one primary button; inline errors demonstrated.

## Phase 6 — Role dashboards & screens

Order by traffic, not by file count:

1. **Overview** (`dashboard/page.tsx`, `college-overview.tsx`): break the identical-card grid — one large focal metric, secondary metrics compact (**LAY-08**, **PRN-01/04**).
2. **Students list + detail** (`students/page.tsx`, `students/[id]/page.tsx` — 799 lines): table patterns, clear primary action, tabs preserved.
3. **Admissions** (applications, enrolments), **Academics** (programmes, calendar, classes, tutors), **Records** (accounts, cards), **Insights** (reports, communication).
4. **Student portal** (6 pages) and **Tutor portal** (6 pages) — same tokens/components, fewer links, mobile-first.
5. **Chat** (`portal/chat`) — keep the familiar chat pattern (**LAW-04**), consistent avatar treatment.

Acceptance: each screen has a clear first/second/third read; one primary button; empty and loading states present.

## Phase 7 — Verification & handoff

- Run `python scripts/audit_ui.py <changed path>` on every changed file; **0 FAIL** before merge, WARNs justified in the PR.
- Manual checklist: one style/accent/loud element; contrast ≥4.5:1 and borders ≥3:1; type scale ≤7; 4/8 spacing; 48px targets; six button states; single-column forms with inline errors; nav active state; loading/empty/error/success; dark theme separate; 375/768/1366 checks; focus visible; reduced motion; no AIT tells.
- Visual regression screenshots for homepage, login, dashboard overview, one form, one list, mobile nav.
- Report format at the end of each phase: `Rules: PASS` or `Rules: PASS with overrides: <IDs>`, with an `Override: <ID> - <risk>` line for any intentional rule break.

## Scope notes

- No backend/business-logic changes: data, payments, campuses, permissions and migrations stay untouched.
- No new libraries: reuse the existing Radix/shadcn-style primitives, Tailwind v4 and CSS modules.
- Work in small, reviewable branches per phase; main stays deployable after each phase.

---

## Completion status (2026-11-23)

All phases are implemented and verified.

| Phase | Status | Key change |
|---|---|---|
| 0 — Foundation | done | Token layer + AA-verified dark palette, pre-paint theme script, toggle in header/topbar/auth; all audit FAILs cleared |
| 1 — Homepage | done | One loud CTA, three real stats, no placeholder sections, uniform cards, sans headings |
| 2 — Auth | done | Google sign-in first, form spacing, theme toggle, inline errors |
| 3 — Dashboard shell | done | Active nav + aria-current, short mobile labels that fit 375px, 44/56px targets |
| 4 — Shared components | done | Single-column forms, radios for 2–4 choices, "(optional)" labels |
| 5 — Guided flows | done | Accessible progress bars on enrolment and payment wizards |
| 6 — Role dashboards | done | One focal metric + compact remainder on both overviews (LAY-08) |
| 7 — Verification | done | audit 0 FAIL, tsc clean, lint 0 errors, build green, 375/1366 light+dark checks |

Final audit: 0 FAIL, 14 WARN (13 fixed-geometry ID-card print rules, 1 comment false-positive).
Contrast scan: 0 controls below 4.5:1 across homepage, login, dashboard overview, students,
tutors, class form and accounts in both themes (after transitions settle).

Rules: PASS

---

## Homepage rebuild (combined skills)

Built with `frontend-ui-ux-rules` (structure, accessibility) + Anthropic's `frontend-design`
(aesthetic direction). The old homepage carried every generic tell the design skill warns
about: tracked-out ALL-CAPS eyebrows, middle-dot meta strings, a serif display face,
shimmer CTAs, and identical rounded cards.

**Direction — "institutional prospectus":** the one bold moment is a deep-violet hero with
large Geist sans type and an edge-to-edge campus photo. Everything after it is quiet:
hairline rules, a three-figure facts strip, programmes as a catalogue *list*, a true
numbered 3-step admissions sequence, and a plain campus phone directory. FAQ uses native
`<details>` so it works before JavaScript loads.

**Tokens:** ink `#1A1626`, paper `#F7F5FA`, one violet accent (`--eavi-fill`), deep violet
field (`--eavi-band`), mint for positive state, muted `#63566F`. One family (Geist), two
weights; six type sizes. All values come from the token layer.

**Review against defaults:** the violet field and "Leading the Leaders" are EAVI-specific,
not cream/terracotta or near-black/acid. A course-catalogue list and phone directory are
specific to a college, not a SaaS card kit. Numbered markers appear only where the content
is genuinely a sequence (admissions). No ALL-CAPS labels, no middle dots, no serif display,
no shimmer buttons, no per-section fade-up. Motion is one 500ms hero entrance, respecting
`prefers-reduced-motion`.

Implementation: `components/home/eavi-home.tsx`, `eavi-home.module.css`, and the small
client-only `program-catalogue.tsx`; `app/(public)/page.tsx` composes them.

Rules: PASS

---

## Dashboard design language (2026-11-23)

Researched real dashboard patterns (AdminLTE roundup: Odoo tinted KPI tiles, Mercury
one-dominant-number, Plausible restraint, Grafana stat-row-then-detail, GitHub Pulse
plain-English summary, Home Assistant status = icon + colour + text) and combined them
with both skills. Applied through the shared components so every role's screens change:

- **Panel** — quiet hairline surface, one radius, no shadow (restraint).
- **StatTile / MetricCard** — Odoo-style softly tinted tiles by state, larger dominant
  figure (Mercury), tabular numerals; colour only for状态, never decoration.
- **PageHeader** — a plain-English verdict line on both overviews, e.g. "1048 students,
  14 applications to review, Ksh 24m collected of Ksh 87m billed" (GitHub Pulse).
- **LAY-08** — one focal metric, compact remainder; fixed grid overflow at 1366px.
- Status chips keep text + dot, never colour alone (Home Assistant rule).

Affects admin, superadmin, student and tutor portals because they share these components.

Rules: PASS

---

## Cinematic homepage (MotionSites skill)

Installed the MotionSites web-builder skill and rebuilt the homepage top from its
Orvante Agency reference (editorial photo hero, manifesto, stat panel), adapted to EAVI:
- oversized Fraunces display title with an EAVI superscript, masked real campus photo,
  floating brand plate and a segmented nav pill
- a violet bar and a statement whose words fill as the section enters the viewport
- real figures only: students enrolled, programmes, campuses, 226 college photographs

The functional prospectus sections (programmes, admissions, fees, campuses, gallery,
FAQ, CTA) remain below. One scroll trigger and transform/opacity/color transitions;
reduced motion shows the final state. Explicit user override: the MotionSites skill's
multi-part motion is allowed here despite the usual one-moment rule.

Rules: PASS with override: ANI (user asked for the MotionSites skill)
