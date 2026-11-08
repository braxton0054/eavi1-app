import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { nextApplicationReference } from "@/lib/actions/college/_shared";

/**
 * The letter an applicant receives the moment they submit.
 *
 * There is no approval step, so the letter must not pretend there was one. It is a **record of
 * application**, not an offer of a place: anyone can send the public form with any name, and a
 * document that says "you have been admitted", downloadable without anyone checking, would be both
 * untrue and trivially forged. What it does is tie a person to a reference the college can confirm,
 * and give the office something to check on the day they enrol.
 *
 * Words are chosen for that reason: "Acknowledged", "proof that this application was received",
 * never "congratulations" or "we are pleased to offer you admission".
 *
 * The verification link is the whole authority of the document. Without it the letter is a
 * decorated web page; with it, an enrolment officer can see the name, programme and status that our
 * database actually holds.
 */

/** How long the offer to accept stays open. Admissions run monthly, so this is generous on purpose. */
const VALID_DAYS = 30;

/** A token for the verification URL: unguessable, URL-safe, and not derived from the reference. */
function verificationToken(): string {
  return randomBytes(24).toString("base64url");
}

export type IssuedLetter = {
  /** The application the letter belongs to, for building the download URL. */
  applicationId: string;
  reference: string;
  verifyToken: string;
};

/**
 * Records the letter for a freshly created application.
 *
 * Called inside the same flow as the application itself. It is not in a transaction with it
 * because the letter is derived data: if this fails, the application still exists and the office
 * can print the letter later, which is much better than losing a submitted application in order to
 * keep a page numbering tidy.
 */
export async function issueLetterForApplication(applicationId: string): Promise<IssuedLetter | null> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      reference: true,
      fullName: true,
      programId: true,
      campusId: true,
      program: {
        select: { admissionRequirements: true, feeStructureUrl: true, bursaryFormUrl: true },
      },
    },
  });
  if (!application) return null;

  const verifyToken = verificationToken();

  const letter = await prisma.offerLetter.upsert({
    where: { applicationId },
    // Re-submitting must not mint a second token: the one already handed out stays valid.
    create: {
      reference: application.reference,
      verifyToken,
      applicationId,
      programId: application.programId,
      campusId: application.campusId,
      printedName: application.fullName,
      feeStructureUrl: application.program.feeStructureUrl,
      bursaryFormUrl: application.program.bursaryFormUrl,
      requirements: application.program.admissionRequirements,
      expiresAt: new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {},
    select: { verifyToken: true },
  });

  return { applicationId, reference: application.reference, verifyToken: letter.verifyToken };
}

/**
 * Loads what an applicant's letter needs, by reference and token.
 *
 * Both are required. The reference alone is sequential and therefore guessable — `APP/2026/0001`
 * through `APP/2026/9999` — so honouring it on its own would let anyone download anybody's letter,
 * with their name and programme on it.
 */
export async function letterForDownload(reference: string, token: string) {
  return prisma.offerLetter.findFirst({
    where: {
      reference: reference.toUpperCase(),
      verifyToken: token,
      revokedAt: null,
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
      program: { select: { name: true, code: true } },
      application: {
        select: {
          campus: { select: { name: true } },
          createdAt: true,
        },
      },
    },
  });
}

/** Generates a reference for the application row itself; re-exported so callers share one rule. */
export { nextApplicationReference };
