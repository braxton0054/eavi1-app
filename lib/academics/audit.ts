/**
 * An append-only record of the changes that matter.
 *
 * Class merges, placements and credit decisions all move a student's academic record, so each
 * one leaves a row here with who did it and what changed. Nothing in this module updates or
 * deletes: history is only ever added to.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type AuditEntry = {
  campusId?: number | null;
  actorId?: string | null;
  actorEmail?: string | null;
  /** Dotted name so the log can be filtered by area, e.g. "class.merge". */
  action: string;
  entityType: "class" | "enrollment" | "student" | "card" | "application" | "user" | "invoice" | "payment" | "receipt" | "credit_note";
  entityId: string;
  detail?: Record<string, unknown>;
};

/** Accepts the transaction client so an audit row lands in the same commit as its change. */
type Client = Pick<Prisma.TransactionClient, "auditLog">;

type AuditData = {
  campusId: number | null;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: AuditEntry["entityType"];
  entityId: string;
  detail: string | null;
};

export async function recordAudit(entry: AuditEntry, client: Client = prisma) {
  const data: AuditData = {
    campusId: entry.campusId ?? null,
    actorId: entry.actorId ?? null,
    actorEmail: entry.actorEmail ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    detail: entry.detail ? JSON.stringify(entry.detail) : null,
  };
  await client.auditLog.create({ data });
}

/** Reads the trail for one record, newest first. */
export async function listAudit(entityType: string, entityId: string, take = 20) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take,
  });
}
