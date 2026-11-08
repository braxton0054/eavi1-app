## The admission letter

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

### Stamping is a decision, not decoration

`LetterView.stamped` controls whether the signature and stamp are drawn. A signature and an official
stamp on a PDF are credentials: released generically, they are a forgery template. The letter should
only carry them when the office actually issues it, and the `OfferLetter` row records who issued it
and when.

### Known limits

- `letter-signature.png` is **88×70px** with only 3.3% strong ink. At 30mm it prints around 80dpi
  and reads as a light, soft signature. A higher-resolution scan would fix this and nothing in the
  code can.
- `header.png` is a raster at 979px wide stretched to 180mm — about 138dpi. Fine on screen, slightly
  soft on a laser printer. A vector letterhead would print crisp.
- The bursary form is a **recommendation letter to a bursary committee**, carrying an old hardcoded
  reference `EAVI/7952/2019`. It is printed as-is; if the college has a blank student application
  form, replace `public/bursary-form.pdf`.
