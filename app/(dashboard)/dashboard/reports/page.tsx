import { getReports } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { Bar, EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { count, formatDate, money, percent } from "@/lib/format";


const copy = pages.reports;

const applicationTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "info",
  REJECTED: "danger",
  WITHDRAWN: "danger",
};

const cardTone: Record<string, ChipTone> = {
  PENDING: "warning",
  PRINTING: "warning",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "neutral",
};

/** Zero denominators would make a bar meaningless; a flat track is the honest answer. */
function safeRatio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * The chart: one CSS bar per table row, in the same order as the rows above it.
 * The aria-label states the value in words, so the bar never carries meaning alone.
 */
function BarList({ bars }: { bars: { id: string; caption: string; value: string; ratio: number }[] }) {
  return (
    <div className="space-y-2 border-t border-eavi-border p-5">
      {bars.map((bar) => (
        <div key={bar.id} className="flex items-center gap-3">
          <span className="w-36 shrink-0 truncate text-xs text-eavi-muted-text">{bar.caption}</span>
          <span className="w-16 shrink-0 text-right text-xs tabular-nums">{bar.value}</span>
          <div className="min-w-0 flex-1">
            <Bar ratio={bar.ratio} label={`${bar.caption}: ${bar.value}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  const reports = await getReports();

  // Built after the cookie-backed read, so this page is already dynamic.
  const now = new Date();

  const totalApplications = reports.applications.reduce((sum, row) => sum + row.count, 0);
  const largestEnrollment = Math.max(0, ...reports.enrollments.map((row) => row.count));
  const largestLoad = Math.max(0, ...reports.tutors.map((row) => row.hours));

  const { billed, collected, outstanding } = reports.fees;
  const feesEmpty = billed === 0 && collected === 0;

  const applicationRows: Row[] = reports.applications.map((row) => {
    const statusLabel = labels.applicationStatus[row.status];
    return {
      id: row.status,
      cells: {
        status: <StatusChip tone={applicationTone[row.status] ?? "neutral"}>{statusLabel}</StatusChip>,
        count: count(row.count),
        share: percent(row.count, totalApplications),
      },
    };
  });

  const applicationBars = reports.applications.map((row) => ({
    id: row.status,
    caption: labels.applicationStatus[row.status],
    value: count(row.count),
    ratio: safeRatio(row.count, totalApplications),
  }));

  const enrollmentRows: Row[] = reports.enrollments.map((row) => ({
    id: row.name,
    cells: {
      program: row.name,
      level: (
        <StatusChip tone="neutral">
          {row.level ? labels.programLevel[row.level] : common.notSet}
        </StatusChip>
      ),
      count: count(row.count),
    },
  }));

  const enrollmentBars = reports.enrollments.map((row) => ({
    id: row.name,
    caption: row.name,
    value: count(row.count),
    ratio: safeRatio(row.count, largestEnrollment),
  }));

  const feeLines = [
    { label: copy.blocks.fees.lines.billed, value: money(billed), ratio: safeRatio(billed, billed) },
    { label: copy.blocks.fees.lines.collected, value: money(collected), ratio: safeRatio(collected, billed) },
    { label: copy.blocks.fees.lines.outstanding, value: money(outstanding), ratio: safeRatio(outstanding, billed) },
    {
      label: copy.blocks.fees.lines.collectionRate,
      value: percent(collected, billed),
      ratio: safeRatio(collected, billed),
    },
  ];

  const debtRows: Row[] = reports.debts.map((row) => ({
    id: row.admissionNo,
    cells: {
      student: row.student,
      admissionNo: row.admissionNo,
      balance: <span className="text-eavi-destructive">{money(row.balance)}</span>,
      invoices: String(row.invoices),
    },
  }));

  const resultRows: Row[] = reports.results.map((row, index) => ({
    id: `${row.title}-${row.program}-${index}`,
    cells: {
      exam: `${row.title} · ${row.program}`,
      entered: String(row.entered),
      average: row.average === null ? common.notSet : percent(row.average, 100),
      published: String(row.published),
    },
  }));

  const tutorRows: Row[] = reports.tutors.map((row, index) => ({
    id: `${row.name}-${index}`,
    cells: {
      tutor: row.name,
      slots: String(row.slots),
      hours: String(row.hours),
    },
  }));

  const tutorBars = reports.tutors.map((row, index) => ({
    id: `${row.name}-${index}`,
    caption: row.name,
    value: String(row.hours),
    ratio: safeRatio(row.hours, largestLoad),
  }));

  const cardRows: Row[] = reports.cards.map((row) => ({
    id: row.status,
    cells: {
      status: <StatusChip tone={cardTone[row.status] ?? "neutral"}>{labels.cardStatus[row.status]}</StatusChip>,
      count: count(row.count),
    },
  }));

  const blocks = copy.blocks;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        meta={<p className="mt-1 text-xs text-eavi-muted-text">{copy.generated(formatDate(now))}</p>}
      />

      <Panel title={blocks.admissions.title}>
        {applicationRows.length === 0 ? (
          <EmptyState body={blocks.admissions.empty} icon="applications" />
        ) : (
          <>
            <DataTable columns={blocks.admissions.columns} rows={applicationRows} caption={blocks.admissions.title} />
            <BarList bars={applicationBars} />
          </>
        )}
      </Panel>

      <Panel title={blocks.enrollment.title}>
        {enrollmentRows.length === 0 ? (
          <EmptyState body={blocks.enrollment.empty} icon="enrollments" />
        ) : (
          <>
            <DataTable columns={blocks.enrollment.columns} rows={enrollmentRows} caption={blocks.enrollment.title} />
            <BarList bars={enrollmentBars} />
          </>
        )}
      </Panel>

      <Panel title={blocks.fees.title}>
        {feesEmpty ? (
          <EmptyState body={blocks.fees.empty} icon="accounts" />
        ) : (
          <div className="space-y-4 p-5">
            {feeLines.map((line) => (
              <div key={line.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-eavi-muted-text">{line.label}</span>
                  <span className="text-sm font-semibold tabular-nums">{line.value}</span>
                </div>
                <Bar ratio={line.ratio} label={`${line.label}: ${line.value}`} />
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={blocks.debt.title}>
        {debtRows.length === 0 ? (
          <EmptyState body={blocks.debt.empty} icon="accounts" />
        ) : (
          <DataTable columns={blocks.debt.columns} rows={debtRows} caption={blocks.debt.title} />
        )}
      </Panel>

      <Panel title={blocks.results.title}>
        {resultRows.length === 0 ? (
          <EmptyState body={blocks.results.empty} icon="exams" />
        ) : (
          <DataTable columns={blocks.results.columns} rows={resultRows} caption={blocks.results.title} />
        )}
      </Panel>

      <Panel title={blocks.tutors.title}>
        {tutorRows.length === 0 ? (
          <EmptyState body={blocks.tutors.empty} icon="tutors" />
        ) : (
          <>
            <DataTable columns={blocks.tutors.columns} rows={tutorRows} caption={blocks.tutors.title} />
            <BarList bars={tutorBars} />
          </>
        )}
      </Panel>

      <Panel title={blocks.cards.title}>
        {cardRows.length === 0 ? (
          <EmptyState body={blocks.cards.empty} icon="cards" />
        ) : (
          <DataTable columns={blocks.cards.columns} rows={cardRows} caption={blocks.cards.title} />
        )}
      </Panel>
    </div>
  );
}