export const isEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

/** Kenyan numbers are written as 07xx…, 01xx…, 7xx… or +2547…; all mean the same line. */
export function normalizeKenyanPhone(value: string): string | null {
  const digits = value.replace(/[^\d+]/g, "");
  if (/^\+?254\d{9}$/.test(digits)) return `+254${digits.slice(-9)}`;
  if (/^0[71]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^[71]\d{8}$/.test(digits)) return `+254${digits}`;
  return null;
}
