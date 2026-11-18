import Link from "next/link";
import { notFound } from "next/navigation";

import {
  assignProgramUnit,
  createProgramModule,
  createUnit,
  removeProgramModule,
  removeProgramUnit,
  updateProgramModule,
} from "@/lib/actions/college/program-units";
import { getProgramUnitsPlan } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import type { Column, Field } from "@/lib/content/dashboard";

const copy = pages.programs;
const unitCopy = copy.unitPlan;
const tabs = copy.sectionTabs;

export default async function ProgramUnitsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireCollegeAdmin();
  const canManage = scope.role === "SUPERADMIN";

  let data: Awaited<ReturnType<typeof getProgramUnitsPlan>> | null = null;
  try {
    data = await getProgramUnitsPlan(id);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") data = null;
    else throw error;
  }

  if (!data) notFound();

  const { program, periods, placed, modules, units } = data;
  const archived = program.archivedAt !== null;
  const structure = program.structure;

  const catalogueOptions = units.map((unit) => ({
    value: unit.id,
    label: `${unit.code} · ${unit.name}`,
  }));

  // The period field is the one that changes with the programme's own structure.
  const assignFields: Field[] = [
    { name: "unitId", label: unitCopy.unit, type: "select", required: true, options: catalogueOptions },
  ];

  if (structure === "MODULE") {
    assignFields.push({
      name: "moduleId",
      label: unitCopy.module,
      type: "select",
      required: true,
      options: modules.map((module) => ({ value: module.id, label: `${module.code} · ${module.name}` })),
    });
  } else if (structure === "CUSTOM") {
    assignFields.push({
      name: "customPeriod",
      label: unitCopy.customPeriod,
      type: "text",
      required: true,
    });
  } else {
    assignFields.push({
      name: "periodKey",
      label: unitCopy.period,
      type: "select",
      required: true,
      options: periods.map((period) => ({ value: period.key, label: period.label })),
    });
  }

  const placedRows: Row[] = placed.map((placement) => ({
    id: placement.id,
    cells: {
      unit: `${placement.unit.code} · ${placement.unit.name}`,
      period: placement.periodLabel,
      order: String(placement.sequence),
      actions: canManage ? (
        placement._count.studentUnits > 0 ? (
          <span className="text-xs text-eavi-muted-text">{unitCopy.removeBlocked}</span>
        ) : (
          <RowForm
            id={`remove-placement-${placement.id}`}
            button={unitCopy.removeUnit}
            fields={[]}
            hidden={{ programId: program.id, placementId: placement.id }}
            action={removeProgramUnit}
            submitLabel={unitCopy.removeUnit}
            tone="danger"
          />
        )
      ) : null,
    },
  }));

  const catalogueRows: Row[] = units.map((unit) => ({
    id: unit.id,
    cells: {
      code: unit.code,
      name: unit.name,
      used: String(unit._count.programUnits),
    },
  }));

  const catalogueColumns: Column[] = [
    { key: "code", label: unitCopy.unitCode },
    { key: "name", label: unitCopy.unitName },
    { key: "used", label: unitCopy.placed, align: "end" },
  ];

  const moduleRows: Row[] = modules.map((module) => ({
    id: module.id,
    cells: {
      code: module.code,
      name: module.name,
      units: String(module._count.units),
      duration: module.durationMonths ? copy.duration(module.durationMonths) : common.notSet,
      actions: canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <RowForm
            id={`edit-module-${module.id}`}
            button={unitCopy.editModule}
            fields={[
              { name: "name", label: unitCopy.moduleName, type: "text", required: true, wide: true },
              { name: "durationMonths", label: unitCopy.moduleDuration, type: "number", step: "1" },
              { name: "description", label: unitCopy.unitDescription, type: "textarea", wide: true },
              { name: "assessmentNote", label: copy.attachments.assessmentNote, type: "textarea", wide: true },
              { name: "isActive", label: common.active, type: "checkbox" },
            ]}
            values={{
              name: module.name,
              durationMonths: module.durationMonths ? String(module.durationMonths) : undefined,
              description: module.description ?? undefined,
              assessmentNote: module.assessmentNote ?? undefined,
              isActive: module.isActive ? "yes" : undefined,
            }}
            hidden={{ programId: program.id, moduleId: module.id }}
            action={updateProgramModule}
            submitLabel={common.update}
            wide
          />
          <RowForm
            id={`remove-module-${module.id}`}
            button={unitCopy.removeModule}
            fields={[]}
            hidden={{ programId: program.id, moduleId: module.id }}
            action={removeProgramModule}
            submitLabel={unitCopy.removeModule}
            tone="danger"
          />
        </div>
      ) : null,
    },
  }));

  return (
    <div className="space-y-6">
      <Link
        href={`/dashboard/programs/${program.id}`}
        className="inline-flex min-h-8 items-center gap-1 text-sm text-eavi-muted-text hover:text-eavi-primary-text"
      >
        ← {program.name}
      </Link>

      <PageHeader
        title={unitCopy.title}
        description={unitCopy.description}
        meta={
          <p className="mt-1 text-sm text-eavi-muted-text">
            {labels.programStructure[structure]} · {copy.duration(program.durationMonths)} ·{" "}
            {placed.length} {unitCopy.placed.toLowerCase()}
          </p>
        }
      />

      <SectionTabs
        label={tabs.label}
        tabs={[
          { href: `/dashboard/programs/${program.id}`, label: tabs.overview },
          { href: `/dashboard/programs/${program.id}/units`, label: tabs.units, active: true },
          { href: `/dashboard/programs/${program.id}/fees`, label: tabs.fees },
          { href: `/dashboard/programs/${program.id}/attachment`, label: tabs.attachment },
        ]}
      />

      {archived ? <Notice tone="warning" title={unitCopy.title} body={unitCopy.archived} /> : null}

      {!archived && canManage ? (
        <DisclosureForm
          id="assign-unit"
          button={unitCopy.assign}
          title={unitCopy.assignTitle}
          fields={assignFields}
          hidden={{ programId: program.id }}
          action={assignProgramUnit}
          submitLabel={unitCopy.assign}
        />
      ) : null}

      <Panel title={unitCopy.placed}>
        {placedRows.length === 0 ? (
          <EmptyState title={unitCopy.placed} body={unitCopy.noUnits} icon="programs" />
        ) : (
          <DataTable columns={(canManage ? unitCopy.columns : unitCopy.columns.slice(0, -1)) as Column[]} rows={placedRows} caption={unitCopy.placed} />
        )}
      </Panel>

      {structure === "MODULE" ? (
        <Panel title={unitCopy.moduleName}>
          {!archived && canManage ? (
            <div className="border-b border-eavi-border p-4">
              <DisclosureForm
                id="new-module"
                button={unitCopy.newModule}
                title={unitCopy.newModuleTitle}
                fields={[
                  { name: "code", label: unitCopy.moduleCode, type: "text", required: true },
                  { name: "name", label: unitCopy.moduleName, type: "text", required: true },
                  { name: "sequence", label: unitCopy.moduleSequence, type: "number", step: "1" },
                  { name: "durationMonths", label: unitCopy.moduleDuration, type: "number", step: "1" },
                  { name: "description", label: unitCopy.unitDescription, type: "textarea", wide: true },
                  { name: "assessmentNote", label: copy.attachments.assessmentNote, type: "textarea", wide: true },
                ]}
                hidden={{ programId: program.id }}
                action={createProgramModule}
                submitLabel={unitCopy.newModule}
              />
            </div>
          ) : null}

          {moduleRows.length === 0 ? (
            <p className="p-4 text-sm text-eavi-muted-text">{unitCopy.moduleEmpty}</p>
          ) : (
            <DataTable
              columns={(canManage ? unitCopy.moduleColumns : unitCopy.moduleColumns.slice(0, -1)) as Column[]}
              rows={moduleRows}
              caption={unitCopy.moduleName}
            />
          )}
        </Panel>
      ) : null}

      <Panel title={unitCopy.catalogue}>
        {!archived && canManage ? (
          <div className="border-b border-eavi-border p-4">
            <DisclosureForm
              id="new-unit"
              button={unitCopy.addUnit}
              title={unitCopy.addUnitTitle}
              fields={[
                { name: "code", label: unitCopy.unitCode, type: "text", required: true },
                { name: "name", label: unitCopy.unitName, type: "text", required: true },
                { name: "description", label: unitCopy.unitDescription, type: "textarea", wide: true },
              ]}
              hidden={{ programId: program.id }}
              action={createUnit}
              submitLabel={unitCopy.addUnit}
            />
          </div>
        ) : null}

        {catalogueRows.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{unitCopy.catalogueEmpty}</p>
        ) : (
          <DataTable
            columns={catalogueColumns}
            rows={catalogueRows}
            caption={unitCopy.catalogue}
          />
        )}
      </Panel>
    </div>
  );
}
