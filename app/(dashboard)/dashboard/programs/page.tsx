import Link from "next/link";

import {
  archiveProgram,
  createDepartment,
  createFeeCadence,
  createProgram,
  createProgramBody,
  createProgramType,
  deleteFeeCadence,
  deleteProgram,
  deleteProgramBody,
  deleteProgramType,
  updateFeeCadence,
  updateProgram,
  updateProgramBody,
  updateProgramType,
} from "@/lib/actions/college/programs";
import {
  getDepartmentOptions,
  getDepartments,
  getFeeCadences,
  getProgramBodies,
  getProgramOptions,
  getProgramRegistryOptions,
  getPrograms,
  getProgramTypes,
} from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import type { Column } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { money } from "@/lib/format";

const copy = pages.programs;
const settings = copy.settings;

/** The actions menu and the links inside it, kept in one place for every row. */
const menuToggle =
  "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text [&::-webkit-details-marker]:hidden";
const menuLink =
  "rounded-lg px-3 py-2 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted";

/** The row-level editor takes the same questions as the add form, so the field list is shared. */
const programFields = copy.create.fields;

type Program = Awaited<ReturnType<typeof getPrograms>>[number];

/** Every answer the programme form collects, read back off the row being edited. */
const programValues = (program: Program) => ({
  name: program.name,
  bodyId: program.bodyId,
  typeId: program.typeId,
  departmentId: program.departmentId,
  cadenceId: program.cadenceId,
  structure: program.structure,
  durationMonths: String(program.durationMonths),
  minKcseGrade: program.minKcseGrade,
  description: program.description ?? "",
});

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [rows, departments, departmentOptions, registries, bodies, types, cadences, programOptions] =
    await Promise.all([
      getPrograms({}),
      getDepartments(),
      getDepartmentOptions(),
      getProgramRegistryOptions(),
      getProgramBodies(),
      getProgramTypes(),
      getFeeCadences(),
      getProgramOptions(scope.campusId),
    ]);

  const options: OptionSets = {
    departments: departmentOptions,
    programs: programOptions,
    bodies: registries.bodies,
    programTypes: registries.programTypes,
    feeCadences: registries.feeCadences,
  };

  const programRows: Row[] = rows.map((program) => ({
    id: program.id,
    cells: {
      code: program.code,
      name: program.name,
      body: program.body.name,
      type: <StatusChip tone="neutral">{program.type.name}</StatusChip>,
      structure: labels.programStructure[program.structure],
      department: program.department.name,
      duration: copy.duration(program.durationMonths),
      minKcseGrade: labels.entryGrade[program.minKcseGrade],
      students: String(program.enrolledCount),
      fees: program.feePlans[0] ? (
        money(program.feePlans[0].totalAmount)
      ) : (
        <Link
          href={`/dashboard/programs/${program.id}/fees`}
          className="font-medium text-eavi-primary-text underline-offset-4 hover:underline"
        >
          {copy.feePlan.setLink}
        </Link>
      ),
      curriculum: documentCell(program.curriculumUrl, copy.curriculum),
      feeStructure: documentCell(program.feeStructureUrl, copy.feeStructure),
      status: program.archivedAt ? (
        <StatusChip tone="neutral">{copy.detail.archived}</StatusChip>
      ) : (
        <StatusChip tone="success">{common.active}</StatusChip>
      ),
      actions: (
        <details className="relative">
          <summary className={menuToggle}>{copy.detail.actions}</summary>
          <div className="mt-2 flex w-56 flex-col gap-1 rounded-xl border border-eavi-border bg-eavi-card p-2 shadow-eavi-card">
            <Link href={`/dashboard/programs/${program.id}`} className={menuLink}>
              {copy.detail.view}
            </Link>
            <Link href={`/dashboard/programs/${program.id}/fees`} className={menuLink}>
              {copy.detail.manageFees}
            </Link>
            <Link href={`/dashboard/programs/${program.id}/units`} className={menuLink}>
              {copy.detail.manageUnits}
            </Link>
            <Link href={`/dashboard/programs/${program.id}/attachment`} className={menuLink}>
              {copy.detail.manageAttachment}
            </Link>

            <div className="border-t border-eavi-border pt-1">
              <RowForm
                id={`edit-program-${program.id}`}
                button={copy.edit.button}
                fields={programFields}
                options={options}
                values={programValues(program)}
                hidden={{ programId: program.id }}
                action={updateProgram}
                submitLabel={common.update}
                wide
              />
            </div>

            {program.archivedAt ? null : (
              <RowForm
                id={`archive-program-${program.id}`}
                button={copy.archive.button}
                fields={[
                  { name: "reason", label: copy.archive.reason, type: "text", wide: true },
                ]}
                hidden={{ programId: program.id }}
                action={archiveProgram}
                submitLabel={copy.archive.button}
              />
            )}

            <RowForm
              id={`delete-program-${program.id}`}
              button={copy.remove.button}
              fields={[]}
              hidden={{ programId: program.id }}
              action={deleteProgram}
              submitLabel={copy.remove.button}
              tone="danger"
            />
          </div>
        </details>
      ),
    },
  }));

  // A body or a type is only ever retired by taking its programmes away, so the count is shown.
  const codedRows = (
    items: { id: string; code: string; name: string; programs: { id: string }[] }[],
    section: "bodies" | "types",
  ): Row[] =>
    items.map((item) => {
      const edit = settings[section].edit;
      const remove = settings[section].remove;
      const hidden: Record<string, string> =
        section === "bodies" ? { bodyId: item.id } : { typeId: item.id };
      const action = section === "bodies" ? updateProgramBody : updateProgramType;

      return {
        id: item.id,
        cells: {
          code: item.code,
          name: item.name,
          programs: String(item.programs.length),
          actions: (
            <div className="flex flex-wrap items-center gap-2">
              <RowForm
                id={`edit-${section}-${item.id}`}
                button={edit.button}
                fields={edit.fields}
                values={{ name: item.name, code: item.code }}
                hidden={hidden}
                action={action}
                submitLabel={common.update}
              />
              <RowForm
                id={`delete-${section}-${item.id}`}
                button={remove.button}
                fields={[]}
                hidden={hidden}
                action={section === "bodies" ? deleteProgramBody : deleteProgramType}
                submitLabel={remove.button}
                tone="danger"
              />
            </div>
          ),
        },
      };
    });

  const cadenceRows: Row[] = cadences.map((cadence) => ({
    id: cadence.id,
    cells: {
      name: cadence.name,
      kind: labels.feePeriodKind[cadence.kind],
      programs: String(cadence.programs.length),
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <RowForm
            id={`edit-cadence-${cadence.id}`}
            button={settings.cadences.edit.button}
            fields={settings.cadences.edit.fields}
            values={{ name: cadence.name, kind: cadence.kind }}
            hidden={{ cadenceId: cadence.id }}
            action={updateFeeCadence}
            submitLabel={common.update}
          />
          <RowForm
            id={`delete-cadence-${cadence.id}`}
            button={settings.cadences.remove.button}
            fields={[]}
            hidden={{ cadenceId: cadence.id }}
            action={deleteFeeCadence}
            submitLabel={settings.cadences.remove.button}
            tone="danger"
          />
        </div>
      ),
    },
  }));

  const departmentRows: Row[] = departments.map((department) => ({
    id: department.id,
    cells: { name: department.name, programs: String(department.programs.length) },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        action={
          <SettingsDialog label={settings.button} title={settings.title} description={settings.description}>
            <Panel title={settings.bodies.heading} description={settings.bodies.description}>
              <div className="space-y-4 p-4">
                <DisclosureForm
                  id="new-body"
                  button={settings.bodies.create.button}
                  title={settings.bodies.create.title}
                  fields={settings.bodies.create.fields}
                  action={createProgramBody}
                  submitLabel={common.create}
                />
              </div>
              {bodies.length === 0 ? (
                <EmptyState body={settings.bodies.empty} icon="programs" />
              ) : (
                <DataTable
                  columns={withActions(settings.bodies.columns)}
                  rows={codedRows(bodies, "bodies")}
                  caption={settings.bodies.heading}
                />
              )}
            </Panel>

            <Panel title={settings.types.heading} description={settings.types.description}>
              <div className="space-y-4 p-4">
                <DisclosureForm
                  id="new-program-type"
                  button={settings.types.create.button}
                  title={settings.types.create.title}
                  fields={settings.types.create.fields}
                  action={createProgramType}
                  submitLabel={common.create}
                />
              </div>
              {types.length === 0 ? (
                <EmptyState body={settings.types.empty} icon="programs" />
              ) : (
                <DataTable
                  columns={withActions(settings.types.columns)}
                  rows={codedRows(types, "types")}
                  caption={settings.types.heading}
                />
              )}
            </Panel>

            <Panel title={settings.cadences.heading} description={settings.cadences.description}>
              <div className="space-y-4 p-4">
                <DisclosureForm
                  id="new-fee-cadence"
                  button={settings.cadences.create.button}
                  title={settings.cadences.create.title}
                  fields={settings.cadences.create.fields}
                  action={createFeeCadence}
                  submitLabel={common.create}
                />
              </div>
              {cadenceRows.length === 0 ? (
                <EmptyState body={settings.cadences.empty} icon="accounts" />
              ) : (
                <DataTable
                  columns={withActions(settings.cadences.columns)}
                  rows={cadenceRows}
                  caption={settings.cadences.heading}
                />
              )}
            </Panel>

            <Panel title={copy.departments.heading} description={copy.departments.description}>
              <div className="space-y-4 p-4">
                <DisclosureForm
                  id="new-department"
                  button={copy.departments.create.button}
                  title={copy.departments.create.title}
                  fields={copy.departments.create.fields}
                  action={createDepartment}
                  submitLabel={common.create}
                />
              </div>
              {departmentRows.length === 0 ? (
                <EmptyState body={copy.departments.empty} icon="programs" />
              ) : (
                <DataTable columns={copy.departments.columns} rows={departmentRows} caption={copy.departments.heading} />
              )}
            </Panel>
          </SettingsDialog>
        }
      />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-program"
        button={copy.create.button}
        title={copy.create.title}
        fields={programFields}
        options={options}
        action={createProgram}
        submitLabel={common.create}
      />

      <Panel title={copy.title} description={pages.overview.scopeNote(scope.campusName)}>
        {programRows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="programs" />
        ) : (
          <DataTable columns={copy.columns} rows={programRows} caption={copy.title} />
        )}
      </Panel>
    </div>
  );
}

/** A programme's own document, read straight from its row rather than from a second screen. */
function documentCell(url: string | null, document: { none: string; view: string }) {
  if (!url) return <span className="text-eavi-muted-text">{document.none}</span>;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center justify-end px-2 text-sm font-medium text-eavi-primary-text underline underline-offset-4"
    >
      {document.view}
    </a>
  );
}

/** The registry tables each end in an unlabelled column of row-level Edit and Delete forms. */
function withActions(columns: readonly Column[]): Column[] {
  return [...columns, { key: "actions", label: "", interactive: true }];
}
