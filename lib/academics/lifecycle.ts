/**
 * The rules that decide whether a programme may be archived or deleted.
 *
 * They live here rather than inline in the action so the same answer can be tested without a
 * session, and so archiving and deleting can never drift apart.
 */

import type { Prisma } from "@/generated/prisma/client";

type Reader = Pick<
  Prisma.TransactionClient,
  "enrollment" | "application" | "exam" | "timetableSlot" | "idCard" | "invoice"
>;

export type LifecycleCounts = {
  activeEnrollments: number;
  /** Enrolments of any status, plus everything else recorded against the programme. */
  dependents: number;
};

export async function lifecycleCounts(client: Reader, programId: string): Promise<LifecycleCounts> {
  const [activeEnrollments, enrollments, applications, exams, slots, cards, invoices, planInvoices] =
    await Promise.all([
      client.enrollment.count({ where: { programId, status: "ACTIVE" } }),
      client.enrollment.count({ where: { programId } }),
      client.application.count({ where: { programId } }),
      client.exam.count({ where: { programId } }),
      client.timetableSlot.count({ where: { programId } }),
      client.idCard.count({ where: { programId } }),
      client.invoice.count({ where: { programId } }),
      client.invoice.count({ where: { feePlan: { programId } } }),
    ]);

  return {
    activeEnrollments,
    dependents: enrollments + applications + exams + slots + cards + invoices + planInvoices,
  };
}

export type LifecycleRefusal = "active" | "history" | null;

/**
 * `active` means students are still studying; `history` means the programme has records that
 * would be lost. Both are refusals to delete, and both point at archiving instead.
 */
export function deletionRefusal(counts: LifecycleCounts): LifecycleRefusal {
  if (counts.activeEnrollments > 0) return "active";
  if (counts.dependents > 0) return "history";
  return null;
}

/** Archiving stops new admissions, so it is refused only while someone is still studying. */
export function archiveRefusal(counts: LifecycleCounts): LifecycleRefusal {
  return counts.activeEnrollments > 0 ? "active" : null;
}
