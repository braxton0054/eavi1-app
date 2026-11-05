import { createFeeItem, createProgram } from "@/lib/actions/college/programs";
import { getFeeItems, getProgramOptions, getPrograms, getTermOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { money } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.programs;

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [rows, feeItems, programOptions, termOptions] = await Promise.all([
    getPrograms({}),
    getFeeItems(),
    getProgramOptions(scope.campusId),
    getTermOptions(),
  ]);

  const options: OptionSets = { programs: programOptions, terms: termOptions };

  const programRows: Row[] = rows.map((program) => ({
    id: program.id,
    cells: {
      code: program.code,
      name: program.name,
      level: <StatusChip tone="neutral">{labels.programLevel[program.level]}</StatusChip>,
      duration: copy.duration(program.durationMonths),
      students: String(program.enrolledCount),
      feeTotal: money(program.feeTotal),
    },
  }));

  const feeRows: Row[] = feeItems.map((item) => ({
    id: item.id,
    cells: {
      program: `${item.program.name} (${item.program.code})`,
      label: item.label,
      amount: money(Number(String(item.amount))),
      term: item.term?.name ?? common.all,
      optional: item.isOptional ? common.yes : common.none,
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

      <Panel title={copy.feeItems.heading} description={copy.feeItems.description}>
        <div className="space-y-4 p-4">
          <DisclosureForm
            id="new-fee-item"
            button={copy.feeItems.create.button}
            title={copy.feeItems.create.title}
            fields={copy.feeItems.create.fields}
            options={options}
            action={createFeeItem}
            submitLabel={common.create}
          />
        </div>
        {feeRows.length === 0 ? (
          <EmptyState body={copy.feeItems.empty} icon="accounts" />
        ) : (
          <DataTable columns={copy.feeItems.columns} rows={feeRows} caption={copy.feeItems.heading} />
        )}
      </Panel>
    </div>
  );
}
