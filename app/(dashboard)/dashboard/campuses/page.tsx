import { createCampus, updateCampus } from "@/lib/actions/college/campuses";
import { getCampusRegister } from "@/lib/dal/admin";
import { requireSuperAdmin } from "@/lib/session";
import { common, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.campuses;

export default async function CampusesPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  await requireSuperAdmin();

  const campuses = await getCampusRegister();

  const rows: Row[] = campuses.map((campus) => ({
    id: String(campus.id),
    cells: {
      code: campus.code,
      name: campus.name,
      place: campus.place,
      phone: campus.phone ?? common.notSet,
      applicants: (
        <StatusChip tone={campus.takesApplicants ? "success" : "neutral"}>
          {campus.takesApplicants ? copy.yes : copy.no}
        </StatusChip>
      ),
      students: String(campus._count.students),
      tutors: String(campus._count.tutors),
      actions: (
        <RowForm
          id={`campus-${campus.id}-edit`}
          button={copy.edit.button}
          fields={copy.edit.fields}
          values={{
            name: campus.name,
            place: campus.place,
            phone: campus.phone ?? undefined,
            takesApplicants: campus.takesApplicants ? "yes" : undefined,
          }}
          hidden={{ campusId: String(campus.id) }}
          action={updateCampus}
          submitLabel={common.save}
          wide
        />
      ),
    },
  }));

  const columns: Column[] = copy.columns;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-campus"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        action={createCampus}
        submitLabel={common.create}
      />

      <Panel title={copy.heading}>
        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="programs" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={copy.heading} />
        )}
      </Panel>
    </div>
  );
}
