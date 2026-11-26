import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { moneyExact, formatDate } from "@/lib/format";
import { sumAmountCents } from "@/lib/fees/money";
import {
  STATEMENT_INVOICE_SELECT,
  STATEMENT_PAYMENT_SELECT,
  statementTransactions,
} from "@/lib/dal/fee-documents";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getStudentOptions } from "@/lib/dal/college";
import type { Column } from "@/lib/content/dashboard";

/**
 * A student's complete financial history: every invoice line (including void contras) and
 * every signed payment, reversal or refund, in chronological order. The printable statement
 * uses the same shared transaction builder, so the screen and PDF cannot tell different stories.
 */

const columns: Column[] = [
  { key: "date", label: "Date" },
  { key: "ref", label: "Reference" },
  { key: "description", label: "Description" },
  { key: "charged", label: "Charged" },
  { key: "paid", label: "Paid" },
  { key: "balance", label: "Balance" },
];

type HistoryRow = {
  id: string;
  date: string;
  ref: string;
  description: string;
  charged: number | null;
  paid: number | null;
  balance: number;
  occurredAt: Date;
  documentNo: string | null;
  documentKind: "INVOICE" | "RECEIPT" | "CREDIT_NOTE" | null;
};

function historyDocumentHref(row: HistoryRow) {
  if (!row.documentNo) return null;
  const number = encodeURIComponent(row.documentNo);
  if (row.documentKind === "INVOICE") return `/dashboard/accounts/invoice/${number}`;
  if (row.documentKind === "RECEIPT" || row.documentKind === "CREDIT_NOTE") {
    return `/dashboard/accounts/receipt/${number}`;
  }
  return null;
}

