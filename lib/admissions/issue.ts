import { createHash, randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { nextApplicationReference } from "@/lib/actions/college/_shared";

const VALID_DAYS = 30;
const verificationToken = () => randomBytes(24).toString("base64url");
const downloadToken = () => randomBytes(24).toString("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type IssuedLetter = {
  applicationId: string;
  reference: string;
  verifyToken: string;
  /** Plaintext private download capability, returned once and never stored. */
  downloadToken: string;
  expiresAt: Date;
};

/**
 * Issues an official letter only after an authenticated officer has approved the application
 * and attested that the applicant controls the supplied contact. Public routes never call this.
 */
export async function issueApprovedLetter(
  tx: Prisma.TransactionClient,
  applicationId: string,
  actor: { id: string; email: string },
): Promise<IssuedLetter | null> {
  const application = await tx.application.findUnique({
    where: { id: applicationId },
    include: {
      program: { select: { admissionRequirements: true, feeStructureUrl: true, bursaryFormUrl: true } },
      studentProfile: { select: { id: true } },
    },
  });
  if (
    !application ||
    application.status !== "APPROVED" ||
    application.contactVerifiedAt === null ||
    application.studentProfile
  ) return null;

  const verifyToken = verificationToken();
  const privateToken = downloadToken();
  const expiresAt = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000);
  const snapshot = {
    reference: application.reference,
    verifyToken,
    downloadTokenHash: hashToken(privateToken),
    downloadTokenExpiresAt: expiresAt,
    applicationId,
    programId: application.programId,
    campusId: application.campusId,
    printedName: application.fullName,
    feeStructureUrl: application.program.feeStructureUrl,
    bursaryFormUrl: application.program.bursaryFormUrl,
    requirements: application.program.admissionRequirements,
    expiresAt,
    issuedAt: new Date(),
    issuedById: actor.id,
    issuedByEmail: actor.email,
    revokedAt: null,
    revokeReason: null,
  };

  await tx.offerLetter.upsert({
    where: { applicationId },
    create: snapshot,
    update: snapshot,
  });

  return { applicationId, reference: application.reference, verifyToken, downloadToken: privateToken, expiresAt };
}

/** Private PDF authority is separate from the public QR verification token. */
export async function letterForDownload(reference: string, token: string) {
  const now = new Date();
  return prisma.offerLetter.findFirst({
    where: {
      reference: reference.toUpperCase(),
      downloadTokenHash: hashToken(token),
      downloadTokenExpiresAt: { gt: now },
      revokedAt: null,
      application: { status: "APPROVED", contactVerifiedAt: { not: null } },
    },
    select: {
      reference: true,
      verifyToken: true,
      printedName: true,
      requirements: true,
      feeStructureUrl: true,
      bursaryFormUrl: true,
      expiresAt: true,
      issuedAt: true,
      program: { select: { id: true, name: true, code: true } },
      application: { select: { campus: { select: { name: true } }, createdAt: true, programId: true } },
    },
  });
}

/** Authenticated office download: review state and issuer are already enforced by the DAL. */
export async function approvedLetterForOffice(applicationId: string) {
  return prisma.offerLetter.findFirst({
    where: {
      applicationId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      application: { status: "APPROVED", contactVerifiedAt: { not: null } },
    },
    select: {
      reference: true,
      printedName: true,
      requirements: true,
      feeStructureUrl: true,
      bursaryFormUrl: true,
      expiresAt: true,
      issuedAt: true,
      verifyToken: true,
      program: { select: { id: true, name: true, code: true } },
      application: { select: { campus: { select: { name: true } }, createdAt: true, programId: true } },
    },
  });
}

export { nextApplicationReference };
