import { formatDate } from "@/lib/format";

/**
 * The admission letter, as paper.
 *
 * This is a **record of application**, not an offer of a place. It is generated automatically the
 * moment the public form is submitted, with no office review in between, so it cannot honestly
 * claim that anybody admitted the applicant. What it does is prove the application was received and
 * tie it to a reference the college can confirm — which is exactly what it must do, since it is the
 * document a student brings to enrolment.
 *
 * Laid out in millimetres because that is what the sheet is measured in: the same numbers that
 * define A4's margins in a print dialogue define them here, so the preview and the PDF cannot
 * disagree. Every page carries `break-after: page` so the four parts never share a sheet.
 *
 * The header image is the college's own artwork rather than text we typeset. It carries the
 * crest, both campus addresses and the contact lines; reproducing that by hand would drift from
 * the printed stationery the moment the artwork is updated.
 */

/** A4 less a 16mm margin. Passed to Chromium so the browser and our CSS agree on the page box. */
export const PAGE = { widthMm: 210, heightMm: 297, marginMm: 16 } as const;

/** The letterhead and sign-off artwork, already inlined as data URIs. */
export type LetterAssets = {
  header: string | null;
  signature: string | null;
  stamp: string | null;
};

export type LetterView = {
  reference: string;
  printedName: string;
  admissionNo?: string | null;
  programName: string;
  programCode: string;
  campusName: string;
  intakeLabel: string;
  startDate: Date;
  expiresAt: Date;
  issuedOn: Date;
  requirements: string | null;
  verificationUrl: string;
  /** True only for a letter the office has actually issued and stamped. */
  stamped: boolean;
};

/**
 * The four pages.
 *
 * Pages 2 and 4 are not here: they are the uploaded fee structure and bursary form, inserted
 * afterwards at full A4. Rendering them ourselves would mean redrawing documents the office
 * signed off, and a redrawn fee table is a claim we have no business making.
 */
export function OfferLetter({ view, assets }: { view: LetterView; assets: LetterAssets }) {
  return (
    <article className="offer-letter">
      <AdmissionPage view={view} assets={assets} />
      {/* Page 2 is inserted by the assembler. */}
      <RequirementsPage view={view} assets={assets} />
      {/* Page 4 is inserted by the assembler. */}
    </article>
  );
}

/**
 * The college's own letterhead.
 *
 * When the artwork is missing the name is set as text instead of leaving a broken image: a letter
 * without a heading is unusable, and a missing file must not produce one.
 */
function Letterhead({ assets }: { assets: LetterAssets }) {
  if (!assets.header) {
    return (
      <div className="letterhead letterhead-text">
        <p className="letterhead-name">EAST AFRICA VISION INSTITUTE</p>
        <p className="letterhead-sub">School of Management and Human Capacity Building</p>
      </div>
    );
  }
  return (
    <div className="letterhead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assets.header} alt="East Africa Vision Institute" />
    </div>
  );
}

function AdmissionPage({ view, assets }: { view: LetterView; assets: LetterAssets }) {
  return (
    <section className="sheet">
      <Letterhead assets={assets} />

      <div className="letter-meta">
        <span>Ref: {view.reference}</span>
        <span>{formatDate(view.issuedOn)}</span>
      </div>

      <p className="letter-to">{view.printedName}</p>

      <h1 className="letter-title">ACKNOWLEDGEMENT OF APPLICATION</h1>

      <p>
        This letter confirms that <strong>{view.printedName}</strong> has applied for admission to
        the <strong>{view.programName}</strong> ({view.programCode}) at {view.campusName} for the{" "}
        {view.intakeLabel}.
      </p>

      <p>
        <strong>This is a record that your application was received. It is not an offer of a
        place.</strong> Your application will be reviewed by the campus office, and you will be
        contacted on the phone number you provided once a decision has been made.
      </p>

      <p>
        Keep this letter and bring it with you when you report. It is your proof of application, and
        the reference printed on it is how the office will find your record. Present it at{" "}
        {view.campusName} for enrolment, together with the documents listed on page 3.
      </p>

      <p>
        The fees for your programme are set out on page 2, the requirements for your programme on
        page 3, and a bursary application form on page 4 for applicants who wish to seek funding.
        Please apply on or before <strong>{formatDate(view.expiresAt)}</strong>.
      </p>

      <p className="letter-signoff-label">Issued by the Office of the Registrar,</p>

      {/*
        Signature above the stamped block, with the stamp overlapping it. That is how it reads on
        real paper: the principal signs, then the stamp is applied across the signature.
      */}
      <div className="signoff">
        <div className="signature-slot">
          {assets.signature ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="signature" src={assets.signature} alt="" />
          ) : null}
          {view.stamped && assets.stamp ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img className="stamp" src={assets.stamp} alt="" />
          ) : null}
        </div>
        <div className="signoff-rule" />
        <p className="signoff-name">The Registrar</p>
        <p className="signoff-org">East Africa Vision Institute</p>
      </div>

      <p className="verify">
        Verify this letter at {view.verificationUrl} · Reference {view.reference}
      </p>
      <p className="verify-note">
        Anyone can check that this letter is genuine at the address above. A letter whose reference
        does not verify is not one of ours.
      </p>
    </section>
  );
}

