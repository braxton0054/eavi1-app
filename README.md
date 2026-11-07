This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The home page lives in `app/(public)/page.tsx` and is assembled from `components/home/*`. Every string it renders comes from `lib/content/home.ts`; the page auto-updates as you edit either file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Seed data: local testing only

`npm run db:seed` fills a **developer's** database with the campuses and logins needed to
click through the portal. It is not a provisioning step and must not run in production.

A production database is loaded with the college's own records — its campuses, programmes,
staff, intakes and students — entered through the portal or imported by the office. Nothing
is generated for it.

The seed enforces that:

- It refuses to run when `DATABASE_URL` points at a hosted database (Neon, Supabase, RDS,
  Azure, Render, Railway, Vercel) or when `NODE_ENV=production`.
- It never invents a password: an unset or short `SEED_CAMPUS_ADMIN_PASSWORD` stops it
  rather than creating a guessable account.
- It creates no intakes, programmes or students. Those are the school's own data, and
  creating them silently would put rows in the system nobody asked for.

On production, apply migrations and stop:

```bash
npx prisma migrate deploy
```

## Placeholders to fill before launch

Nothing here is invented. Each item renders on the live page as a dashed
"Placeholder — needs EAVI data" tile until the real value is added to
`lib/content/home.ts`.

| Where | Content key | What is needed |
| --- | --- | --- |
| Hero photo panel | `hero.photoPending` | A real campus photo in `public/campus-life/` (no stock shots, no redrawn artwork) |
| Hero trust strip | `hero.trust` | Programme count, enrolled-student count, founding year (Campuses already reads from `lib/campuses.ts`) |
| Programmes | `programsSection.items` | Course name, level, duration, short description per programme. The level filter bar appears as soon as items exist |
| Admissions | `admissionsSection.requirements.href` | `public/admissions-requirements.pdf` |
| Fees | `feesSection.items` | Tuition per term, other charges and payment plan per programme. Figures only from the finance office |
| Why EAVI | `whySection.reasons[].detail` | A supporting line for affordable fees, qualified tutors, practical training, flexible intakes, online results |
| Campus life | `gallerySection.items` | Photo path, caption and alt text per image; the lightbox activates once they exist |
| Alumni quotes | `testimonialsSection.items` | Quote, name, year/programme — only with the graduate's written consent |
| FAQ | `faqSection.items[].answer` | Next intake dates, fee and instalment policy, certificate list |
| Contact | `site.email` | Institute email address (also feeds JSON-LD) |
| Footer | `footer.socials` | Real social profile URLs |
| Footer | `footer.privacy`, `footer.terms` | `/privacy` and `/terms` pages, then swap the placeholder text for links |
| Any deploy | `NEXT_PUBLIC_SITE_URL` | Public origin used by metadata, Open Graph, sitemap, robots and JSON-LD |

## Home page notes

- Colors come only from the `--eavi-*` tokens in `app/globals.css`; `public/logo.png`
  is the institute's own artwork and is never regenerated or restyled.
- Theme is class-based (`next-themes`, defaults to system). `dark:` variants follow the
  `dark` class on `<html>`, not a media query.
- Verify token compliance after edits with
  `node ~/.qoder/skills/eavi-brand-ui/scripts/check_eavi_tokens.mjs --scan components/home`.
