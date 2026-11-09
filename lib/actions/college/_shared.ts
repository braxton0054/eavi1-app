/**
 * Shared pieces every college-admin mutation needs: reading a field out of a submitted
 * form, proving the caller owns the campus the record is being written to, and issuing
 * the reference numbers the college expects to see on paper.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { fieldErrors } from "@/lib/content/dashboard";
import { isEmail, normalizeKenyanPhone } from "@/lib/validation";
import { prisma } from "@/lib/prisma";
import { storageConfigured, uploadFile } from "@/lib/storage";

/** Thrown with wording the administrator can act on; the error boundary prints it as-is. */
export class FieldError extends Error {}

const pad = (value: number, width: number) => String(value).padStart(width, "0");

const year = () => new Date().getFullYear();

export function text(formData: FormData, name: string): string | null {
  const raw = formData.get(name);
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  return value ? value : null;
}

export function requiredText(formData: FormData, name: string, label: string): string {
  const value = text(formData, name);
  if (!value) throw new FieldError(fieldErrors.required(label));
  return value;
}

export function numberField(formData: FormData, name: string, label: string): number | null {
  const raw = text(formData, name);
  if (raw === null) return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new FieldError(fieldErrors.number(label));
  return value;
}

export function requiredNumber(formData: FormData, name: string, label: string): number {
  const value = numberField(formData, name, label);
  if (value === null) throw new FieldError(fieldErrors.required(label));
  return value;
}

export function dateField(formData: FormData, name: string): Date | null {
  const raw = text(formData, name);
  if (!raw) return null;

  /*
   * A date input posts `YYYY-MM-DD`, which is a calendar day and not an instant. Parsed with
   * `new Date(raw)` it becomes UTC midnight, but the server then runs `startOfDay` in local
   * time — and in a UTC+3 container that moves UTC midnight back to 21:00 on the *previous*
   * day. The displayed date survives because every read shifts the same way, but the row is
   * stored at the wrong instant, and anything comparing it against a date built elsewhere
   * (a cron sweep, a report in UTC, an export) sees the day before.
   *
   * Pinned to UTC midnight here instead, so what is stored is exactly the day that was typed.
   */
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const exact = new Date(`${raw}T00:00:00.000Z`);
    return Number.isNaN(exact.getTime()) ? null : exact;
  }

  const value = new Date(raw);
  return Number.isNaN(value.getTime()) ? null : value;
}

export function requiredDate(formData: FormData, name: string, label: string): Date {
  const value = dateField(formData, name);
  if (!value) throw new FieldError(fieldErrors.date(label));
  return value;
}

export function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "yes";
}

/** Enum-typed select: anything outside the allowed list is refused, not cast. */
export function enumField<T extends string>(
  formData: FormData,
  name: string,
  allowed: readonly T[],
  label: string,
  fallback?: T,
): T {
  const raw = text(formData, name);
  if (raw === null) {
    if (fallback === undefined) throw new FieldError(fieldErrors.required(label));
    return fallback;
  }
  if (!(allowed as readonly string[]).includes(raw)) throw new FieldError(fieldErrors.choice(label));
  return raw as T;
}

/** Optional id carried by the form (the record being edited), straight from a hidden input. */
export function hiddenId(formData: FormData, name: string, label: string): string {
  return requiredText(formData, name, label);
}

/** "HH:mm" from a native time input, normalised so two rows can be compared. */
export function timeField(
  formData: FormData,
  name: string,
  label: string,
  optional = false,
): string | null {
  const raw = text(formData, name);
  if (raw === null) {
    if (optional) return null;
    throw new FieldError(fieldErrors.required(label));
  }
  if (!/^\d{2}:\d{2}$/.test(raw)) throw new FieldError(fieldErrors.time(label));
  const [hours = 0, minutes = 0] = raw.split(":").map(Number);
  if (hours > 23 || minutes > 59) throw new FieldError(fieldErrors.time(label));
  return `${pad(hours, 2)}:${pad(minutes, 2)}`;
}

export function orderedTimes(start: string, end: string) {
  if (end <= start) throw new FieldError(fieldErrors.timeOrder);
}

export function emailField(formData: FormData, name: string, label: string, optional?: false): string;
export function emailField(formData: FormData, name: string, label: string, optional: true): string | null;
export function emailField(formData: FormData, name: string, label: string, optional = false): string | null {
  const raw = text(formData, name);
  if (raw === null) {
    if (optional) return null;
    throw new FieldError(fieldErrors.required(label));
  }
  if (!isEmail(raw)) throw new FieldError(fieldErrors.email(label));
  return raw.toLowerCase();
}