function RequirementsPage({ view, assets }: { view: LetterView; assets: LetterAssets }) {
  const lines = (view.requirements ?? "")
    .split("\n")
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);

  return (
    <section className="sheet">
      <Letterhead assets={assets} />

      <h1 className="letter-title">PROGRAMME REQUIREMENTS</h1>
      <p className="letter-subtitle">
        {view.programName} ({view.programCode})
      </p>

      {lines.length > 0 ? (
        <ol className="requirements">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      ) : (
        // Never print an empty page: say plainly that there is nothing to add.
        <p>
          Please contact the office for the requirements for this programme.
        </p>
      )}

      <p className="letter-note">
        Bring originals of all certificates and identification for verification on the reporting
        day. A student whose documents cannot be verified may not be registered.
      </p>

      <p className="verify">
        Reference {view.reference} · {view.printedName}
      </p>
    </section>
  );
}

/**
 * The print styles, inlined into the page that Chromium renders.
 *
 * Millimetres throughout, and `@page` declares the sheet so `preferCSSPageSize` has something
 * truthful to defer to. Fixed positioning is avoided: it duplicates content onto every page.
 */
export const LETTER_CSS = `
@page { size: A4; margin: ${PAGE.marginMm}mm; }

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #111;
  font-family: "Times New Roman", Georgia, serif;
  font-size: 11.5pt;
  line-height: 1.55;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.sheet {
  display: flex;
  flex-direction: column;
  min-height: ${PAGE.heightMm - PAGE.marginMm * 2}mm;
  break-after: page;
  page-break-after: always;
  position: relative;
}
.sheet:last-child { break-after: auto; page-break-after: auto; }

.letterhead { margin-bottom: 6mm; }
.letterhead img { width: 100%; height: auto; display: block; }
.letterhead-text { text-align: center; border-bottom: 0.6mm double #1d3f8f; padding-bottom: 3mm; }
.letterhead-name { margin: 0; font-size: 15pt; font-weight: 700; color: #1d3f8f; letter-spacing: 0.04em; }
.letterhead-sub { margin: 1mm 0 0; font-size: 10pt; color: #a01d1d; }

.letter-meta {
  display: flex;
  justify-content: space-between;
  font-size: 9.5pt;
  color: #333;
  border-bottom: 0.3mm solid #999;
  padding-bottom: 1.5mm;
  margin-bottom: 6mm;
}

.letter-to { margin: 0 0 4mm; font-weight: 700; }

.letter-title {
  font-size: 13pt;
  letter-spacing: 0.06em;
  text-align: center;
  text-decoration: underline;
  margin: 0 0 5mm;
}

.letter-subtitle { text-align: center; margin: -3mm 0 6mm; font-size: 10.5pt; }

p { margin: 0 0 3.5mm; text-align: justify; }
strong { font-weight: 700; }

.letter-signoff-label { margin-top: 6mm; }

.signoff { margin-top: 2mm; }
.signature-slot { position: relative; height: 26mm; width: 62mm; }
.signature { position: absolute; left: 0; top: 0; width: 30mm; height: auto; }
.stamp { position: absolute; left: 16mm; top: 13mm; width: 44mm; height: auto; opacity: 0.9; }

.signoff-rule { width: 62mm; border-top: 0.3mm solid #444; margin-bottom: 1.5mm; }
.signoff-name { margin: 0; font-weight: 700; }
.signoff-org { margin: 0; font-size: 10pt; color: #333; }

.requirements { margin: 0 0 5mm; padding-left: 6mm; }
.requirements li { margin-bottom: 2mm; text-align: justify; }

.letter-note {
  margin-top: 4mm;
  padding: 3mm;
  border: 0.3mm solid #999;
  background: #f7f7f7;
  font-size: 10pt;
}

.verify-note {
  margin: -2mm 0 0;
  font-size: 7.5pt;
  color: #777;
  text-align: center;
}

.verify {
  margin-top: auto;
  padding-top: 4mm;
  border-top: 0.3mm solid #ccc;
  font-size: 8pt;
  color: #555;
  text-align: center;
}
`;
