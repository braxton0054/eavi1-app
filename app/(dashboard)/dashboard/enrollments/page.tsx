import { setEnrollmentStatus } from "@/lib/actions/college/enrollments";
import { getApplications, getEnrollments } from "@/lib/dal/college";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RowForm } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.enrollments;

const enrollmentTone: Record<string, ChipTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  COMPLETED: "info",
  WITHDRAWN: "danger",
};

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string }>;
}) {
  const { q, status, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, apps] = await Promise.all([
    getEnrollments({ q, status, page: Number(page) || 1 }),
    getApplications({ page: 1 }),
  ]);

  const enrolledIds = new Set(
    (await prisma.studentProfile.findMany({ where: { applicationId: { not: null } }, select: { applicationId: true } }))
      .map((r) => r.applicationId as string),
  );
  const availableApps = apps.rows.filter((a) => !enrolledIds.has(a.id)).slice(0, 8);

  const statuses = Object.entries(labels.enrollmentStatus).map(([value, label]) => ({
    value,
    label,
  }));

  const columns: Column[] = [...copy.columns, { key: "actions", label: common.actions }];

  const rows: Row[] = list.rows.map((enrollment) => ({
    id: enrollment.id,
    cells: {
      admissionNo: enrollment.student.admissionNo,
      student: enrollment.student.user.fullName,
      program: `${enrollment.program.name} (${enrollment.program.code})`,
      intake: enrollment.intake ? `${enrollment.intake.name} · ${enrollment.intake.semester.name}` : common.notSet,
      cohort: enrollment.cohort ?? common.notSet,
      status: (
        <StatusChip tone={enrollmentTone[enrollment.status] ?? "neutral"}>
          {labels.enrollmentStatus[enrollment.status]}
        </StatusChip>
      ),
      enrolledAt: formatDate(enrollment.enrolledAt),
      actions: (
        <RowForm
          id={`enrollment-${enrollment.id}-status`}
          button={copy.update.title}
          fields={[copy.update.statusField]}
          values={{ status: enrollment.status }}
          hidden={{ enrollmentId: enrollment.id }}
          action={setEnrollmentStatus}
          submitLabel={common.update}
        />
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description="Find an application to enrol, then manage the students already enrolled below."
        action={
          <a
            href="/dashboard/students/enrol"
            className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
          >
            New enrolment
          </a>
        }
      />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      {/* 1 — pending applications, no search needed: the full search lives on the Applications page */}
      <Panel
        title="1 · Applications waiting to be enrolled"
        description="Start the two-step enrolment form for one of these."
        aside={
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-eavi-primary-soft px-3 py-1 text-xs font-medium text-eavi-primary-text">
              {availableApps.length} pending
            </span>
            <a
              href="/dashboard/applications"
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-xs font-medium text-eavi-primary-text hover:bg-eavi-muted"
            >
              Search all applications →
            </a>
          </span>
        }
      >
        <div className="p-4">
          {availableApps.length === 0 ? (
            <p className="text-sm text-eavi-muted-text">No pending applications. New submissions will appear here once logged.</p>
          ) : (
            <ul className="divide-y divide-eavi-border rounded-xl border border-eavi-border">
              {availableApps.map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{app.fullName}</p>
                    <p className="truncate text-xs text-eavi-muted-text">
                      {app.reference} · {app.program.name} ({app.program.code})
                    </p>
                  </div>
                  <a
                    href={`/dashboard/students/enrol?application=${app.id}`}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
                  >
                    Start enrolment
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      {/* 2 — enrolled students */}
      <Panel title={`2 · Enrolled students`} description={pages.overview.scopeNote(scope.campusName)}>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/enrollments"
            q={q}
            status={status}
            statuses={statuses}
            searchLabel={copy.searchLabel}
          />
          <ResultCount total={list.total} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="enrollments" />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} caption={copy.title} />
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/enrollments"
                page={list.page}
                total={list.total}
                q={q}
                status={status}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
