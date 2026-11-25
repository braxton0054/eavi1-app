# Application flow changes — plan

## What exists today

- `app/(public)/apply/page.tsx` → `ApplicationForm` (client) posts to `POST /api/applications`.
- The API validates, grade-checks, assigns a campus, checks for an **open** duplicate by
  `phone + programId` only, creates the application, and issues an `OfferLetter` with a
  verification token. It returns `{ reference, campusName, letterUrl: /letter/... }`.
- `GET /letter/[reference]?t=<token>&format=svg|pdf` serves the letter. **Default is SVG**;
  PDF is opt-in. `LetterDownload` in the form renders two buttons (SVG and PDF).
- `StudentProfile.applicationId` links an application to an enrolled student. So "is this
  applicant enrolled?" can be answered by checking for a student profile with that
  application id.
- `OfferLetter.upsert` keeps one letter per application and preserves the token.

## What the user wants

1. **PDF only.** No SVG/PDF choice — the real document is the PDF.
2. **Review animation during generation.** While the letter is being created the UI must
   say "Your details are being reviewed — please wait a moment", not "Creating PDF".
   When done: **auto-download** the PDF and show "Congratulations, your application was
   received. We hope you join us soon."
3. **One application per person.** Validate by **email or phone** — if they ever applied,
   do not allow a second application. Enrolled applicants get a distinct message:
   "You are already enrolled — please visit the [campus name] offices."
4. **Re-download / update the letter while not yet enrolled**: the applicant must be able to
   get the letter again, and change programme, **only before enrolment**. Once enrolled,
   no changes — show the enrolled message.
5. Plan first, understand what is there — do not guess.

## Decisions

- **Identity lookup:** a public lookup endpoint that takes `{ email?, phone? }` and returns
  one of: `not_found`, `enrolled` (with campus name), `applied` (with reference, token,
  campus, programme, and whether the letter exists). It must **not** leak other people's
  details: it returns data only for the exact email/phone the caller typed, and the letter
  URL always carries the unguessable per-letter verification token. Rate-limit it like the
  application endpoint.
- **Duplicate rule in POST:** reject when `email` OR normalized `phone` matches **any**
  application, not only open ones for the same programme. If a student profile exists for
  that application, return the enrolled message with the campus name.
- **Programme change:** `POST /api/applications/update` with `{ reference, verifyToken,
  programId }`. Allowed only when the application has no student profile (not enrolled).
  Re-check grade and campus assignment, update `programId`/`campusId`, and refresh the letter
  (`upsert` currently preserves the token; we need to update the frozen program fields and
  requirements). Revoked letters cannot be changed.
- **Letter download:** a single PDF button that fetches `format=pdf` and triggers a browser
  download. The generation screen is shown while the POST is in flight, and the PDF
  download starts automatically when the response arrives.
- **Success copy** and the "being reviewed" animation copy live in `lib/content/apply.ts`.

## Build order

1. Content copy in `lib/content/apply.ts`.
2. API: `GET /api/applications/lookup`, change duplicate/enrolled logic in POST, add
   `POST /api/applications/update`.
3. `ApplicationForm`: lookup stage (email/phone), review/animating state, auto-download,
   success screen, re-download/change-programme screen for not-yet-enrolled applicants.
4. Verify with Playwright: new application, repeat application by email and by phone,
   enrolled applicant message, re-download, programme change, enrolled applicant blocked.
5. Audit, tsc, lint, build, commit, push, deploy.

## Risks

- Public lookup can enumerate emails/phones; mitigated by rate limiting and by returning
  only a status plus the caller's own letter token (which is already unguessable).
- Letter updates must not rewrite an enrolled student's records — guarded by the student
  profile check.
- Keep the existing verification-token URL scheme; do not introduce a second document path.
