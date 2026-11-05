import { createDepartment, createProgram } from "@/lib/actions/college/programs";
import { getDepartmentOptions, getDepartments, getPrograms } from "@/lib/dal/college";
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

  const [rows, departments, departmentOptions] = await Promise.all([
    getPrograms({}),
    getDepartments(),
    getDepartmentOptions(),
  ]);

  const options: OptionSets = { departments: departmentOptions };

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
    </div>
  );
}
