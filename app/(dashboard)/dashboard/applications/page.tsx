import { createApplication } from "@/lib/actions/college/applications";
import { clearReportingDate, saveReportingDate } from "@/lib/actions/college/reporting";
import { getApplications, getProgramOptions, getReportingDates } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount, StepLink } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate, toDateInput } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.applications;
const dates = copy.dateSetting;

/** A rejected or withdrawn application is closed; the rest are still with the office. */
const applicationTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "info",
  REJECTED: "danger",
  WITHDRAWN: "danger",
};

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    ryear?: string;
    campus?: string;
    invalid?: string;
  }>;
}) {
  const { q, status, page, ryear, campus, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, programOptions, view] = await Promise.all([
    getApplications({ q, status, page: Number(page) || 1 }),
    getProgramOptions(scope.campusId),
    getReportingDates(ryear, campus),
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
          <span>{application.phone}</span>
          {application.email ? (
            <span className="text-xs text-eavi-muted-text">{application.email}</span>
          ) : null}
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

  /* ------------------------------------------------------- application dates */

  const collegeAdmin = view.campuses.length > 0;

  // Stepping the year must not drop the list filters the administrator is working with.
  const filter = new URLSearchParams();
  if (q) filter.set("q", q);
  if (status) filter.set("status", status);
  if (page) filter.set("page", page);
  if (collegeAdmin) filter.set("campus", String(view.campusId));

  const keep = Object.fromEntries(filter.entries());
  const yearLink = (nextYear: number) =>
    `/dashboard/applications?ryear=${nextYear}${filter.size ? `&${filter.toString()}` : ""}`;

  // Each month's form is addressed to that slot, never to a date the administrator typed.
  const monthHidden = (month: number, id?: string) => ({
    ...(collegeAdmin ? { campusId: String(view.campusId) } : {}),
    year: String(view.year),
    month: String(month),
    ...(id ? { reportingId: id } : {}),
  });

  const choiceClass =
    "h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

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

      <Panel title={dates.heading} description={dates.description}>
        <div className="space-y-4 p-4">
          {collegeAdmin ? (
            <nav className="flex flex-wrap items-center gap-2" aria-label={dates.campus.select}>
              {view.campuses.map((choice) => (
                <a
                  key={choice.value}
                  href={`/dashboard/applications?campus=${choice.value}&ryear=${view.year}`}
                  aria-current={Number(choice.value) === view.campusId ? "true" : undefined}
                  className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted aria-[current=true]:bg-eavi-primary-soft"
                >
                  {choice.label}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="text-sm font-semibold">
              {dates.year.heading} {view.year}
            </p>

            <div className="ms-auto flex flex-wrap items-center gap-2">
              <StepLink
                href={view.canPrevious ? yearLink(view.year - 1) : null}
                label={common.previous}
                ariaLabel={dates.year.previous}
              />

              <form action="/dashboard/applications" method="get" className="flex items-center gap-2">
                {Object.entries(keep).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <Label htmlFor="application-year" className="sr-only">
                  {dates.year.select}
                </Label>
                <select
                  id="application-year"
                  name="ryear"
                  defaultValue={String(view.year)}
                  className={choiceClass}
                >
                  {view.years.map((value) => (
                    <option key={value} value={String(value)}>
                      {value}
                    </option>
                  ))}
                </select>
                <Button type="submit">{dates.year.show}</Button>
              </form>

              <StepLink
                href={view.canNext ? yearLink(view.year + 1) : null}
                label={common.next}
                ariaLabel={dates.year.next}
              />
            </div>
          </div>

          {!view.editable ? (
            <Notice
              tone="neutral"
              title={dates.year.closedTitle}
              body={dates.year.closedBody(view.year)}
            />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {view.months.map((entry) => {
              const name = labels.months[entry.month - 1] ?? String(entry.month);
              const canEdit = view.editable && entry.editable;

              return (
                <div
                  key={entry.month}
                  className="flex flex-col gap-2 rounded-xl border border-eavi-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{name}</p>
                    {entry.row ? (
                      <StatusChip tone={entry.reported ? "neutral" : "success"}>
                        {entry.reported ? dates.reported : dates.upcoming}
                      </StatusChip>
                    ) : null}
                  </div>

                  <p className="text-sm">{entry.row ? formatDate(entry.row.date) : dates.notSet}</p>

                  {canEdit ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <RowForm
                        id={`set-date-${entry.month}`}
                        button={entry.row ? dates.change.button : dates.set.button}
                        fields={[dates.set.field]}
                        values={{ date: toDateInput(entry.row?.date) }}
                        hidden={monthHidden(entry.month)}
                        action={saveReportingDate}
                        submitLabel={common.save}
                      />
                      {entry.row ? (
                        <RowForm
                          id={`clear-date-${entry.month}`}
                          button={dates.remove.button}
                          fields={[]}
                          hidden={monthHidden(entry.month, entry.row.id)}
                          action={clearReportingDate}
                          submitLabel={dates.remove.button}
                          tone="danger"
                        />
                      ) : null}
                    </div>
                  ) : entry.row ? (
                    <p className="text-xs text-eavi-muted-text">{dates.passedNote(name)}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
