import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { ensureDocument } from "@/lib/documents/service";
import type { DocumentKind } from "@/lib/documents/types";

/**
 * One-off, idempotent backfill for records that predate the saved-document service.
 *
 * Nothing is duplicated: `ensureDocument` upserts by (kind, scopeKey) and returns the
 * saved row when it exists. Safe to run on every deploy or by hand on the VPS.
 */
async function main() {
  const [cards, students, invoices, receipts, plans] = await Promise.all([
    prisma.idCard.findMany({ select: { id: true } }),
    prisma.studentProfile.findMany({ select: { id: true } }),
    prisma.invoice.findMany({ select: { id: true } }),
    prisma.receipt.findMany({ select: { number: true } }),
    prisma.programFeePlan.findMany({ where: { isActive: true }, select: { programId: true } }),
  ]);

  const jobs: Array<{ kind: DocumentKind; scopeKey: string }> = [
    ...cards.map((row) => ({ kind: "ID_CARD" as const, scopeKey: row.id })),
    ...students.map((row) => ({ kind: "STUDENT_PROFILE" as const, scopeKey: row.id })),
    ...invoices.map((row) => ({ kind: "INVOICE" as const, scopeKey: row.id })),
    ...[...new Set(receipts.map((row) => row.number))].map((key) => ({
      kind: "RECEIPT" as const,
      scopeKey: key,
    })),
    ...[...new Set(plans.map((row) => row.programId))].map((key) => ({
      kind: "FEE_STRUCTURE" as const,
      scopeKey: key,
    })),
  ];

  let saved = 0;
  // Render sequentially: each document passes through the same heavy image pipeline, and a
  // deploy has no deadline that is worth exhausting the database or the object store.
  for (const job of jobs) {
    if (await ensureDocument(job.kind, job.scopeKey)) saved += 1;
  }

  console.log(`documents backfill: ${saved} of ${jobs.length} saved rows ready`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
