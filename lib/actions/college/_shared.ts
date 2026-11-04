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

export function nextCardSerial() {
  return issueCode(
    () => prisma.idCard.count(),
    (sequence) => `IDC/${year()}/${pad(sequence, 4)}`,
    (code) => prisma.idCard.count({ where: { serial: code } }),
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
    if (error instanceof FieldError) redirect(`${returnPath}?invalid=1`);
    throw error;
  }

  refresh(...revalidate);
}
