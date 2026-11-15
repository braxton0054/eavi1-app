# EAVI Portal — UI Rebuild Plan (v2)

**Supersedes v1 of this document.** Two things changed:

1. **The EAVI brand skill is no longer binding.** `eavi-brand-ui` rules (purple-lead/green-secondary hierarchy, logo sizing, its token names, its contrast sweep script) do not govern this rebuild. The only thing kept from the old brand layer is the **asset** `public/logo.png`, because it is the institute's own artwork and is not ours to redraw. Colour, type, density, radius, depth and voice are designed fresh.
2. **All styling moves from Tailwind to plain CSS.** No Tailwind, no utility classes, no `cva`, no `cn`, no shadcn theme layer. One hand-written CSS system: cascade layers, custom-property tokens, and one CSS Module per component.

**Project:** `eavi1-app` (Next.js 16 App Router, React 19, Prisma, Radix/base-ui behaviour primitives, lucide icons).
**Not in scope:** the separate school-management worktree described by `ui-ux/promt`. That brief belongs to another product and is ignored here.

This is a rebuild: the presentation layer is replaced file by file from the token sheet upward. Data access, authentication, server actions, validation, API routes and the Prisma layer are untouched — the product must keep behaving exactly as it does today while looking and reading like one deliberate system.

---

## 1. Skills audit: what is actually in the project

There is exactly **one** UI/UX skill folder in the repo: `ui-ux/`. There is no `.claude/skills`, no second skill archive, and no installed copy under `~/.qoder/skills` or `~/.claude/skills` on this machine (the paths `SKILLS.md` and `README.md` reference do not exist).

| Path | What it is | Status in this plan |
| --- | --- | --- |
| `ui-ux/ui-ux-designer.skill` | A 30 KB zip containing `ui-ux-designer/SKILL.md` + 5 references: `rules.md` (≈300 numbered rules with IDs), `components.md` (anatomy/specs/states), `patterns.md` (screen recipes incl. education admin, admissions, fees, results, timetable, teacher home, login), `palettes-and-styling.md` (6 verified palettes, token mapping, dark-mode recipe), `nextjs-implementation.md` (tokens, skeleton, segmented control, native dialog, breadcrumbs, stat card). | **Primary rulebook.** This is the strongest artefact in the folder and is adopted almost whole. |
| `ui-ux/card rules_desgin` | 100-rule design system: 8-pt grid, 60-30-10 colour, card rules 66–75, cognitive load 76–90, depth 91–100. | Adopted for card, spacing and depth decisions. |
| `ui-ux/moble_frendly` | 60 mobile rules: thumb zone, 44px targets, bottom nav, single column, sheets over modals, 16px inputs, mobile card rules. | Adopted as the mobile acceptance standard. |
| `ui-ux/install` | Two `unzip` commands to install the skill into Claude Code. | Informational only. |
| `ui-ux/promt` | A brief for a *different* repo (pnpm monorepo, `apps/web`, navy/gold brand, `ui-redesign` worktree). | **Ignored** — wrong project, wrong brand. |
| `ui-ux/shots/*.png` | 20 baseline screenshots (home, login, register steps, dashboard, students, enrol, profile, mobile). | Kept as the before-set for comparison. |
| `SKILLS.md`, `README.md` | Index + brand notes. | Read for inventory; brand conclusions are dropped. |

**How a conflict is resolved now:** the user's brief and the `ui-ux-designer` hard rules win. Card and mobile guides fill gaps. Nothing about EAVI brand tokens applies.

What still comes straight from the skill and is non-negotiable:
skeletons over spinners for content loading (`STA-01`), a designed empty state per surface with one action (`STA-03`/`STA-04`), radio/segmented control instead of a dropdown for 2–3 options (`FRM-02`), vertical forms with labels above and a placeholder that is not the label (`FRM-01`/`FRM-04`), search-and-scroll for long lists (`FRM-03`), left-aligned text blocks of 4+ lines (`TYP-07`), stat cards with a focal number and a trend (`CMP-27`), visible `:focus-visible` everywhere (`A11-03`), 44px targets (`A11-10`), `prefers-reduced-motion` (`A11-14`), one primary action per view (`LAY-09`), and no decorative UI typefaces (`TYP-02`).

---

## 2. Research: what the rebuild leans on

