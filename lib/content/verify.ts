/**
 * Copy for the public card verification page.
 *
 * This page is reached by a stranger scanning a card, with no account and no context, so
 * every sentence has to stand alone. It lives here rather than in the page because the
 * wording is the part that carries the meaning: "not a valid card" must never be softened
 * into something ambiguous, on a page whose whole job is to say yes or no.
 */
export const verify = {
  title: "Card verification",
  heading: {
    valid: "Verified student",
    invalid: "Not a valid card",
    expired: "Card has expired",
    revoked: "Card is no longer valid",
  },
  intro:
    "This page checks a student card against East Africa Vision Institute's own records. Nothing here is read from the card itself.",
  labels: {
    name: "Name",
    admissionNo: "Admission number",
    programme: "Programme",
    campus: "Campus",
    status: "Status",
    expires: "Valid until",
    issued: "Issued",
  },
  validBody:
    "This card was issued by the institute and the student is currently enrolled.",
  invalidBody:
    "No card in the institute's records matches this code. It may be forged, mistyped, or from another institution.",
  expiredBody:
    "The student's enrolment on this card's programme has ended, so the card is no longer proof of enrolment.",
  revokedBody:
    "This card was reported lost, replaced, or withdrawn and must not be accepted.",
  footer: "East Africa Vision Institute · Eldoret, Kenya",
  checkedAt: "Checked just now against the institute register.",
  scannedHint:
    "Point a phone camera at the QR code on the back of a student card to reach this page.",
  dinMissing: "No reference code was supplied.",
} as const;
