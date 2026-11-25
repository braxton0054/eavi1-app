/** A student's enrolment details on A4 — no fee figures. Pure: no clock, no database. */

import { readFileSync } from "node:fs";
import path from "node:path";

import { escapeXml } from "./fee-docs";

const TEMPLATE = path.join(process.cwd(), "lib", "statements", "templates", "eavi-student-details.svg");
let cached: string | null = null;

export type StudentDetails = {
  fullName: string;
  admissionNo: string;
  program: string;
  level: string;
  duration: string;
  intake: string;
  campus: string;
  className: string;
  secondarySchool: string;
  grade: string;
  birthCertificate: string;
  guardianName: string;
  guardianRelationship: string;
  guardianPhone: string;
  guardianAlt: string;
  phone: string;
  email: string;
  address: string;
  preparedOn: string;
  reference: string;
  photoUrl?: string;
  logoUrl?: string;
};

/** Keep a value inside its column; long programme names must not run into the next one. */
function fit(value: string, max: number): string {
  const clean = value.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function buildStudentDetailsSvg(input: StudentDetails): string {
  if (!cached) cached = readFileSync(TEMPLATE, "utf8");
  const values: Record<string, string> = {
    logo_url: input.logoUrl ?? "/logo.png",
    photo_url: input.photoUrl ?? "/logo.png",
    full_name: input.fullName,
    admission_no: input.admissionNo,
    program: fit(input.program, 27),
    level: input.level,
    duration: input.duration,
    intake: input.intake,
    campus: input.campus,
    class_name: input.className,
    secondary_school: input.secondarySchool,
    grade: input.grade,
    birth_certificate: input.birthCertificate,
    guardian_name: input.guardianName,
    guardian_relationship: input.guardianRelationship,
    guardian_phone: input.guardianPhone,
    guardian_alt: input.guardianAlt,
    phone: input.phone,
    email: input.email,
    address: input.address,
    prepared_on: input.preparedOn,
    reference: input.reference,
  };
  return cached.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => escapeXml(values[key] ?? "—"));
}