| Source | What it contributes |
| --- | --- |
| [Design Token-Based UI Architecture — Martin Fowler](https://martinfowler.com/articles/design-token-based-ui-architecture.html) | The three-layer token model (option → decision → component) and the warning that a component layer is optional cost. We adopt three layers but keep the component layer small. |
| [Material 3 — Design tokens](https://m3.material.io/foundations/design-tokens) | Token naming discipline; semantic roles rather than colour names. We take the roles, not the visual language. |
| [NYS Design System — CSS variables](https://designsystem.ny.gov/about/updates/css-variables) | Ramps per colour family and one definition reused everywhere — the pattern our `tokens.css` follows. |
| [12 Design System Examples (2026)](https://www.themasterly.com/blog/design-system-examples) | Consistent lesson across Polaris, Carbon, Primer, GOV.UK: **document decisions, don't import a theme.** GOV.UK is cited for research-backed, plain-language patterns; Polaris for admin density; Carbon for tables and forms. |
| [UNICEF Design System — UX/UI guidelines](https://unicef.github.io/design-system/design-guidelines.html) | "Lean design for slow internet connections" and "design for all, no matter your tech savviness" — precisely this audience (Eldoret, 3G, shared devices, mixed confidence). Adopted as a product principle. |
| [NN/g — Design Systems 101](https://www.nngroup.com/articles/design-systems-101/) | Component documentation anatomy: name, description, usage do/don'ts, attributes, states. Drives `docs/UI-RULES.md`. |
| [A practical guide for frontend engineers — UI design systems](https://www.imadattif.com/ui-design-systems-guide) | Encapsulation as the test of a good component API: consumers pass variants and never reach into internals. Drives our `data-*` variant contract. |
| [Apple HIG](https://developer.apple.com/design/human-interface-guidelines) | Touch sizing, sheets, and platform conventions for the mobile shell. |

Decision from the research: **build our own token layer on unstyled primitives; borrow practices, not themes.** We keep Radix `radix-ui` and `@base-ui/react` for behaviour (focus traps, menus, selects) and write every visual rule ourselves in CSS.

---

## 3. New design direction: "Graphite"

No brand brief is inherited, so the direction is chosen and stated once, here.

**Principles**
1. **Operational calm.** An office works in this all day; contrast and rhythm matter more than personality. Dense but readable, per the Polaris admin lesson.
2. **The record is the hero.** Screens lead with the number and the name, not with chrome. No decorative gradients, glass, bevels or shimmer on content.
3. **One action colour.** Violet is used for primary actions, active navigation and focus. Everything else is graphite, with teal/amber/red reserved for state.
4. **Lean by default.** No icon-only navigation, no hover-only affordances, no web fonts beyond two, no image weight on above-the-fold content (UNICEF lesson).
5. **Plain words.** Sentence case, verb + object, blame-free errors, no jargon the office does not use.

**Palette** (starting values; every pair must be measured in Phase 0 and the ratio recorded in a comment above the token — `COL-01`/`COL-16`)

| Role | Value | Notes |
| --- | --- | --- |
| Page | `#F5F6F8` | cool graphite off-white, not pure white (`COL-12`) |
| Surface | `#FFFFFF` | cards, panels, sheets |
| Surface-2 | `#EEF0F4` | table heads, wells, skeletons |
| Surface-3 | `#E4E8EE` | pressed/selected fills |
| Ink | `#161C26` | primary text |
| Ink-muted | `#5A6474` | secondary text, must clear 4.5:1 on page and surface |
| Border | `#DDE2EA` | hairline |
| Primary | `#4B3FA8` | deep violet-indigo; harmonises with the locked logo artwork without copying it |
| Primary-hover | `#3D338C` | token-derived, not ad hoc |
| On-primary | `#FFFFFF` | |
| Positive | `#0F7B5F` | teal-green for paid, verified, active |
| Attention | `#9A5B00` | amber-brown ink on light surfaces, never amber text on white at small size |
| Danger | `#B42318` | |
| Info | `#1A5C88` | |
| Focus ring | `#4B3FA8` | 2px, 3px offset, ≥3:1 against adjacent fills |

Status colours are always paired with an icon and a word (`COL-05`, `COL-09`). Charts use max 4 series drawn from primary/positive/info/attention.

**Type**
- UI: **Geist Sans** (already loaded by `next/font`, proper fallback, `display: swap`). Body 16px, dense UI 14px, never below 14 for data.
- Display: **Fraunces**, restricted to marketing headlines and section titles at ≥32px. Never in the portal, never a label, button, field or table cell (`TYP-02`).
- Mono: **Geist Mono** for references, student numbers, receipts (`TYP-26`).
- Weights 400/500/600 only; tabular numerals on money, marks, dates, counts.

**Shape and depth**
- Radius: 8 (inputs, chips), 12 (buttons, cards), 20 (sheets, dialogs), 999 (pills, avatars). One per tier, no one-offs (`LAY-13`).
- Elevation: three levels — `1px` border + `0 1px 2px` (cards), `0 4px 12px` (popovers), `0 12px 32px` (dialogs). Shadows tinted toward ink, never pure black (`COL-19`, card rules 91–92).
- Motion: 120ms feedback, 200ms state, 300ms layout; ease-out in, ease-in-out moves; nothing animates on page load except one permitted hero entrance on the marketing home (`MOT-01`, `MOT-06`, `MOT-07`).

**Theme:** light only, shipped now. `tokens.css` names roles (`--bg`, `--surface`, `--text`), so a `[data-theme="dark"]` block can be added later without editing one component (`DRK-13`). `color-scheme: light` and a matching `theme-color` meta.

---

## 4. Styling architecture: plain CSS

### 4.1 What comes out

| Item | Action |
| --- | --- |
| `app/globals.css` (847 lines of `@theme`, `@utility`, tailwind imports, print block) | Split and replaced; print block moves to `app/styles/print.css` **unchanged**. |
| `tailwindcss`, `@tailwindcss/turbopack`, `tw-animate-css` | Uninstalled. |
| `next.config.ts` → `turbopack.rules["*.css"]` loader | Deleted (this is the switch that makes Tailwind compile every CSS file). |
| `shadcn` CLI package, `components.json`, `@import "shadcn/tailwind.css"` | Deleted. The registry's visual layer is not used; we keep only unstyled behaviour primitives. |
| `class-variance-authority`, `cn` (`lib/utils.ts`) | Deleted; replaced by a 12-line `cx()` that joins truthy strings (no merging needed once there are no conflicting utilities). |
| `components/ui/sidebar.tsx` (700 lines of registry markup) | Deleted; the sidebar becomes `components/shell/Sidebar.tsx` + `.module.css`. |
| `components/magicui/*` | Deleted; `motion` dependency dropped once the three `motion/react` usages are gone. |
| `next/font`, Radix/base-ui primitives, `lucide-react`, `sonner` | Kept. Fonts are framework-level; primitives are unstyled; `sonner` is themed through its `classNames` hook. |

### 4.2 File tree

```
app/layout.tsx                     imports exactly one stylesheet: app/styles/index.css
app/styles/
  index.css        @layer reset, tokens, base, layout, components, utilities;   (imports only)
  tokens.css       layer tokens  — primitives → semantic → component tokens
  reset.css        layer reset   — modern box-sizing/typography reset
  base.css         layer base    — element defaults, focus-visible, type scale, links, selection
  layout.css       layer layout  — the shells' page-level grids (.appShell, .appMain, .publicShell…)
  motion.css       layer base    — durations, keyframes, prefers-reduced-motion guard
  utilities.css    layer utilities — only sr-only, no-print, print hooks
  print.css        imported last, outside layers (winning, as today)

components/**/<Name>.module.css    one module per component, colocated, same basename
```

### 4.3 Rules of the road

1. **No utility classes in TSX.** No `className="flex gap-4 p-6"`; not one. Every element carries a module class. This is the single reviewable rule that proves the migration.
2. **Global CSS lives only in `app/styles/`**, imported once from the root layout. Nothing else may use a bare `import "./x.css"`.
3. **A CSS Module per component**, wrapped in `@layer components`. Modules may not reach into another module's classes.
4. **Variants are data attributes, not conditional class strings.** `<button data-variant="primary" data-size="md" data-loading="true">` styled with `[data-variant="primary"]`. Consumers pass props; CSS owns appearance (encapsulation, per the design-systems research).
5. **Class naming inside a module:** one `.root` element per component, then `.label`, `.icon`, `.description`, `.actions`, and state classes only where an attribute cannot express it (`.isActive`).
6. **Tokens only.** A raw hex, `px` shadow colour, or magic radius outside `tokens.css` is a defect. Spacing comes from the 8-pt scale (`--space-1…--space-12`), type from `--text-*`, motion from `--dur-*`/`--ease-*`.
7. **Modern CSS, no preprocessor:** native nesting, `:where()` to keep specificity flat, `clamp()` for fluid type and gutters, container queries for cards/tables that appear in several widths, logical properties (`padding-inline`, `margin-block`) so RTL stays possible, `color-mix()` for hover/active derivation from a base token.
8. **Layers beat specificity games.** No `!important` outside `print.css`; no inline `style` for anything a token or class can express (inline styles are reserved for computed values like progress width and print artwork).
9. **Responsive is mobile-first:** base rules are the 320px layout; `@media (min-width: 48rem)` and `(min-width: 80rem)` enhance. Container queries where the component, not the page, decides.
10. **Accessibility is in the CSS, not an afterthought:** every interactive class has a `:focus-visible` rule; reduced-motion is a global guard in `motion.css`; `sr-only` is the only global utility besides print hooks.

### 4.4 Migration mechanics (no screen ever ships half-styled)

Tailwind stays installed and functional **during** the migration — unconverted files keep their existing classes, so every route stays correct on every commit. The loader and packages are removed **last**, when the greps prove nothing uses them.

Per component:
1. Create `<Name>.module.css`, translate utility strings into declarations grouped by block.
2. Replace variant class maps (`cva`, ternaries) with `data-*` attributes.
3. Delete the `cn()` / `cva()` imports from the TSX.
4. Verify locally, then move to the next component.

Proof gates before the final removal:
```
grep -rn 'tailwind\|@apply\|@utility\|@theme' app components package.json next.config.ts   # no hits
grep -rn 'className="[^"]*\b\(flex\|grid\|bg-\|text-\|p-[0-9]\|m-[0-9]\|gap-\|rounded-\)' app components   # no hits
grep -rn 'from "cn"\|class-variance-authority' app components   # no hits
npm run build                                                    # CSS Modules + plain CSS compile
```

### 4.5 Tailwind → CSS translation table (used during conversion)

| Tailwind pattern | Plain-CSS replacement |
| --- | --- |
| `flex items-center gap-3` | `.row { display:flex; align-items:center; gap: var(--space-3); }` |
| `grid grid-cols-2 md:grid-cols-4 gap-4` | `display:grid; grid-template-columns: repeat(2,1fr); gap:var(--space-4);` + `@media (min-width:48rem){ grid-template-columns:repeat(4,1fr); }` |
| `p-4 px-5 py-3` | `padding: var(--space-3) var(--space-5);` |
| `bg-card text-foreground border` | `background: var(--surface); color: var(--text); border:1px solid var(--border);` |
| `hover:bg-primary/80` | `.root:hover { background: var(--primary-hover); }` (token-derived, not opacity) |
| `rounded-xl shadow-md` | `border-radius: var(--radius-lg); box-shadow: var(--shadow-md);` |
| `text-sm text-muted-foreground` | `font-size: var(--text-sm); color: var(--text-muted);` |
| `truncate` | `overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;` |
| `sr-only` | global `.sr-only` in `utilities.css` |
| `motion-reduce:*` | one global guard: `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:.01ms !important; transition-duration:.01ms !important; } }` |
| `space-y-4` | `display:grid; gap:var(--space-4);` on the parent (better) |
| `*:data-[slot=x]:…` registry selectors | delete with the registry; each component owns its own children |

---

## 5. Tokens

**Layer 1 — primitives** (never referenced by a component): `--violet-{50…950}`, `--teal-{50…950}`, `--amber-{50…950}`, `--red-{50…950}`, `--info-{50…950}`, `--gray-{0…950}`.

**Layer 2 — semantic** (what components use):

```
--bg --surface --surface-2 --surface-3 --surface-inverse
--text --text-muted --text-inverse --link
--border --border-strong --divider
--primary --primary-hover --primary-active --on-primary --primary-soft
--positive --on-positive --positive-soft
--attention --attention-soft --danger --on-danger --danger-soft
--info --info-soft
--focus --overlay --scrim
```

**Layer 3 — component** (small, only where a real decision exists): `--control-height-sm|md|lg` (32/40/48), `--input-height` (48), `--sidebar-width` (264), `--sidebar-width-rail` (72), `--topbar-height` (64/56), `--card-pad`, `--field-gap`, `--radius-{xs,md,lg,pill}`, `--shadow-{sm,md,lg}`, `--text-{xs…display}`, `--space-{1…12}`, `--dur-{fast,base,slow}`, `--ease-{out,in-out}`, `--z-{nav,overlay,toast}`.

Every semantic token carries a comment with its measured ratio on `--bg` and `--surface`, and the Phase 0 task is to measure them and correct the starting values before any component is written.

---

## 6. Shells

### 6.1 Public — `components/shell/PublicShell.tsx`

```
┌──────────────────────────────────────────────────────────┐
│ [logo] East Africa Vision Institute    Programmes …  [Sign in] │ 64px, solid, hairline
├──────────────────────────────────────────────────────────┤
│                content, max-width 1200px                  │
├──────────────────────────────────────────────────────────┤
│ footer: brand · campus addresses · links · policies       │
└──────────────────────────────────────────────────────────┘
```
Sticky header ≤64px, solid surface (no glass), active section underlined, Sign in the only filled button. Mobile: logo + menu button → full-height sheet with the five links, campuses and Sign in in the thumb zone. Skip-to-content is the first tab stop, one `<h1>` per page, labelled landmarks.

### 6.2 Auth — `components/shell/AuthShell.tsx`

Single column, max 420px, logo plate, `min-height:100dvh`, "Back to home" quiet link. Vertical form only, 48px inputs, 16px text, password reveal, inline errors tied to fields, one primary action full-width on mobile. No marketing split panel: there is no verified campus photography, and a stock image would be invented content (`CPY-09`).

### 6.3 App — `components/shell/AppShell.tsx` (replaces `DashboardFrame`)

```
┌───────────────┬────────────────────────────────────────────┐
│ brand + campus │ ☰  Campus ▾              note   [avatar ▾] │ 64 / 56px
│                ├────────────────────────────────────────────┤
│ ADMINISTRATION │ PageHeader: title · description · actions   │
│  Overview      │                                            │
│ ADMISSIONS     │ content: max-width 1440, 24/32px gutters   │
│  Applications  │                                            │
│ …              │                                            │
│ account card   │                                            │
└───────────────┴────────────────────────────────────────────┘
   264px, collapses to a 72px rail ≥1280, drawer <768
```
- Sidebar: grouped items with section labels, active row = tinted fill + 3px violet edge + `aria-current="page"`; collapse to icon rail with tooltips; **no entrance animation on items** (removes the staggered `x:-14` motion).
- Topbar: solid, hairline border, campus switcher (super admin), avatar menu (Profile, Sign out) replacing the always-visible shimmer sign-out.
- Mobile bottom bar: 4–5 destinations with icon **and** label, 56px + `env(safe-area-inset-bottom)`, active via tint and weight. Admin: Overview, Applications, Students, Enrolments, More. Student: Overview, Units, Fees, Chat, Details. Tutor: Today, Timetable, Exams, Marks. Chat shell uses the caller's role nav, never a single-item bar.
- `PageHeader` is the one header every screen uses (title, description, optional breadcrumbs, actions) — retires the ad-hoc heading rows across 30 admin pages.
- `fill` mode for chat: shell locked to `100dvh`, thread scrolls internally, composer pinned above the safe area.

### 6.4 Chat — same shell, `fill`, three panes ≥1280 / two ≥768 / one below

List (search, unread badge, preview, time) → thread (date separators, alignment + surface distinction, avatar, delivery state) → contact panel. Mobile: list → thread push → contact sheet.

---

## 7. Components

Every component = `Name.tsx` + `Name.module.css`. Required states for every interactive component: default, hover, focus-visible, active, disabled, loading. For every data component: loading (skeleton), empty, error.

**Primitives (`components/ui/`)** — Button (primary/secondary/ghost/danger; 32/40/48; loading), IconButton (44px hit area, `aria-label` required), Input/Textarea (48px, 16px, error + hint + read-only vs disabled), Field (label above, `id`/`aria-describedby`/`aria-invalid`, Fieldset/legend), Select (native under 7 options, Radix above, 44px rows), SearchSelect (type-to-filter **and** scroll, clear button), Segmented (radio-group, 2–4 options), Checkbox/Radio/Switch (whole label clickable, 24px control in 44px row), Dialog (native `<dialog>`, focus trap, Esc, restore focus), Sheet (bottom on mobile, side ≥768), Card (one tier: surface, 12px, 24px pad, hairline, `md` shadow), Table + DataTable (sticky head, right-aligned numerics, sort/filter, bulk select, row menu, card-list transform <768, empty/loading/error rows), Badge/StatusBadge (≤6 variants, icon + label), Tabs (peer views, arrow keys), Breadcrumbs (last item plain, `aria-current`), Skeleton (1.4s shimmer, reduced-motion off), EmptyState (first-use / no-results / cleared / error variants), Progress (role + `aria-valuenow` + visible text), Avatar (initials fallback, `+N` stack), Alert (persistent, retry), Tooltip/Popover/DropdownMenu (keyboard, 44px rows), Pagination (current, prev/next, page size), Toast (via `sonner`, 4–6s, pausable, `role="status"`).

**Patterns (`components/kit/`)** — PageHeader, SectionCard, StatCard (label, tabular value, delta with arrow + period, optional sparkline), MetricRow, Toolbar (search + filters + one primary action), FilterBar, FormShell (fieldsets, sticky mobile action bar, save/cancel order), SubmitButton (pending, double-submit guard), ConfirmDialog (names the record and the consequence, safe action focused), Money (KES, tabular), CopyButton, ActivityFeed, ResultTable, IdCard, PrintFrame.

**Screens (`components/screens/<area>/`)** — `home`, `auth`, `admin`, `student`, `tutor`, `chat`, `documents`.

**Deleted:** `components/home`, `components/dashboard`, `components/chat`, `components/admissions`, `components/magicui`, the five root form files (`login-form`, `register-form`, `application-form`, `enrolment-form`), `components/ui/spinner.tsx`, `components/ui/sidebar.tsx`.

---

## 8. Screen specification

Each line: **job → layout → must-have states → mobile.**

### Marketing
- `/` — sell and route to apply. Hero (≤2-line headline, one sentence, Apply online + Explore programmes, verified proof strip) → portal explainer (student/tutor/admin) → why EAVI (4 reasons) → programmes (level segmented + cards) → admissions (3-step stepper + requirements) → fees (per-term figures, finance data only) → campuses → gallery (**omitted** unless photos exist) → testimonials (consent only) → FAQ (accordion) → CTA → footer. Copy only from `lib/content/home.ts`; no invented numbers. Fraunces allowed here at display sizes only. Mobile: single column, 16px gutters, horizontal segmented row for level filters, gallery a horizontal scroller.
- `/apply` — 6-step application with "Step 2 of 6" labels, back preserves data, draft autosave, upload with name/size/progress/cancel, review step with per-group Edit, confirmation naming the reference and next step.
- `/letter/[reference]` — read-only offer letter in a print-proportioned frame with a sticky Print action; unknown reference → not-found with a way forward.
- `/privacy`, `/terms` — 65–75ch column, sticky contents on desktop, last-updated line.
- `/verify/[token]` — genuine / not found / expired, each explained with who to contact. No login.

### Auth
`/login` — email + password, reveal, errors on blur and submit, focus to first invalid field, pending state. `/register` — 3 steps (campus → identity → password), rules before typing, strength indicator, searchable campus list, sign-in prompt on success. `/unavailable` — explanation plus a route forward.

### Admin (all under `/dashboard`)
Shared anatomy: PageHeader → Toolbar → content → Pagination. Lists are DataTable on desktop, card lists on mobile. Records are header + tabs + SectionCards; destructive actions live at the bottom, always behind ConfirmDialog.

| Route | Job | Key elements |
| --- | --- | --- |
| `/dashboard` | What needs attention today | 4 stat cards with delta + period; fee-collection progress; applications by status; recent activity; quick actions; per-widget empty/error; campus in the subtitle |
| `/dashboard/campuses` | College-wide roll-up | Campus comparison table + per-campus stat row |
| `/dashboard/staff` | Approve staff | Queue with role/campus/date, approve/reject with confirm |
| `/dashboard/applications`, `[id]` | Triage applications | Status segmented with counts, search, table, detail facts + documents + decision panel (sheet ≥1024) |
| `/dashboard/students`, `[id]` | Find/manage a student | Search + programme/campus/status filters; table with photo, admission no., programme, year, status; tabs Overview/Enrolments/Fees/Results/Documents; Print ID, Print record |
| `/dashboard/students/enrol` | Enrol | Sectioned long form, programme→units cascade, fee preview, sticky save bar |
| `/dashboard/enrollments` | Track | Table with balance and status; status change via confirm; bulk actions |
| `/dashboard/classes`, `new`, `[id]`, `merge` | Class management | List (tutor, unit, room, day/time, count); create/edit; merge with an explicit consequence summary |
| `/dashboard/programs`, `[id]`, `units`, `fees`, `attachment` | Programme catalogue | Card grid → tabs; fee editor with live total; units grouped by level; PDF upload validation |
| `/dashboard/tutors` | Tutor directory | Table + assignment counts, detail sheet |
| `/dashboard/timetable` | Week schedule | Week grid with sticky day header, subject tint **and** text label, current lesson marked; mobile day list + segmented day switcher |
| `/dashboard/calendar` | Academic calendar | Month grid + windows list; create/edit semester in a dialog; overlap and active-semester errors inline |
| `/dashboard/exams`, `[id]` | Exams | Table by date/unit/room/invigilator; detail with assignments; conflict warnings |
| `/dashboard/accounts` | Accounts and roles | Table, create dialog, reset dialog, suspend with named confirm |
| `/dashboard/cards`, `[id]`, `batches/[id]` | ID card production | Batch list with counts/status; card preview on the existing templates; print batch with progress + cancel |
| `/dashboard/reports` | Figures | Report picker (segmented), date range, preview, export with progress, last-updated stamp |
| `/dashboard/communication` | Bulk messages | Audience → channel → message, preview, send with recipient count confirm, sent history |
| `/dashboard/profile` | Own account | Grouped settings with sub-nav, photo upload, password rules, switches only for instant settings, danger zone last |
| `/dashboard/scope` | Scope selection | Campus chooser with the current selection marked |

List rules: search whenever ≥20 rows; filters in the URL and preserved on back; 20-row pagination; row actions in a menu with accessible names.

### Student
`/student` greeting + 3 stat cards (balance, units, next class) + today's timetable + notices + quick actions. `/student/units` unit cards with tutor, schedule, progress. `/student/fees` compact balance card, progress meter, transaction table with Paid/Partial/Overdue badges, receipt download, how-to-pay helper. `/student/classes` term-segmented class record with attendance summary. `/student/id` true-aspect ID preview, print/download, lost-card instructions. `/student/profile` read-only facts first, edit only what is allowed, photo rules.

### Tutor
`/tutor` today's classes, pending marks, quick actions. `/tutor/timetable` shared timetable filtered to the tutor. `/tutor/exams` date-grouped invigilations. `/tutor/marks`, `[id]` class picker → marks table with keyboard tab flow, blur validation, autosave draft, submit confirm + summary. `/tutor/profile` reduced profile pattern.

### Chat — `/portal/chat`
Conversation search and list, thread, composer, attachments with progress, own/other bubbles distinguished by alignment and surface (not colour alone), Enter-to-send on desktop only, block/mute/report in a thread menu with confirm for block, failure keeps the draft and offers retry, empty states for no conversations / no messages / no results.

### Print
`app/styles/print.css` ported unchanged (millimetres, repeated table headers, no row split, outlined badges). `PrintFrame` and the record/letter markup rebuilt on the new tokens but printing black on white with the same structure.

---

## 9. State matrix (every screen)

| State | Requirement |
| --- | --- |
| <300ms wait | nothing — avoid a flash |
| >300ms | skeleton mirroring the final layout, `aria-busy`, reserved height |
| First-use empty | icon, headline, one line of value, one action |
| No-results empty | echo the query, suggest removing a filter, one clear action |
| Error | inline or banner, specific cause, retry, work preserved; never a stack trace |
| Permission / missing | explanation + route forward |
| Success | inline confirmation or 4–6s pausable toast with a next step |
| Offline / slow | banner, stale content marked, retry |
| Destructive | confirm naming record + consequence, safe action focused |
| Upload | name, size, percentage, cancel |

---

## 10. Accessibility and mobile acceptance

1. Keyboard-only pass per flow; visible `:focus-visible` at ≥3:1; no `outline:none` without replacement.
2. Accessible names on every icon-only control; `aria-current` on nav; one `h1`; ordered headings; labels tied to fields; errors announced (`aria-live`, `aria-invalid`, `aria-describedby`).
3. Contrast ≥4.5:1 text, ≥3:1 large text and UI, measured in the final rendered colours and recorded in `tokens.css`.
4. Targets ≥44×44 with ≥8px separation; inputs 16px+; no horizontal scroll at 320/375/768/1024/1280/1536.
5. `prefers-reduced-motion` kills entrance animation, hover lifts and shimmer.
6. Reflow at 200% zoom without loss.
7. Sticky chrome ≤25% of a mobile viewport; safe-area insets on bars and sheets.
8. `color-scheme: light` + matching `theme-color`.

---

## 11. Phases

One branch per phase. No phase changes request handling, Prisma models, server actions, validation or API contracts. **Tailwind remains installed until Phase 6**, so every route keeps working throughout.

**Phase 0 — CSS foundations (no visual change yet)**
- Create `app/styles/{index,tokens,reset,base,layout,motion,utilities}.css`; port `print.css` verbatim.
- Add `lib/cx.ts`; measure and record every semantic contrast pair; correct the starting palette.
- Exit: `npx tsc --noEmit`, `npm run lint`, `npm run build` pass; tokens documented.

**Phase 1 — Primitives + app shell + auth**
- Convert all 26 `components/ui/*` to `Name.tsx` + `Name.module.css` with `data-*` variants; add `kit/*` patterns.
- Build `components/shell/{AppShell,Sidebar,Topbar,MobileNav,PageHeader,AuthShell,PublicShell}`.
- Switch the four portal layouts to `AppShell`; rebuild `/login`, `/register`, `/unavailable`.
- Exit: every portal route renders on the new shell; auth flows verified (signed out, bad credentials, success routing per role, foreign-origin 403 unchanged).
- Note: this is the only phase where converted and unconverted components coexist; unconverted ones keep their Tailwind classes and are converted in their own phase.

**Phase 2 — Marketing + documents**
- Rebuild `components/screens/home/*`; migrate legal pages, offer letter, verify.
- Replace dashed placeholder tiles with reserved-aspect empty frames; keep `lib/content/home.ts` the only copy source.
- Exit: `/`, `/apply`, `/letter/[reference]`, `/privacy`, `/terms`, `/verify/[token]` fully on CSS Modules; print PDFs compared to current output.

**Phase 3 — Admin read paths**
- Overview, applications, students, enrolments, classes, programmes, tutors, accounts, cards, reports, communication on DataTable/PageHeader/SectionCard/StatCard; shared timetable and calendar.
- Exit: search/filter/pagination/empty/loading/error on every list; table → card list verified at 375px.

**Phase 4 — Admin forms and records**
- Enrol, class create/merge, programme fee/unit/attachment editors, exam detail, account create/reset, profile, calendar dialogs.
- One `FormShell` for all forms; shared validation display; sticky mobile action bars.
- Exit: data preserved on error, focus to first invalid field, no double submit, explicit success; `npm run verify:*` unaffected.

**Phase 5 — Student, tutor, chat**
- Six student routes, six tutor routes, chat rebuild with `fill` and mobile push navigation; role-aware mobile nav in the chat shell.
- Exit: chat exercised with two accounts (send, receive, attachment, failure retry, mobile sheet).

**Phase 6 — Remove Tailwind and finish**
- Delete `components/{dashboard,home,chat,admissions,magicui}`, the five root form files, `ui/spinner.tsx`, `ui/sidebar.tsx`.
- Remove `tailwindcss`, `@tailwindcss/turbopack`, `tw-animate-css`, `shadcn`, `class-variance-authority`, `cn`, `motion`; delete `components.json`; delete `turbopack.rules` from `next.config.ts`.
- Run the four greps in §4.4, then sweep for raw hex outside `tokens.css`, `!important` outside `print.css`, and `style={{` used for layout.
- Final pass: contrast, keyboard, 320px, reduced motion, print. Refresh `ui-ux/shots/` with a new set beside the old.

**Verification throughout**
```
npx tsc --noEmit
npm run lint
npm run build          # proves every .module.css compiles and no Tailwind loader is needed
```
Plus a manual pass of §10 on changed screens at 320/375/768/1280. Dev server: `npm run dev` (builds `server.mjs`). Screenshots only when a visual change needs confirming.

---

## 12. Decisions and risks

| Item | Decision |
| --- | --- |
| EAVI brand rules | Not followed. New palette/type/density as §3. Only `public/logo.png` is retained, unmodified and never clipped or restyled. |
| New palette vs the purple logo | Primary is a deep violet-indigo chosen to sit beside the existing artwork, not derived from the old token names. Swappable in one file because components read semantic tokens only. |
| Tailwind | Removed at the end of the migration, not the start, so no route is ever half-styled. |
| shadcn registry | Visual layer dropped; only unstyled Radix/base-ui behaviour primitives remain. Registry files are not edited and re-added. |
| Dark mode | Not shipped. Roles are theme-neutral so it is a `tokens.css` addition later. |
| Third-party DOM (`sonner`) | Retained, themed via `classNames`; if it cannot meet the token rules it is replaced by a 60-line toast in Phase 1. |
| Print | The millimetre block is correct and fragile — ported unchanged, then compared document by document. |
| Scope | 50+ routes; phases ship independently. Stopping after Phase 2 still leaves a consistent product. |
| Data fidelity | No query or action changes, so every figure must match today's screens; any difference is a regression to fix, not a design choice. |
