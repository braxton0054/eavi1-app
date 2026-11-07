/**
 * How long a card stays valid.
 *
 * This is **not** a policy figure invented here: a card is valid for as long as the student
 * is enrolled, so it expires when their programme ends. The programme's own duration is the
 * only honest source, and it is dated from the intake the student joined — a card printed
 * late in a term still expires with the cohort instead of drifting a year at a time.
 *
 * If a programme has no duration recorded the card is left without an expiry date rather
 * than given a guessed one: a printed expiry that the college never decided is worse than
 * no date, because it is a promise the system cannot keep.
 */
export function expiryForProgram(startedAt: Date, durationMonths: number | null) {
  if (!durationMonths || durationMonths <= 0) return null;
  return addMonths(startedAt, durationMonths);
}

/**
 * Adds whole months to a date, clamped to the end of the month. 31 January + 1 month is
 * 28/29 February, not 3 March, so an expiry date never drifts forward a year at a time.
 */
export function addMonths(from: Date, months: number) {
  const day = from.getUTCDate();
  const target = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + months, 1, 12, 0, 0, 0),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(day, lastDay));
  return target;
}