/** Kenyan numbers all mean one line; store the +254 form so searches match. */
export function phoneField(formData: FormData, name: string, label: string, optional = true): string | null {
  const raw = text(formData, name);
  if (raw === null) {
    if (optional) return null;
    throw new FieldError(fieldErrors.required(label));
  }
  const normalized = normalizeKenyanPhone(raw);
  if (!normalized) throw new FieldError(fieldErrors.phone(label));
  return normalized;
}

export function passwordField(formData: FormData, name: string, label: string): string {
  const value = requiredText(formData, name, label);
  if (value.length < 10) throw new FieldError(fieldErrors.password(label));
  return value;
}

/**
 * Files travel through a Server Action, whose request body is capped in next.config.ts.
 * The byte limit here is set below that so the multipart framing has room left over and an
 * oversized file is refused with a sentence rather than a server error.
 */
export const MAX_UPLOAD_MB = 10;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/**
 * A file the administrator attached. A file picker that was opened and cancelled arrives as
 * an empty file, which counts as "nothing attached" instead of a missing answer.
 * Asking for a non-optional file also makes the return non-nullable, so callers never cast.
 */
export async function fileField(
  formData: FormData,
  name: string,
  label: string,
  kind: "pdf" | "image",
  optional: false,
): Promise<File>;
export async function fileField(
  formData: FormData,
  name: string,
  label: string,
  kind: "pdf" | "image",
  optional?: true,
): Promise<File | null>;
export async function fileField(
  formData: FormData,
  name: string,
  label: string,
  kind: "pdf" | "image",
  optional = true,
): Promise<File | null> {
  const raw = formData.get(name);
  const file = raw instanceof File ? raw : null;
  if (!file || file.size === 0) {
    if (optional) return null;
    throw new FieldError(fieldErrors.required(label));
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new FieldError(fieldErrors.fileSize(label, MAX_UPLOAD_MB));

  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
  const isImage =
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    [".jpg", ".jpeg", ".png"].some((extension) => lowerName.endsWith(extension));

  if (kind === "pdf" && !isPdf) throw new FieldError(fieldErrors.pdf(label));
  if (kind === "image" && !isImage) throw new FieldError(fieldErrors.image(label));

  return file;
}

/**
 * Checked before any row is written: a form that carries a file but has nowhere to put it
 * must change nothing at all.
 */
export function assertStorageFor(files: readonly (File | null)[]) {
  if (files.some((file) => file !== null) && !storageConfigured()) {
    throw new FieldError(fieldErrors.storageOff);
  }
}

/** The original filename never reaches a storage path; only the safe characters of it do. */
export async function putFile(file: File, folder: string, keySeed: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return uploadFile(
    `${folder}/${keySeed}/${Date.now()}-${safeName}`,
    buffer,
    file.type || "application/octet-stream",
  );
}

/**
 * A unique index the administrator tripped over reads better as a form message than as a
 * database error, so every action runs its write through this.
 */
export async function unique<T>(label: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new FieldError(fieldErrors.duplicate(label));
    }
    throw error;
  }
}

/**
 * Anything other records already point at cannot be removed, and the database only says so
 * as a constraint name. Counting the references first turns that into a sentence, and the
 * row is left exactly as it was.
 */
export async function refuseWhenUsed(
  blocked: string,
  references: () => Promise<boolean>,
  work: () => Promise<unknown>,
): Promise<void> {
  if (await references()) throw new FieldError(blocked);
  await work();
}

/**
 * A semester runs on one campus only, so a form-supplied semester id is honoured only when that semester
 * is the caller's. Blank stays blank; a foreign semester is refused rather than quietly dropped.
 */
export async function semesterOnCampus(
  formData: FormData,
  name: string,
  campusId: number | null,
): Promise<string | null> {
  const value = text(formData, name);
  if (!value) return null;

  const semester = await prisma.semester.findUnique({
    where: { id: value },
    select: { id: true, campusId: true },
  });
  if (!semester || (campusId !== null && semester.campusId !== campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }

  return semester.id;
}

/**
 * This year and the one being planned ahead are the only ones still open for changes;
 * anything older stays readable but closed.
 */
export function assertOpenYear(year: number) {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(year) || year < currentYear || year > currentYear + 1) {
    throw new FieldError(fieldErrors.yearClosed);
  }
}

