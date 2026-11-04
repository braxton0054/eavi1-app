/** Prisma returns Decimal objects; Number(String(x)) is the only safe narrowing. */
type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(typeof value === "object" ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const kes = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const plainNumber = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });

export function money(value: Numeric): string {
  return kes.format(toNumber(value));
}

export function count(value: Numeric): string {
  return plainNumber.format(toNumber(value));
}

/** Two decimals, for filling a number input. */
export function amountInput(value: Numeric): string {
  return toNumber(value).toFixed(2);
}

export function percent(numerator: Numeric, denominator: Numeric): string {
  const total = toNumber(denominator);
  if (total === 0) return "—";
  return `${Math.round((toNumber(numerator) / total) * 100)}%`;
}

const dateLong = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const dateWithWeekday = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });

export function formatDate(value: Date | string | null | undefined): string {
  return value ? dateLong.format(new Date(value)) : "—";
}

export function formatDay(value: Date | string): string {
  return dateWithWeekday.format(new Date(value));
}

export function formatMonth(value: Date | string): string {
  return monthYear.format(new Date(value));
}

/** `Date` -> the `yyyy-mm-dd` a native date input expects. */
export function toDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Accepts 24-hour "HH:mm" and stores it normalized. */
export function cleanTime(value: string): string | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return match ? `${match[1]!.padStart(2, "0")}:${match[2]}` : null;
}

/** "08:30" plus minutes -> "08:30–10:00" style ranges are built by the caller. */
export function addMinutes(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}
