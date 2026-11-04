import { createApplication } from "@/lib/actions/college/applications";
import { getApplications, getProgramOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";

const copy = pages.applications;

/** An approved application is settled; a rejected or withdrawn one is closed against us. */
const applicationTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "info",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "danger",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string }>;
}) {
  const { q, status, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, programOptions] = await Promise.all([
    getApplications({ q, status, page: Number(page) || 1 }),
    getProgramOptions(scope.campusId),
  ]);

  const options: OptionSets = { programs: programOptions };

  const statuses = Object.entries(labels.applicationStatus).map(([value, label]) => ({
    value,
    label,
  }));

  const rows: Row[] = list.rows.map((application) => ({
    id: application.id,
    href: `/dashboard/applications/${application.id}`,
    cells: {
      reference: application.reference,
      fullName: application.fullName,
      contact: (
        <span className="flex flex-col">
          <span>{application.email}</span>
          <span className="text-xs text-eavi-muted-text">{application.phone}</span>
        </span>
      ),
      program: `${application.program.name} (${application.program.code})`,
      status: (
        <StatusChip tone={applicationTone[application.status] ?? "info"}>
          {labels.applicationStatus[application.status]}
        </StatusChip>
      ),
      received: formatDate(application.createdAt),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-application"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={options}
        action={createApplication}
        submitLabel={common.create}
      />

      <Panel title={copy.title} description={pages.overview.scopeNote(scope.campusName)}>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/applications"
            q={q}
            status={status}
            statuses={statuses}
            searchLabel={copy.searchLabel}
          />
          <ResultCount total={list.total} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="applications" />
        ) : (
          <>
            <DataTable columns={copy.columns} rows={rows} caption={copy.title} />
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/applications"
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
