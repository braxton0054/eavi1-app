/** Reads a document's source rows into a plain, deterministic snapshot. */

import { prisma } from "@/lib/prisma";
import { getInvoiceDocument, getReceiptDocument } from "@/lib/dal/fee-documents";
import { feeStructureForProgram } from "@/lib/statements/fee-structure-data";
import { formatDate } from "@/lib/format";

import type { Snapshot } from "./types";

const iso = (value: Date | null | undefined) => (value ? value.toISOString() : null);

/** Every field the ID card face merges, with dates as strings so the hash is stable. */
export async function loadIdCard(cardId: string): Promise<Snapshot | null> {
  const card = await prisma.idCard.findUnique({
    where: { id: cardId },
    select: {
      serial: true,
      status: true,
      verifyToken: true,
      issuedAt: true,
      expiresAt: true,
      createdAt: true,
      campus: { select: { name: true } },
      program: { select: { name: true } },
      student: {
        select: {
          admissionNo: true,
          profilePhotoUrl: true,
          user: { select: { fullName: true, email: true } },
          parentGuardians: { take: 1, select: { fullName: true, phone: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              period: { select: { month: true, year: true } },
              program: { select: { name: true } },
              memberships: {
                where: { leftAt: null },
                take: 1,
                select: { class: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!card) return null;
  const enrollment = card.student.enrollments[0] ?? null;
  return {
    serial: card.serial,
    status: card.status,
    verifyToken: card.verifyToken,
    issuedAt: iso(card.issuedAt),
    expiresAt: iso(card.expiresAt),
    createdAt: iso(card.createdAt),
    campusName: card.campus.name,
    className: enrollment?.memberships[0]?.class.name ?? null,
    programName: card.program?.name ?? null,
    admissionNo: card.student.admissionNo,
    photoUrl: card.student.profilePhotoUrl,
    fullName: card.student.user.fullName,
    email: card.student.user.email,
    guardian: card.student.parentGuardians[0] ?? null,
    period: enrollment?.period ?? null,
    enrollmentProgram: enrollment?.program.name ?? null,
  };
}

/** One invoice's settled figures and student block, by invoice id. */
export async function loadInvoice(invoiceId: string): Promise<Snapshot | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { number: true },
  });
  if (!invoice) return null;
  const document = await getInvoiceDocument(invoice.number, null);
  if (!document) return null;
  return { ...document, receivedBy: "EAVI Accounts Office" };
}

/** All payment rows under one receipt number. */
export async function loadReceipt(receiptNo: string): Promise<Snapshot | null> {
  const document = await getReceiptDocument(receiptNo, null);
  if (!document) return null;
  return { ...document, receivedBy: "EAVI Accounts Office" };
}

/** Everything the student recorded at enrolment. No fee figures reach this snapshot. */
export async function loadStudentProfile(studentId: string): Promise<Snapshot | null> {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      admissionNo: true,
      address: true,
      dateOfBirth: true,
      gender: true,
      nationalId: true,
      primarySchool: true,
      secondarySchool: true,
      admissionCategory: true,
      previousInstitution: true,
      medicalInfo: true,
      hasNoMedicalConditions: true,
      birthCertificateUrl: true,
      primarySchoolDocUrl: true,
      secondarySchoolDocUrl: true,
      admissionDate: true,
      createdAt: true,
      profilePhotoUrl: true,
      user: { select: { fullName: true, email: true, phone: true } },
      campus: { select: { name: true } },
      application: { select: { grade: true } },
      parentGuardians: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: {
          fullName: true,
          relationship: true,
          phone: true,
          altPhone: true,
          email: true,
          occupation: true,
          address: true,
        },
      },
      emergencyContacts: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { fullName: true, relationship: true, phone: true },
      },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { enrolledAt: "desc" },
        select: {
          enrolledAt: true,
          program: { select: { name: true, durationMonths: true, type: { select: { name: true } } } },
          period: { select: { name: true } },
          memberships: {
            where: { leftAt: null },
            take: 1,
            select: { class: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!student) return null;
  const enrollment = student.enrollments[0] ?? null;
  const guardian = student.parentGuardians[0] ?? null;
  // The date on the print is the day the record was made, never the current clock: the
  // same snapshot must always render the same document.
  return {
    fullName: student.user.fullName,
    admissionNo: student.admissionNo,
    program: enrollment?.program.name ?? "—",
    level: enrollment?.program.type.name ?? "—",
    duration: enrollment ? `${enrollment.program.durationMonths} months` : "—",
    intake: enrollment?.period.name ?? "—",
    campus: student.campus.name,
    className: enrollment?.memberships[0]?.class.name ?? "—",
    dateOfBirth: student.dateOfBirth ? formatDate(student.dateOfBirth) : "—",
    gender: student.gender ?? "—",
    nationalId: student.nationalId ?? "—",
    primarySchool: student.primarySchool ?? "—",
    secondarySchool: student.secondarySchool ?? "—",
    grade: student.application?.grade?.replace(/_/g, " ") ?? "—",
    admissionCategory: student.admissionCategory ?? "—",
    previousInstitution: student.previousInstitution ?? "—",
    recordedOn: student.admissionDate
      ? formatDate(student.admissionDate)
      : formatDate(student.createdAt),
    birthCertificate: student.birthCertificateUrl ? "On file" : "Not provided",
    primarySchoolDoc: student.primarySchoolDocUrl ? "On file" : "Not provided",
    secondarySchoolDoc: student.secondarySchoolDocUrl ? "On file" : "Not provided",
    medicalInfo: student.medicalInfo ?? (student.hasNoMedicalConditions ? "No medical conditions declared" : "—"),
    guardianName: guardian?.fullName ?? "—",
    guardianRelationship: guardian?.relationship ?? "—",
    guardianPhone: guardian?.phone ?? "—",
    guardianAlt: guardian?.altPhone ?? "—",
    guardianEmail: guardian?.email ?? "—",
    guardianOccupation: guardian?.occupation ?? "—",
    guardianAddress: guardian?.address ?? "—",
    emergencyName: student.emergencyContacts[0]
      ? `${student.emergencyContacts[0].fullName} (${student.emergencyContacts[0].relationship})`
      : "—",
    emergencyPhone: student.emergencyContacts[0]?.phone ?? "—",
    phone: student.user.phone ?? "—",
    email: student.user.email ?? "—",
    address: student.address ?? "—",
    reference: student.admissionNo,
    photoUrl: student.profilePhotoUrl ?? null,
  };
}

/** The active published plan of one programme, with the cadence that decides its wording. */
export async function loadFeeStructure(programId: string): Promise<Snapshot | null> {
  const document = await feeStructureForProgram(programId);
  return document ? (document.input as unknown as Snapshot) : null;
}
