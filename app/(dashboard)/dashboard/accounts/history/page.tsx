import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { money, formatDate } from "@/lib/format";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { getStudentOptions } from "@/lib/dal/college";
import type { Column } from "@/lib/content/dashboard";

/**
 * A student's complete payment history, from their admission to today: every charge and
 * every payment in chronological order, the running balance included, and the whole
 * mini-statement one click away. Every figure is read from the ledger's own rows —
 * nothing here is a maintained summary that can drift.
 */

const tone: Record<string, ChipTone> = {
  OPEN: "warning",
  PARTIAL: "info",
  PAID: "success",
  VOID: "neutral",
};

const columns: Column[] = [
  { key: "date", label: "Date" },
  { key: "ref", label: "Reference" },
  { key: "description", label: "Description" },
  { key: "charged", label: "Charged" },
  { key: "paid", label: "Paid" },
  { key: "balance", label: "Balance" },
];

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

  let rows: Array<{
    id: string;
    date: string;
    ref: string;
    description: string;
    charged: number | null;
    paid: number | null;
    balance: number;
  }> = [];
  let billed = 0;
  let paid = 0;

  if (picked) {
    const [invoices, payments] = await Promise.all([
      prisma.invoice.findMany({
        where: { studentId: picked.id, status: { not: "VOID" } },
        orderBy: [{ periodYear: "asc" }, { periodSemester: "asc" }, { dueAt: "asc" }],
        select: { number: true, dueAt: true, periodYear: true, periodSemester: true, lines: { select: { amount: true } } },
      }),
      prisma.payment.findMany({
        where: { studentId: picked.id },
        orderBy: { paidAt: "asc" },
        select: { receiptNo: true, reference: true, method: true, paidAt: true, amount: true },
      }),
    ]);

    type Entry = { at: number; date: string; ref: string; description: string; charged: number | null; paid: number | null };
    const entries: Entry[] = [
      ...invoices.map((invoice) => ({
        at: (invoice.dueAt ?? new Date(0)).getTime(),
        date: formatDate(invoice.dueAt ?? new Date(0)),
        ref: invoice.number,
        description:
          invoice.periodYear && invoice.periodSemester
            ? `Fees — Year ${invoice.periodYear}, Semester ${invoice.periodSemester}`
            : "Fees",
        charged: invoice.lines.reduce((sum, line) => sum + Number(line.amount.toString()), 0),
        paid: null,
      })),
      ...payments.map((payment) => ({
        at: payment.paidAt.getTime(),
        date: formatDate(payment.paidAt),
        ref: payment.receiptNo ?? payment.reference ?? "—",
        description: `Payment${payment.method ? ` · ${payment.method}` : ""}`,
        charged: null,
        paid: Number(payment.amount.toString()),
      })),
    ].sort((a, b) => a.at - b.at);

    billed = entries.reduce((sum, e) => sum + (e.charged ?? 0), 0);
    paid = entries.reduce((sum, e) => sum + (e.paid ?? 0), 0);

    let running = 0;
    rows = entries.map((e) => {
      running += (e.charged ?? 0) - (e.paid ?? 0);
      return { id: `${e.ref}-${e.at}`, date: e.date, ref: e.ref, description: e.description, charged: e.charged, paid: e.paid, balance: running };
    });

    // The year filter, when one is chosen: the rows of that academic year only.
    if (year) {
      rows = rows.filter((row) => row.date.includes(year));
    }
  }

  const tableRows = rows.map((row) => ({
    id: row.id,
    values: {
      date: row.date,
      ref: row.ref,
      description: row.description,
      charged: row.charged === null ? "" : money(row.charged),
      paid: row.paid === null ? "" : money(row.paid),
      balance: money(row.balance),
    },
  }));

  const statementNo = picked ? `FS-${picked.admissionNo.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()}` : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment history"
        description="Every charge and every payment on a student's ledger, from admission to today."
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
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-5 text-sm font-medium text-eavi-on-bg hover:bg-eavi-muted"
          >
            Show history
          </button>
        </form>
      </Panel>

      {!picked ? (
        <EmptyState
          title="Pick a student"
          body="Their complete financial history — every charge, every payment, the running balance and the mini-statement — shows here."
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

          <div className="grid gap-4 sm:grid-cols-3">
            <Panel title="">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">Total charged</p>
              <p className="px-4 pb-4 text-2xl font-semibold tabular-nums">{money(billed)}</p>
            </Panel>
            <Panel title="">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">Total paid</p>
              <p className="px-4 pb-4 text-2xl font-semibold tabular-nums">{money(paid)}</p>
            </Panel>
            <Panel title="">
              <p className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-eavi-muted-text">Outstanding</p>
              <p className="px-4 pb-4 text-2xl font-semibold tabular-nums">{money(Math.max(0, billed - paid))}</p>
            </Panel>
          </div>

          <Panel title="Ledger">
            {tableRows.length === 0 ? (
              <EmptyState title="Nothing recorded yet" body="Charges and payments appear here the moment they exist." icon="accounts" />
            ) : (
              <div className="overflow-x-auto p-4">
                <table className="w-full min-w-[40rem] border-collapse text-sm">
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
                        <td className="px-3 py-2">{String(row.values.ref)}</td>
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
