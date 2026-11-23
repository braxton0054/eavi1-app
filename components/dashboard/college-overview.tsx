import Link from "next/link";

import { Columns, Ranked, Ring } from "@/components/dashboard/charts";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate, money } from "@/lib/format";
import { getCollegeOverview } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";

const copy = pages.college;

const statusTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "info",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/**
 * The screen a super admin is shown instead of the campus overview: the same figures the
 * campus offices see, gathered across every campus and set side by side.
 */
export async function CollegeOverview() {
  const { byCampus, totals, applicationsByMonth, enrollmentsByProgramme, recentApplications } =
    await getCollegeOverview();

  const collectedShare = totals.billed === 0 ? 0 : totals.collected / totals.billed;

  const campusRows: Row[] = byCampus.map((campus) => ({
    id: String(campus.id),
    href: `/dashboard/scope?campus=${campus.id}`,
    cells: {
      campus: (
        <span className="block">
          {campus.name}
          <span className="block text-xs text-eavi-muted-text">{campus.place}</span>
        </span>
      ),
      students: String(campus.students),
      applicationsOpen: String(campus.applicationsOpen),
      activeEnrollments: String(campus.activeEnrollments),
      tutors: String(campus.tutors),
      collected: (
        <span className="block">
          {money(campus.collected)} of {money(campus.billed)}
          <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-eavi-muted">
            <span
              className="block h-full rounded-full bg-eavi-fill"
              style={{
                width: `${Math.round((campus.billed === 0 ? 0 : campus.collected / campus.billed) * 100)}%`,
              }}
            />
          </span>
        </span>
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={
          <p className="mt-2 text-xs uppercase tracking-wider text-eavi-muted-text">
            {byCampus.length === 1 ? copy.campusesOne : copy.campusesMany} · {byCampus.length}
          </p>
        }
      />

      {/* One focal figure, the rest compact (LAY-08). */}
      <section aria-label={copy.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2">
          <MetricCard
            label={copy.figures.students}
            value={String(totals.students)}
            icon="students"
            href="/dashboard/students"
            hint={`Across ${byCampus.length} ${byCampus.length === 1 ? copy.campusesOne : copy.campusesMany}`}
          />
        </div>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <MetricCard
            label={copy.figures.applicationsOpen}
            value={String(totals.applicationsOpen)}
            icon="applications"
            tone="attention"
            href="/dashboard/applications"
          />
          <MetricCard
            label={copy.figures.activeEnrollments}
            value={String(totals.activeEnrollments)}
            icon="enrollments"
            href="/dashboard/enrollments"
          />
          <MetricCard
            label={copy.figures.tutors}
            value={String(totals.tutors)}
            icon="tutors"
            href="/dashboard/tutors"
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel title={copy.blocks.applications} description={copy.blocks.applicationsNote} className="lg:col-span-7">
          <div className="p-5">
            <Columns
              series={applicationsByMonth}
              caption={`${copy.blocks.applications}: ${applicationsByMonth.map((month) => `${month.label} ${month.value}`).join(", ")}`}
            />
          </div>
        </Panel>

        <Panel title={copy.blocks.collection} className="lg:col-span-5">
          <div className="flex flex-col gap-5 p-5">
            <Ring
              ratio={collectedShare}
              label={`${money(totals.collected)} of ${money(totals.billed)}`}
              caption={`${copy.figures.collected}: ${money(totals.collected)} of ${money(totals.billed)}`}
            />
            <dl className="flex flex-col gap-2 text-sm">
              {[
                { label: copy.figures.billed, value: totals.billed },
                { label: copy.figures.collected, value: totals.collected },
                { label: copy.figures.outstanding, value: totals.billed - totals.collected },
              ].map((figure) => (
                <div key={figure.label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-eavi-muted-text">{figure.label}</dt>
                  <dd className="whitespace-nowrap font-semibold tabular-nums">{money(figure.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Panel>

        <Panel title={copy.blocks.campuses} className="lg:col-span-12">
          {byCampus.length === 0 ? (
            <EmptyState body={copy.blocks.campusesEmpty} icon="overview" />
          ) : (
            <div className="px-2 py-3 sm:px-4">
              <DataTable columns={copy.columns} rows={campusRows} caption={copy.blocks.campuses} />
            </div>
          )}
        </Panel>

        <Panel title={copy.blocks.programmes} className="lg:col-span-5">
          <div className="p-5">
            {enrollmentsByProgramme.length === 0 ? (
              <EmptyState body={copy.blocks.programmesEmpty} icon="programs" />
            ) : (
              <Ranked series={enrollmentsByProgramme} />
            )}
          </div>
        </Panel>

        <Panel title={copy.blocks.recent} className="lg:col-span-7">
          {recentApplications.length === 0 ? (
            <EmptyState body={copy.blocks.recentEmpty} icon="applications" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {recentApplications.map((application) => (
                <li key={application.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/applications/${application.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {application.fullName}
                    </Link>
                    <p className="text-xs text-eavi-muted-text">
                      {application.reference} · {application.program.code} ·{" "}
                      {application.campus?.name ?? common.notSet}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{formatDate(application.createdAt)}</span>
                    <StatusChip tone={statusTone[application.status] ?? "neutral"}>
                      {labels.applicationStatus[application.status]}
                    </StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
