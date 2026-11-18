import { createTutor, approveTutor } from "@/lib/actions/college/tutors";
import { getCampusOptions, getProgramOptions, getTutors } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { ListFilters } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import type { Column } from "@/lib/content/dashboard";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.tutors;

/** The account behind a tutor decides whether they can sign in yet. */
const accountTone: Record<string, ChipTone> = {
  ACTIVE: "success",
  PENDING: "warning",
  DISABLED: "neutral",
};

export default async function TutorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; invalid?: string }>;
}) {
  const { q, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [tutors, programOptions, campusOptions] = await Promise.all([
    getTutors({ q }),
    getProgramOptions(scope.campusId),
    getCampusOptions(),
  ]);

  // A campus admin is pinned to their own campus; the field stays visible so the form reads
  // the same for everyone, but only the campus they may write to is offered.
  const campuses =
    scope.campusId === null
      ? campusOptions
      : campusOptions.filter((option) => Number(option.value) === scope.campusId);

  const options: OptionSets = { programs: programOptions, campuses };

  const columns: Column[] = [...copy.columns, { key: "actions", label: common.actions }];

  const rows: Row[] = tutors.map((tutor) => ({
    id: tutor.id,
    cells: {
      staffNo: tutor.staffNo,
      fullName: tutor.user.fullName,
      contact: (
        <span className="flex flex-col">
          <span>{tutor.user.email}</span>
          {tutor.user.phone ? (
            <span className="text-xs text-eavi-muted-text">{tutor.user.phone}</span>
          ) : null}
        </span>
      ),
      department: tutor.department ?? common.notSet,
      programs:
        tutor.programs.length > 0
          ? tutor.programs.map((program) => program.code).join(", ")
          : common.none,
      load: String(tutor.weeklyHours),
      status: (
        <StatusChip tone={accountTone[tutor.user.status] ?? "neutral"}>
          {labels.userStatus[tutor.user.status]}
        </StatusChip>
      ),
      actions:
        tutor.user.status === "PENDING" ? (
          <RowForm
            id={`tutor-${tutor.id}-approve`}
            button={copy.status.approve}
            fields={[]}
            hidden={{ tutorId: tutor.id }}
            action={approveTutor}
            submitLabel={copy.status.approve}
          />
        ) : null,
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-tutor"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={options}
        action={createTutor}
        submitLabel={common.create}
      />

      <Panel title={copy.title}>
        <div className="p-4">
          <ListFilters basePath="/dashboard/tutors" q={q} searchLabel={copy.searchLabel} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="tutors" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={copy.title} />
        )}
      </Panel>
    </div>
  );
}
