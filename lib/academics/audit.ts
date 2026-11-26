/**
 * An append-only record of the changes that matter.
 *
 * Class merges, placements and credit decisions all move a student's academic record, so each
 * one leaves a row here with who did it and what changed. Nothing in this module updates or
 * deletes: history is only ever added to.
 */

import { prisma } from "@/lib/prisma";

export type AuditEntry = {
  campusId?: number | null;
  actorId?: string | null;
  actorEmail?: string | null;
  /** Dotted name so the log can be filtered by area, e.g. "class.merge". */
  action: string;
  entityType: "class" | "enrollment" | "student" | "card" | "application" | "user";
  entityId: string;
  detail?: Record<string, unknown>;
};

/** Accepts the transaction client so an audit row lands in the same commit as its change. */
type Client = { auditLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } };

export async function recordAudit(entry: AuditEntry, client: Client = prisma as unknown as Client) {
  await client.auditLog.create({
    data: {
      campusId: entry.campusId ?? null,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      detail: entry.detail ? JSON.stringify(entry.detail) : null,
    },
  });
}

/** Reads the trail for one record, newest first. */
export async function listAudit(entityType: string, entityId: string, take = 20) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