export default async function PaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ studentId?: string; year?: string }>;
}) {
  const scope = await requireCollegeAdmin();
  const { studentId, year } = await searchParams;

  const studentOptions = await getStudentOptions(scope.campusId);
  const picked = studentId
    ? await prisma.studentProfile.findFirst({
        where: {
          id: studentId,
          ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
        },
        select: {
          id: true,
          admissionNo: true,
          campus: { select: { name: true } },
          user: { select: { fullName: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              enrolledAt: true,
              program: { select: { name: true } },
              period: { select: { name: true } },
            },
          },
        },
      })
    : null;

  let rows: HistoryRow[] = [];
  let billedCents = 0;
  let paidCents = 0;

  if (picked) {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          studentId: picked.id,
          ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: STATEMENT_INVOICE_SELECT,
      }),
      prisma.payment.findMany({
        where: {
          studentId: picked.id,
          ...(scope.campusId === null ? {} : { invoice: { campusId: scope.campusId } }),
        },
        orderBy: [{ paidAt: "asc" }, { id: "asc" }],
        select: STATEMENT_PAYMENT_SELECT,
      }),
    ]);

    const transactions = statementTransactions(invoices, payments);
    billedCents = sumAmountCents(transactions.map((tx) => ({ amount: tx.charged ?? 0 })));
    paidCents = sumAmountCents(transactions.map((tx) => ({ amount: tx.paid ?? 0 })));

    let runningCents = 0;
    rows = transactions.map((tx) => {
      runningCents += (tx.chargedCents ?? 0) - (tx.paidCents ?? 0);
      return {
        id: tx.id,
        date: tx.date,
        ref: tx.ref,
        description: tx.description,
        charged: tx.charged,
        paid: tx.paid,
        balance: runningCents / 100,
        occurredAt: tx.occurredAt,
        documentNo: tx.documentNo,
        documentKind: tx.documentKind,
      };
    });

    // Filtering never restarts the running balance: a year view still shows the account
    // position after each transaction. Summary cards above remain whole-account totals.
    if (year) rows = rows.filter((row) => String(row.occurredAt.getFullYear()) === year);
  }

  const balanceCents = billedCents - paidCents;
  const creditDue = balanceCents < 0;
  const tableRows = rows.map((row) => ({
    id: row.id,
    href: historyDocumentHref(row),
    values: {
      date: row.date,
      ref: row.ref,
      description: row.description,
      charged: row.charged === null ? "" : moneyExact(row.charged),
      paid: row.paid === null ? "" : moneyExact(row.paid),
      balance: moneyExact(row.balance),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment history"
        description="Every invoice line, void correction, payment, reversal and refund on a student's account."
      />

      <Panel title="Choose a student">
        <form action="/dashboard/accounts/history" method="get" className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-64 flex-1">
            <SearchableSelect
              id="history-student"
              name="studentId"
              options={studentOptions}
              defaultValue={studentId}
              placeholder="Search by name or admission number"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-5 text-sm font-medium text-eavi-on-bg hover:bg-eavi-muted active:bg-eavi-muted"
          >
            Show history
          </button>
        </form>
      </Panel>

      {!picked ? (
        <EmptyState
          title="Pick a student"
          body="Their complete financial history — every invoice line, signed payment and correction, the running balance and the mini-statement — shows here."
          icon="accounts"
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold">{picked.user.fullName}</p>
              <p className="text-sm text-eavi-muted-text">
                {picked.admissionNo} · {picked.enrollments[0]?.program.name ?? "—"} ·{" "}
                {picked.enrollments[0]?.period.name ?? "—"} · {picked.campus.name}
              </p>
            </div>
            <a
              href={`/dashboard/accounts/statement/${picked.id}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
            >
              Download mini-statement (PDF)
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-3" role="group" aria-label="Whole-account totals">
            <Panel>
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">Total charged</p>
              <p className="px-4 pb-4 text-2xl font-semibold tabular-nums">{moneyExact(billedCents / 100)}</p>
            </Panel>
            <Panel>
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">Net paid</p>
              <p className="px-4 pb-4 text-2xl font-semibold tabular-nums">{moneyExact(paidCents / 100)}</p>
            </Panel>
            <Panel>
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">
                {creditDue ? "Credit due" : "Outstanding"}
              </p>
              <p className="px-4 pb-2 text-2xl font-semibold tabular-nums">
                {moneyExact(Math.abs(balanceCents) / 100)}
              </p>
              {creditDue ? (
                <p className="px-4 pb-4 text-xs text-eavi-muted-text">This account has a negative balance.</p>
              ) : null}
            </Panel>
          </div>

          <Panel title="Ledger">
            {tableRows.length === 0 ? (
              <EmptyState
                title={year ? `No transactions in ${year}` : "Nothing recorded yet"}
                body={year ? "Choose another year or show the complete account history." : "Invoice lines, payments and corrections appear here the moment they exist."}
                icon="accounts"
              />
            ) : (
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
                  <caption className="sr-only">Chronological fee history for {picked.user.fullName}</caption>
                  <thead>
                    <tr className="border-b border-eavi-border">
                      {columns.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text"
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} className="border-b border-eavi-border">
                        <td className="px-3 py-2">{String(row.values.date)}</td>
                        <td className="px-3 py-2">
                          {row.href ? (
                            <Link
                              href={row.href}
                              className="inline-flex min-h-11 items-center text-eavi-primary-text underline-offset-4 hover:underline"
                              aria-label={`Open ${row.values.ref} document`}
                            >
                              {String(row.values.ref)}
                            </Link>
                          ) : (
                            String(row.values.ref)
                          )}
                        </td>
                        <td className="px-3 py-2">{String(row.values.description)}</td>
                        <td className="px-3 py-2 tabular-nums">{String(row.values.charged)}</td>
                        <td className="px-3 py-2 tabular-nums">{String(row.values.paid)}</td>
                        <td className="px-3 py-2 tabular-nums">{String(row.values.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {picked.enrollments[0] ? (
            <p className="text-xs text-eavi-muted-text">
              Student since {formatDate(picked.enrollments[0].enrolledAt)}. Status:{" "}
              <StatusChip tone="success">Enrolled</StatusChip>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
