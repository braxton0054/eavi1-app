# SKILLS.md

Index of reusable skills for the coding agent. Before starting a task, find the matching skill below and read its `SKILL.md` first. All five live in the user-level directory `~/.qoder/skills/` (i.e. `/home/eavi/.qoder/skills/`), so they are available in every project on this machine.

| Skill | Use when | Entry file |
|---|---|---|
| `frontend-ui-kit` | Building or restyling any UI (pages, dashboards, forms, tables, cards, landing pages); choosing or installing React/Vite/Next.js components (shadcn CLI 4, registries, shadcn MCP); removing hardcoded text or colors; layout and design rules | `~/.qoder/skills/frontend-ui-kit/SKILL.md` |
| `dashboard-design-kit` | Designing a dashboard or admin panel: KPI hierarchy, screen order, chart choice, filters, role-based views (superadmin, campus admin, tutor, student, finance); choosing and adopting a dashboard template | `~/.qoder/skills/dashboard-design-kit/SKILL.md` |
| `nextjs-dashboard` | Scaffolding a Next.js App Router admin panel: `create-next-app`, shadcn init, route groups, typed routes, async `params`/`searchParams`, `proxy.ts`, cache directives, Prisma data layer, library picks, mobile-first shells | `~/.qoder/skills/nextjs-dashboard/SKILL.md` |
| `eavi-brand-ui` | Anything EAVI: brand tokens, purple lead / green secondary, logo size, dark and light values, contrast verification, Login-only nav, hardcoded-color sweeps | `~/.qoder/skills/eavi-brand-ui/SKILL.md` |
| `login-page-design` | Login, sign-in, register, password-reset and MFA screens: fields, validation timing, error wording, redirects, accessibility, auth shell and brand treatment | `~/.qoder/skills/login-page-design/SKILL.md` |

## frontend-ui-kit

- `SKILL.md`: hard rules, default stack, 8-step workflow, reference map
- `references/component-sources.md`: shadcn CLI 4 command map, install flags, registries, search and vet, shadcn MCP, picks by need
- `references/content-layer.md`: the three copy tiers (typed config, messages JSON, database) and which one this repo is on
- `references/design-foundations.md`: Tailwind v4 token layer, spacing, typography, color and contrast, radius, depth, interaction, breakpoints
- `references/layouts-and-cards.md`: card anatomy against the real `radix-nova` Card API, app shell, dashboard, tables, forms, landing pages
- `references/checklists.md`: pre-work, self-check greps, honest verification, anti-patterns, definition of done
- `assets/StatCard.tsx`: stat card with every string a prop, four states, `Intl` formatting

## dashboard-design-kit

- `SKILL.md`: 12 hard rules, 8-step workflow, reference map
- `references/design-rules.md`: pre-work questions, KPI hierarchy, chart choice by question, filters, density, mistakes, squint test, checklist
- `references/templates.md`: researched template catalog with star and license evidence plus how to adopt one safely
- `references/role-dashboards.md`: superadmin, campus admin, tutor, student, parent, finance and multi-campus roll-up recipes
- `assets/DASHBOARD_RULES.md`: drop-in rules for a repo's `AGENTS.md`
- `assets/dashboard-page.tsx`: reference page composition, widgets as data, all copy via a `copy` prop

## nextjs-dashboard

- `SKILL.md`: scaffold commands, route architecture, Next 16 breaking specifics, data layer, library table, done-means
- `references/scaffolding.md`: step-by-step from `create-next-app` to a working dashboard, file tree, typed routes, caching, auth scoping, self-check
- `references/library-picks.md`: what is and is not installed in the baseline, and the trade-off per concern
- `references/mobile-layouts.md`: two shell variants, per-screen recipes, touch sizing, states at 375

## eavi-brand-ui

- `SKILL.md`: brand rules table, token layer map, 7-step workflow, verification limits
- `scripts/check_eavi_tokens.mjs`: WCAG AA ratios for all light and dark token pairings, and a `--scan` sweep for hex literals and off-palette classes

## login-page-design

- `SKILL.md`: 12 hard rules, layout decision, workflow, reference map
- `references/form-and-flow.md`: fields, identifier choice, validation timing, error wording, password rules, remember-me, redirects, MFA, lockout
- `references/accessibility.md`: labels, `autocomplete`, announcements, focus, contrast including placeholders, touch targets, test pass
- `references/layout-and-brand.md`: auth shell, card anatomy, split screen, logo and token treatment, responsive behavior, loading states
- `references/eavi-worked-example.md`: the real `/home/eavi/Desktop/eavi1-app` auth screens reviewed — what is right, the six things to fix

## Combining them

For an EAVI dashboard: `dashboard-design-kit` for the plan, `nextjs-dashboard` for the scaffold and data wiring, `frontend-ui-kit` for components and the content layer, `eavi-brand-ui` for tokens and the measured contrast pass. Where they disagree, the brand skill wins on color and the UI kit wins on structure.

The four EAVI role dashboards (Super Admin, Campus Admin for West and Main, Tutor, Student) are recorded as wanted but **not specified and not built** — confirm per-role contents before writing any of them.

## Adding a new skill

1. Create `~/.qoder/skills/<skill-name>/SKILL.md` with `name` and a pushy `description` (what it does and when to trigger).
2. Put long material in `references/`, templates in `assets/`, deterministic checks in `scripts/`.
3. Verify every command against the installed tool (`--help`) and every file path before writing it down.
4. Add a row to the table above and a contents list below it.
