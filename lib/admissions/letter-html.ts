import { readFile } from "node:fs/promises";
import path from "node:path";

import { LETTER_CSS, type LetterAssets, type LetterView } from "@/components/admissions/offer-letter";
import { formatDate } from "@/lib/format";

/**
 * The letter as one self-contained HTML document.
 *
 * Written as a template rather than by rendering React. `react-dom/server` cannot be pulled into a
 * module an App Route imports — the build refuses it — and for a document that has to print the
 * same way every time, a plain template is the better tool regardless: there is no hydration, no
 * client runtime, and the output is deterministic.
 *
 * The three images are inlined as `data:` URIs. Chromium sets this document with `setContent`,
 * which gives it an opaque origin, so `/letterhead.png` would not resolve; and fetching from our
 * own server would make printing depend on the web server being reachable from inside the print
 * process.
 */

/** Files on disk, inlined once per process: they never change while the server is running. */
const cache = new Map<string, string>();

async function dataUri(name: string): Promise<string | null> {
  const cached = cache.get(name);
  if (cached) return cached;

  try {
    const bytes = await readFile(path.join(process.cwd(), "public", name));
    const uri = `data:image/png;base64,${bytes.toString("base64")}`;
    cache.set(name, uri);
    return uri;
  } catch {
    // A missing asset must not stop the letter: the text still has to go out.
    return null;
  }
}

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function letterhead(assets: LetterAssets): string {
  if (!assets.header) {
    // A letter without a heading is unusable, so the name is set as text instead of leaving a
    // broken image in its place.
    return `<div class="letterhead letterhead-text">
      <p class="letterhead-name">EAST AFRICA VISION INSTITUTE</p>
      <p class="letterhead-sub">School of Management and Human Capacity Building</p>
    </div>`;
  }
  return `<div class="letterhead"><img src="${assets.header}" alt="East Africa Vision Institute"></div>`;
}

function admissionPage(view: LetterView, assets: LetterAssets): string {
  return `
<section class="sheet">
  ${letterhead(assets)}

  <div class="letter-meta">
    <span>Ref: ${esc(view.reference)}</span>
    <span>${esc(formatDate(view.issuedOn))}</span>
  </div>

  <p class="letter-to">${esc(view.printedName)}</p>

  <h1 class="letter-title">ACKNOWLEDGEMENT OF APPLICATION</h1>

  <p>This letter confirms that <strong>${esc(view.printedName)}</strong> has applied for admission to the
  <strong>${esc(view.programName)}</strong> (${esc(view.programCode)}) at ${esc(view.campusName)}.</p>

  <p><strong>This is a record that your application was received. It is not an offer of a place.</strong>
  Your application will be reviewed by the campus office, and you will be contacted on the phone
  number you provided once a decision has been made.</p>

  <p>Keep this letter and bring it with you when you report. It is your proof of application, and the
  reference printed on it is how the office will find your record. Present it at ${esc(view.campusName)}
  for enrolment, together with the documents listed on page 3.</p>

  <p>The fees for your programme are set out on page 2, the requirements for your programme on page 3,
  and a bursary application form on page 4 for applicants who wish to seek funding. Please apply on or
  before <strong>${esc(formatDate(view.expiresAt))}</strong>.</p>

  <p class="letter-signoff-label">Issued by the Office of the Registrar,</p>

  <div class="signoff">
    <div class="signature-slot">
      ${assets.signature ? `<img class="signature" src="${assets.signature}" alt="">` : ""}
      ${view.stamped && assets.stamp ? `<img class="stamp" src="${assets.stamp}" alt="">` : ""}
    </div>
    <div class="signoff-rule"></div>
    <p class="signoff-name">The Registrar</p>
    <p class="signoff-org">East Africa Vision Institute</p>
  </div>

  <p class="verify">Verify this letter at ${esc(view.verificationUrl)} · Reference ${esc(view.reference)}</p>
  <p class="verify-note">Anyone can check that this letter is genuine at the address above. A letter
  whose reference does not verify is not one of ours.</p>
</section>`;
}

function requirementsPage(view: LetterView, assets: LetterAssets): string {
  const lines = (view.requirements ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  const body = lines.length
    ? `<ol class="requirements">${lines.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>`
    : `<p>Please contact the office for the requirements for this programme.</p>`;

  return `
<section class="sheet">
  ${letterhead(assets)}
  <h1 class="letter-title">PROGRAMME REQUIREMENTS</h1>
  <p class="letter-subtitle">${esc(view.programName)} (${esc(view.programCode)})</p>

  ${body}

  <p class="letter-note">Bring originals of all certificates and identification for verification on the
  reporting day. A student whose documents cannot be verified may not be registered.</p>

  <p class="verify">Reference ${esc(view.reference)} · ${esc(view.printedName)}</p>
</section>`;
}

export async function letterHtml(view: LetterView): Promise<string> {
  const [header, signature, stamp] = await Promise.all([
    dataUri("letterhead.png"),
    dataUri("letter-signature.png"),
    dataUri("letter-stamp.png"),
  ]);
  const assets: LetterAssets = { header, signature, stamp };

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Admission letter ${esc(view.reference)}</title>
<style>${LETTER_CSS}</style></head>
<body>
${admissionPage(view, assets)}
${requirementsPage(view, assets)}
</body>
</html>`;
}
