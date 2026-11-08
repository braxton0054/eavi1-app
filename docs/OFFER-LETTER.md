## The admission letter

**Generated automatically on submission.** There is no office approval step: the applicant fills in
the public form, hits submit, and downloads the letter immediately. That letter is what they bring
to enrolment as proof they applied.

A four-page A4 document, generated from an application. Nothing is stored as a file: the letter is
rebuilt each time, so a reprint always matches the terms it was issued on.

| Page | Content | Built by |
|---|---|---|
| 1 | Letter of admission | HTML → Chromium |
| 2 | The programme's uploaded fee structure | **inserted unchanged** |
| 3 | Programme requirements | HTML → Chromium |
| 4 | Bursary form | **inserted unchanged** |

### Why the fee structure is inserted rather than generated

`Program.feeStructureUrl` holds the document the office signed off. `FeeItem` rows are what the
system *bills*, which is not always the same thing — they omit notes like "includes exam fee,
excludes attachment". A generated table that disagreements with the signed PDF is the worst
outcome for a letter a student keeps, so the uploaded page is embedded byte for byte.

### Assets

- `public/letterhead.png` — the college letterhead, from `admistion templete/header.png`
- `public/letter-signature.png` — the principal's signature, **converted to transparent** (the
  original had an opaque white box that would paint over the letter)
- `public/letter-stamp.png` — the PRINCIPAL stamp, from `admistion templete/stamp.png`
- `public/bursary-form.pdf` — the default bursary form, from `admistion templete/smple busary from.pdf`

All three images are inlined as `data:` URIs before rendering. Chromium's `setContent` gives the
document an opaque origin, so a relative `/letterhead.png` cannot resolve, and fetching from our
own server would make printing depend on the web server being reachable from inside the print
process.

### Inserted PDFs must be A4

`checkA4` refuses a page that is not 210×297mm (2mm tolerance, landscape allowed) and reports why —
`fee structure — page 1 is 216×279mm, not A4 (210×297mm)`. Scaling silently would print a letter
whose fee page is subtly wrong; a clear refusal is better.

### The wording is not "you have been admitted"

Because nobody reviews the form before the letter is generated, the letter must not claim that
anybody admitted the applicant. Anyone can submit the public form with any name — a document saying
"we are pleased to offer you admission", downloadable without a check, would be both untrue and
trivial to forge.

So it is headed **ACKNOWLEDGEMENT OF APPLICATION** and states plainly: *"This is a record that your
application was received. It is not an offer of a place."* It proves the application exists and ties
it to a reference the office can confirm — which is exactly what an enrolment counter needs.

### Authority comes from the token, not a session

The applicant has no account, so the download is public. `OfferLetter.reference` is sequential
(`APP/2026/0001`), so the **token** is what makes the letter theirs: `/letter/<reference>?t=<token>`.
Honouring the reference alone would let anyone walk the range and download other people's letters,
name and programme included. Verified: reference alone is refused, a wrong token is refused, and one
applicant's token does not open another's letter.

A wrong reference and a wrong token return the same message on purpose — distinguishing them would
confirm that a reference exists.

The letter is stamped because it is the document the student presents at the counter. That is safe
only because the stamp is ours and the pair cannot be forged in the other direction: anyone can
check it at `/verify/<token>`.

### Verifying at the counter

`/verify/<token>` answers for both documents, because cards and letters print the same QR and share
one token space. The token is looked up in both tables and whichever matches decides what the page
says.

A letter answers in four states: genuine, expired (past its apply-by date), cancelled (`revokedAt`),
and unrecognised. The genuine page says in words that the letter **is not an offer of admission**
and that a place is confirmed separately — a green tick alone would read as "this person is
admitted", which is the one thing the letter must not imply. It also says "an admission letter",
not "the back of a student card".

Verified: `npm run verify:letters` — 16 checks, including that a letter page never tells the reader
to scan a student card.

### Re-issuing keeps the token

`issueLetterForApplication` upserts. A second call never mints a second token, because the first was
already handed to an applicant who may have printed it. `revokedAt` stops a download even with a
correct token.

### Known limits

- `letter-signature.png` is **88×70px** with only 3.3% strong ink. At 30mm it prints around 80dpi
  and reads as a light, soft signature. A higher-resolution scan would fix this and nothing in the
  code can.
- `header.png` is a raster at 979px wide stretched to 180mm — about 138dpi. Fine on screen, slightly
  soft on a laser printer. A vector letterhead would print crisp.
- The bursary form is a **recommendation letter to a bursary committee**, carrying an old hardcoded
  reference `EAVI/7952/2019`. It is printed as-is; if the college has a blank student application
  form, replace `public/bursary-form.pdf`.
