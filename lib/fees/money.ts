export const MAX_MONEY_CENTS = 999_999_999_999;

/** Exact conversion for DECIMAL(12,2). Invalid minor units are rejected, never rounded. */
export function toCents(value: unknown): number {
  const raw = typeof value === "number" ? String(value) : String(value ?? 0);
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw new Error("Money must have no more than two decimal places.");
  }
  const negative = raw.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? raw.slice(1) : raw).split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Money is outside the supported range.");
  return negative ? -cents : cents;
}

/** Prisma accepts decimal strings; this avoids every floating-point conversion. */
export function fromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error("Money must be whole cents.");
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function sumAmountCents(rows: Array<{ amount: unknown }>): number {
  return rows.reduce((total, row) => {
    const cents = toCents(row.amount);
    if (!Number.isSafeInteger(total + cents)) throw new Error("Ledger total is outside the supported range.");
    return total + cents;
  }, 0);
}

/** Fee-plan input is exact decimal money; an individual period may be zero. */
export function parseFeeAmount(raw: string): number {
  const value = raw.trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter an amount with no more than two decimal places.");
  }
  const cents = toCents(value);
  if (cents > MAX_MONEY_CENTS) throw new Error("Money is outside the supported range.");
  return cents;
}

/** Payment input is a plain decimal string with at most two fractional digits. */
export function parsePaymentAmount(raw: string): number {
  const value = raw.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter an amount with no more than two decimal places.");
  }
  const cents = toCents(value);
  if (cents <= 0 || cents > MAX_MONEY_CENTS) {
    throw new Error("Enter a valid payment amount.");
  }
  return cents;
}
