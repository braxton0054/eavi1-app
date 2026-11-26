/**
 * Copy for the public verification pages — student cards and admission letters.
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
    pending: "Card has not been issued",
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
  pendingBody:
    "This card exists in the register but has not been issued yet. It must not be accepted as proof of enrolment.",
  notEnrolledBody:
    "The institute has no active enrolment for this student, so this card is not current proof of enrolment.",
  revokedBody:
    "This card was reported lost, replaced, or withdrawn and must not be accepted.",
  footer: "East Africa Vision Institute · Eldoret, Kenya",
  checkedAt: "Checked just now against the institute register.",
  scannedHint:
    "Point a phone camera at the QR code on the back of a student card to reach this page.",
  dinMissing: "No reference code was supplied.",

  /*
   * Admission letters. The letter is generated automatically when an applicant submits the public
   * form, so a check has to distinguish "this really is one of our letters" from "this person has
   * been admitted" — the letter itself claims only the first.
   */
  letter: {
    title: "Admission letter verification",
    heading: {
      valid: "Genuine admission letter",
      invalid: "Not one of our letters",
      expired: "This letter has expired",
      revoked: "This letter was cancelled",
    },
    validBody:
      "This application was received by the institute, and the letter was issued from these records.",
    // The distinction that matters at a counter: the letter is proof of applying, nothing more.
    notAdmitted:
      "This confirms the application only. It is not an offer of admission, and a place is confirmed by the campus office separately.",
    invalidBody:
      "No admission letter in the institute's records matches this code. It may be forged or mistyped.",
    expiredBody:
      "The application date this letter covers has passed, so it should be treated as out of date.",
    revokedBody: "This letter was cancelled by the institute and must not be accepted.",
    labels: {
      name: "Applicant",
      reference: "Reference",
      programme: "Programme applied for",
      campus: "Campus",
      issued: "Issued",
      expires: "Apply by",
    },
    scannedHint:
      "Point a phone camera at the QR code on an admission letter to reach this page.",
  },
} as const;
