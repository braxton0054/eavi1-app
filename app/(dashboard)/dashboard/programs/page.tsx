import {
  createDepartment,
  createFeeCadence,
  createProgram,
  createProgramBody,
  createProgramType,
  renameFeeCadence,
  uploadCurriculum,
  uploadFeeStructure,
} from "@/lib/actions/college/programs";
import {
  getDepartmentOptions,
  getDepartments,
  getFeeCadences,
  getProgramBodies,
  getProgramOptions,
  getProgramRegistryOptions,
  getProgramTypes,
  getPrograms,
} from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";

const copy = pages.programs;
const settings = copy.settings;

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
      department: program.department.name,
      duration: copy.duration(program.durationMonths),
      minKcseGrade: labels.entryGrade[program.minKcseGrade],
      students: String(program.enrolledCount),
      curriculum: program.curriculumUrl ? (
        <a href={program.curriculumUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-end px-2 text-sm font-medium text-eavi-primary-text underline underline-offset-4">
          View
        </a>
      ) : (
        <span className="text-eavi-muted-text">{copy.curriculum.none}</span>
      ),
      feeStructure: program.feeStructureUrl ? (
        <a href={program.feeStructureUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-end px-2 text-sm font-medium text-eavi-primary-text underline underline-offset-4">
          View
        </a>
      ) : (
        <span className="text-eavi-muted-text">{copy.feeStructure.none}</span>
      ),
    },
  }));

  // A body or a type is only ever retired by taking its programmes away, so the count is shown.
  const codedRows = (
    items: { id: string; code: string; name: string; programs: { id: string }[] }[],
  ): Row[] =>
    items.map((item) => ({
      id: item.id,
      cells: { code: item.code, name: item.name, programs: String(item.programs.length) },
    }));

  const cadenceRows: Row[] = cadences.map((cadence) => ({
    id: cadence.id,
    cells: {
      name: cadence.name,
      programs: String(cadence.programs.length),
      rename: (
        <RowForm
          id={`rename-cadence-${cadence.id}`}
          button={settings.cadences.rename.button}
          fields={settings.cadences.rename.fields}
          action={renameFeeCadence}
          submitLabel={common.save}
          hidden={{ cadenceId: cadence.id }}
        />
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
                <DataTable columns={settings.bodies.columns} rows={codedRows(bodies)} caption={settings.bodies.heading} />
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
                <DataTable columns={settings.types.columns} rows={codedRows(types)} caption={settings.types.heading} />
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
                <DataTable columns={cadenceColumns()} rows={cadenceRows} caption={settings.cadences.heading} />
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
        fields={copy.create.fields}
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

      <Panel title={copy.curriculum.heading}>
        <form action={uploadCurriculum} className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="curriculum-program">
              {copy.curriculum.program}
            </label>
            <select
              id="curriculum-program"
              name="programId"
              required
              className="h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm"
            >
              <option value="">{common.none}</option>
              {programOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="curriculum-file">
              {copy.curriculum.file}
            </label>
            <input
              id="curriculum-file"
              name="curriculum"
              type="file"
              accept="application/pdf"
              required
              className="h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1 file:text-eavi-primary-text"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
            >
              {copy.curriculum.button}
            </button>
          </div>
        </form>
      </Panel>

      <Panel title={copy.feeStructure.heading}>
        <form action={uploadFeeStructure} className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="feestructure-program">
              {copy.feeStructure.program}
            </label>
            <select
              id="feestructure-program"
              name="programId"
              required
              className="h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm"
            >
              <option value="">{common.none}</option>
              {programOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="feestructure-file">
              {copy.feeStructure.file}
            </label>
            <input
              id="feestructure-file"
              name="feeStructure"
              type="file"
              accept="application/pdf"
              required
              className="h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1 file:text-eavi-primary-text"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
            >
              {copy.feeStructure.button}
            </button>
          </div>
        </form>
      </Panel>
    </div>
  );
}

/** The payment type table carries its own rename control, so its last column has no label. */
function cadenceColumns() {
  return [...settings.cadences.columns, { key: "rename", label: "" }];
}
