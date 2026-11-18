# Handoff — superadmin-owned registers + Town Office + fee wizard

Branch: `fix/town-office-and-fee-wizard` (based on `origin/main` @ `e3790ed`).
Nothing was pushed. Commit: `3126abc`.

## What was requested
1. **Programmes** moved to the super admin. Both campuses share ONE catalogue. Campus admins may only view/print — no adding.
2. **Academic calendar** — same model: super admin manages, campus admins view. Shared across campuses (college-wide periods, `campusId = null`).
3. **Tutors** — same: moved to the super admin; campus admins view only.

Also carried over from earlier complaints: Town Office still in the superadmin dropdown, and the fee wizard "Continue" appearing locked for a student who completed Semester 1.

## Root causes found
- The data model was already shared (commit `dda72e4` and its migration connected every programme to every campus and deduplicated academic periods). What was missing was **authorization**: every management action still called `requireCollegeAdmin()`.
- Town Office: the code correctly filters `takesApplicants: true`, but the **production DB has Town Office flagged `true`** (local DB had `false`). A code-only filter cannot fix bad data.

## What is implemented
- All management actions now call `requireSuperAdmin()`: `programs.ts`, `calendar.ts`, `tutors.ts`, the catalogue-structure actions in `program-units.ts` (createUnit / assign / remove / module CRUD), and the attachment-requirement actions in `attachments.ts`.
  - `registerUnitPeriod` and `saveUnitResult` were deliberately LEFT as `requireCollegeAdmin()` — they are student-record operations used on `/dashboard/students/[id]`.
- UI gating with `canManage = scope.role === "SUPERADMIN"` on: programmes list/detail/units/fees/attachment, calendar, tutors. Add/edit/archive/delete forms are hidden from campus admins; the fee page shows a read-only period table instead of the fee editor. A `PrintButton` was added to the programme detail page so campus admins can print.
- New migration `20261127090000_fix_town_office_teaching_flag` sets `takesApplicants = false` for `code = 'town'`. This drops Town Office out of every `takesApplicants: true` picker (scope dropdown, applicant assignment) while keeping the record in campus management.

## Fee wizard finding
The wizard is **already working correctly** in `e3790ed`. Verified in a real browser against local data: a student with only Semester 1 completed shows a "Completed" chip for Sem 1, lists Sem 2/3/… as selectable, and Continue is enabled after selecting Sem 2. The earlier "locked Continue" report came from an older deploy. No code change was needed here.

## Verification performed
- `tsc --noEmit`: clean. `npm run lint`: 0 errors. `npm run build`: green.
- Playwright (local production server): superadmin sees new-program/settings/new-tutor/new-period/new-event forms; campus admin sees zero forms on all three main pages and all four programme sub-pages. Print button present, edit forms absent for campus admin.
- Fee wizard scenario verified as described above.

## Remaining work for the next agent
1. **Deploy is required for the Town Office fix** — the migration only takes effect after the branch is merged and deployed. Confirm the production dropdown then shows only Main Campus / West Campus.
2. Consider whether campus admins should keep the "Tutors" nav item at all (currently they see a read-only register). If the requirement is "remove from their nav entirely", edit `navGroups` in `lib/content/dashboard.ts` and add a dedicated read-only page for superadmin if needed.
3. Re-run the deployment smoke test (health 200, dropdown options, role gating on live) after merge.
