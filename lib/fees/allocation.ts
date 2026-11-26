export type PlanInvoice = {
  id: string;
  invoiceNumber: string;
  status: string;
  dueAt: string | Date | null;
  createdAt: string | Date;
  outstandingCents: number;
};

export type PlannedAllocation = {
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  balanceBeforeCents: number;
  balanceAfterCents: number;
};

export type AllocationPlan =
  | { ok: true; allocations: PlannedAllocation[]; appliedCents: number; outstandingCents: number }
  | { ok: false; reason: "nothing-owed" | "overpay" | "conflict" | "changed"; outstandingCents: number };

export function allocationFingerprint(allocations: PlannedAllocation[]): string {
  return JSON.stringify(allocations.map((row) => ({
    invoiceId: row.invoiceId,
    amountCents: row.amountCents,
    balanceBeforeCents: row.balanceBeforeCents,
    balanceAfterCents: row.balanceAfterCents,
  })));
}

const time = (value: string | Date | null) => (value === null ? Number.MAX_SAFE_INTEGER : new Date(value).getTime());

/** One deterministic planner shared by the server, the wizard preview, and regression tests. */
export function planPaymentAllocation(
  invoices: PlanInvoice[],
  amountCents: number,
  options: { leadInvoiceId?: string; singleInvoiceOnly?: boolean } = {},
): AllocationPlan {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: "conflict", outstandingCents: 0 };
  }

  const eligible = invoices
    .filter((invoice) => invoice.status !== "VOID" && Number.isSafeInteger(invoice.outstandingCents) && invoice.outstandingCents > 0)
    .map((invoice) => ({ invoice, outstandingCents: invoice.outstandingCents }))
    .sort((a, b) =>
      time(a.invoice.dueAt) - time(b.invoice.dueAt) ||
      time(a.invoice.createdAt) - time(b.invoice.createdAt) ||
      a.invoice.id.localeCompare(b.invoice.id),
    );

  let ordered = eligible;
  if (options.leadInvoiceId) {
    const leadIndex = eligible.findIndex((row) => row.invoice.id === options.leadInvoiceId);
    if (leadIndex < 0) {
      return {
        ok: false,
        reason: "conflict",
        outstandingCents: eligible.reduce((sum, row) => sum + row.outstandingCents, 0),
      };
    }
    ordered = [eligible[leadIndex], ...eligible.filter((_, index) => index !== leadIndex)];
  }
  if (options.singleInvoiceOnly) ordered = ordered.slice(0, 1);

  const outstandingCents = ordered.reduce((sum, row) => sum + row.outstandingCents, 0);
  if (outstandingCents === 0) return { ok: false, reason: "nothing-owed", outstandingCents };
  if (amountCents > outstandingCents) return { ok: false, reason: "overpay", outstandingCents };

  let left = amountCents;
  const allocations: PlannedAllocation[] = [];
  for (const row of ordered) {
    if (left === 0) break;
    const portion = Math.min(left, row.outstandingCents);
    allocations.push({
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      amountCents: portion,
      balanceBeforeCents: row.outstandingCents,
      balanceAfterCents: row.outstandingCents - portion,
    });
    left -= portion;
  }

  if (left !== 0 || allocations.reduce((sum, row) => sum + row.amountCents, 0) !== amountCents) {
    return { ok: false, reason: "conflict", outstandingCents };
  }
  return { ok: true, allocations, appliedCents: amountCents, outstandingCents };
}
