import { createDepartment, createProgram, uploadCurriculum } from "@/lib/actions/college/programs";
import { getDepartmentOptions, getDepartments, getProgramOptions, getPrograms } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.programs;

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [rows, departments, departmentOptions, programOptions] = await Promise.all([
    getPrograms({}),
    getDepartments(),
    getDepartmentOptions(),
    getProgramOptions(scope.campusId),
  ]);

  const options: OptionSets = { departments: departmentOptions, programs: programOptions };

  const programRows: Row[] = rows.map((program) => ({
    id: program.id,
    cells: {
      code: program.code,
      name: program.name,
      department: program.department.name,
      level: <StatusChip tone="neutral">{labels.programLevel[program.level]}</StatusChip>,
      duration: copy.duration(program.durationMonths),
      minKcseGrade: labels.entryGrade[program.minKcseGrade],
      feeFrequency: labels.feeFrequency[program.feeFrequency],
      students: String(program.enrolledCount),
      curriculum: program.curriculumUrl ? (
        <a href={program.curriculumUrl} target="_blank" rel="noreferrer" className="text-eavi-primary-text underline">
          View
        </a>
      ) : (
        <span className="text-eavi-muted-text">{copy.curriculum.none}</span>
      ),
    },
  }));

  const departmentRows: Row[] = departments.map((department) => ({
    id: department.id,
    cells: {
      name: department.name,
      programs: String(department.programs.length),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

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
          <DataTable
            columns={copy.departments.columns}
            rows={departmentRows}
            caption={copy.departments.heading}
          />
        )}
      </Panel>

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
              className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm"
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
              className="h-11 rounded-lg border border-input bg-eavi-card px-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-eavi-primary-soft file:px-3 file:py-1 file:text-eavi-primary-text"
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
    </div>
  );
}
