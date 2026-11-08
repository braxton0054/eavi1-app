# The KCSE grade gate

When an applicant submits the public form, their KCSE grade is compared against the minimum the
chosen programme requires (`Program.minKcseGrade`). If they do not clear it the application is
refused with **HTTP 422**, and the courses that *do* accept their grade are returned with it so the
form can offer them as one-tap alternatives.

## Ordering

The `EntryGrade` enum is declared best-first (`A … E`), so the **index is the ranking** — a lower
index is a better grade. The rule lives in `lib/admissions/grade.ts`:

```ts
meetsMinimum(applicant, minimum) => gradeRank(applicant) <= gradeRank(minimum)
```

A minimum is **inclusive**: a course asking C admits a C.

Keeping the order in one place matters because Kenyan KCSE grades are not evenly spaced. A second
hand-written list would drift from the enum the moment a grade is added.

## The boundary is the bug risk

The dangerous error is never the obvious direction; it is off-by-one at the line. A course asking C
must admit C and refuse C-. `npm run verify:grades` checks all 12 × 12 grade/minimum pairs against
the declared order, so neither direction can regress silently.

## What a refusal contains

```json
{
  "fieldErrors": { "grade": "This course asks for KCSE C-, and you have D+." },
  "suggestions": [
    { "id": "...", "name": "Certificate in Information Communication Technology", "minGrade": "D+" },
    { "id": "...", "name": "Diploma in Business Management", "minGrade": "D" }
  ]
}
```

Each suggestion carries its **id**, so the form selects the course directly. Making an applicant
scroll back to a select and find a course by name is the point where they give up instead.

Suggestions are ordered from the least to the most attainable, and only include programmes with a
campus that currently takes applicants — suggesting a course nobody teaches would send them to a
dead end.

## When nothing fits

If their grade clears nothing on offer the list is empty and the form says so in plain words,
pointing them at the campus office. That is the honest answer for an E where the lowest requirement
is D, and it is tested.

## Verified

`npm run verify:grades` — 26 checks: the ordering, the boundary in both directions, every
grade/minimum pair, the label formatting (`C_MINUS` → `C-`), the advice on which grade to aim for,
and the behaviour against the real programmes in the database.

Driven in a browser end to end: a D+ applicant refused the C- diploma is offered both courses that
accept D+, clicking one selects it, and resubmitting accepts the application and offers the
admission letter.
