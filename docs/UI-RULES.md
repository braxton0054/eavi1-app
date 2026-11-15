# UI rules for this repo

Short, enforceable rules for anyone (human or agent) editing the interface. The full
rationale and the screen-by-screen plan live in `docs/UI-REBUILD-PLAN.md`; the numbered
source rules come from `ui-ux/ui-ux-designer.skill`.

## Styling

1. **No utility classes.** No `className="flex gap-4 p-6"`. Every element gets a class from its own CSS Module.
2. **One module per component**, colocated: `Button.tsx` + `Button.module.css`, wrapped in `@layer components`.
3. **Global CSS only in `app/styles/`**, imported once from `app/layout.tsx`. Never `import "./x.css"` from a component.
4. **Tokens only.** No hex, `px` colour, or magic radius outside `tokens.css`. Spacing comes from `--space-*`, type from `--text-*`, motion from `--dur-*`/`--ease-*`.
5. **Variants are data attributes** — `data-variant="primary" data-size="md" data-loading="true"` — not conditional class strings and not `cva`.
6. **Class names inside a module** are semantic: `.root`, `.label`, `.icon`, `.description`, `.actions`. One `.root` per component.
7. **Mobile-first:** base rules are the 320px layout; enhance with `@media (min-width: 48rem)` and `(min-width: 80rem)`.
8. **No `!important`** outside `app/styles/print.css`. No inline `style` for anything a token can express (progress width, print artwork and computed transforms only).
9. **No new global class names** except shell layout in `layout.css` and `.srOnly` / `.skipLink` in `utilities.css`.
9a. **Never route a CSS Module through the Tailwind loader.** `next.config.ts` applies `@tailwindcss/turbopack` to `**/globals.css` only. When the rule matched `*.css`, every module's class map came back empty and components rendered with no class at all.
9b. **Tailwind's default theme shadows a few token names** (`--shadow-*`, `--leading-*`, `--ease-*`, `--radius-*`, `--primary`, `--border`). Until `globals.css` is deleted in Phase 6 they are restated in the unlayered `:root:root` block at the end of `tokens.css`; a new token that collides must be added there too.

## Component contract

10. Interactive components ship every state: default, hover, `:focus-visible`, active, disabled, loading.
11. Data components ship loading (skeleton mirroring the layout), empty, and error states.
12. Every empty state has a headline, one line of explanation and one action. Distinguish first-use from no-results.
13. Skeletons, not spinners, for content loading. A spinner is allowed only inside a button for <2s work.
14. Every icon-only control has an `aria-label`; every input has a visible label and a hint, never a placeholder used as a label.
15. 2–3 mutually exclusive options are a segmented control or radios, never a dropdown.
16. Long lists are searchable by typing **and** scrolling.
17. Touch targets are at least 44×44 with 8px between them; inputs are 16px or larger.
18. `prefers-reduced-motion` removes entrance animation, hover lifts and shimmer — nothing new needs a media query, the global guard covers it.
19. Text blocks of four lines or more are left-aligned; only short headings and empty-state copy are centred.
20. One primary action per view. Buttons are labelled verb + object, in sentence case.

## Copy

21. All screen strings come from `lib/content/*`. No copy hardcoded in a component.
22. Errors say what happened and how to fix it, without blame. No codes alone, no stack traces.
23. Never invent data, figures, dates, photographs or testimonials. A missing value renders as a reserved empty state, not a guess.
24. Use real typographic punctuation; sentence case; no exclamation marks in fees, exams or security flows.

## Verification

- `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- `node scripts/check-contrast.mjs` after any colour change; update the ratio comments in `tokens.css` in the same commit.
- Greps that must return nothing before Tailwind is uninstalled:
  ```
  grep -rn 'tailwind\|@apply\|@utility\|@theme' app components package.json next.config.ts
  grep -rn 'className="[^"]*\b\(flex\|grid\|bg-\|text-\|p-[0-9]\|m-[0-9]\|gap-\|rounded-\)' app components
  grep -rn 'from "cn"\|class-variance-authority' app components
  ```
- Print: compare a generated PDF per document type (record, letter, ID card) against the previous output; the millimetre block is not to be restyled.