/** Midnight this morning, so a day only counts as gone once it is fully behind us. */
export function startOfToday(): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Walks upward from the row count until the formatted code is free, so a deleted record
 * never causes a collision on the number printed on a student's invoice.
 */
async function issueCode(
  count: () => Promise<number>,
  format: (sequence: number) => string,
  taken: (code: string) => Promise<number>,
): Promise<string> {
  let sequence = (await count()) + 1;
  for (let attempt = 0; attempt < 500; attempt += 1, sequence += 1) {
    if ((await taken(format(sequence))) === 0) return format(sequence);
  }
  throw new FieldError(fieldErrors.exhausted);
}

export function nextAdmissionNo() {
  return issueCode(
    () => prisma.studentProfile.count(),
    (sequence) => `EAVI/${year()}/${pad(sequence, 4)}`,
    (code) => prisma.studentProfile.count({ where: { admissionNo: code } }),
  );
}

export function nextStaffNo() {
  return issueCode(
    () => prisma.tutorProfile.count(),
    (sequence) => `STF/${pad(sequence, 3)}`,
    (code) => prisma.tutorProfile.count({ where: { staffNo: code } }),
  );
}

export function nextApplicationReference() {
  return issueCode(
    () => prisma.application.count(),
    (sequence) => `APP/${year()}/${pad(sequence, 4)}`,
    (code) => prisma.application.count({ where: { reference: code } }),
  );
}

export function nextInvoiceNumber() {
  return issueCode(
    () => prisma.invoice.count(),
    (sequence) => `INV/${year()}/${pad(sequence, 5)}`,
    (code) => prisma.invoice.count({ where: { number: code } }),
  );
}

/**
 * A whole fee schedule is billed in one transaction, so it needs its numbers reserved up
 * front: each one is checked against the table and against the ones already reserved here,
 * because `count()` cannot see rows the transaction has not written yet.
 */
export async function nextInvoiceNumbers(count: number): Promise<string[]> {
  const reserved: string[] = [];
  let sequence = (await prisma.invoice.count()) + 1;

  while (reserved.length < count) {
    const code = `INV/${year()}/${pad(sequence, 5)}`;
    if (!reserved.includes(code) && (await prisma.invoice.count({ where: { number: code } })) === 0) {
      reserved.push(code);
    }
    sequence += 1;
    if (sequence > 10_000_000) throw new FieldError(fieldErrors.exhausted);
  }

  return reserved;
}

/** The reference a payer is given; one receipt may settle several periods. */
export function nextReceiptNumber() {
  return issueCode(
    () => prisma.payment.count({ where: { receiptNo: { not: null } } }),
    (sequence) => `RCP/${year()}/${pad(sequence, 4)}`,
    (code) => prisma.payment.count({ where: { receiptNo: code } }),
  );
}

export function nextCardSerial() {
  return issueCode(
    () => prisma.idCard.count(),
    (sequence) => `IDC/${year()}/${pad(sequence, 4)}`,
    (code) => prisma.idCard.count({ where: { serial: code } }),
  );
}

/**
 * Programme codes are never typed: body, then type, then a serial that counts up only
 * within that pair, so KNEC-DIP-001 and CDAC-DIP-001 can both exist.
 */
export function nextProgramCode(bodyCode: string, typeCode: string, bodyId: string, typeId: string) {
  const prefix = `${bodyCode.toUpperCase()}-${typeCode.toUpperCase()}`;

  return issueCode(
    () => prisma.program.count({ where: { bodyId, typeId } }),
    (sequence) => `${prefix}-${pad(sequence, 3)}`,
    (code) => prisma.program.count({ where: { code } }),
  );
}

/** Every screen whose tables must show the new row after a write. */
export function refresh(...portalPaths: string[]) {
  for (const path of portalPaths) revalidatePath(path);
}

/**
 * One shape for every mutation: run the write, refresh the tables that read it, and if an
 * answer was wrong send the administrator back to the form with a notice instead of a
 * stack trace. The database write never happens in that case.
 */
export async function onSave(
  returnPath: string,
  revalidate: readonly string[],
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    if (error instanceof FieldError) {
      console.error("[FieldError]", returnPath, "::", error.message);
      redirect(`${returnPath}?invalid=1`);
    }
    throw error;
  }

  refresh(...revalidate);
}
