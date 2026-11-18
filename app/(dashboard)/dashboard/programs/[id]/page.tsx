import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveProgram, deleteProgram, updateProgram } from "@/lib/actions/college/programs";
import { getProgramDetail, getProgramRegistryOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import type { OptionSets } from "@/components/dashboard/record-form";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RowForm } from "@/components/dashboard/record-form";
import { DetailList, EmptyState, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { PrintButton } from "@/components/dashboard/print-button";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { StatusChip } from "@/components/dashboard/status-chip";
import { describeTrigger } from "@/lib/academics/structure";
import { formatDate, money } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.programs;
const detail = copy.detail;
const tabs = copy.sectionTabs;
const readiness = detail.readiness;
const fields = copy.fieldLabels;

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await requireCollegeAdmin();
  // Only the super admin changes the shared catalogue. A campus office reads and prints it.
  const canManage = scope.role === "SUPERADMIN";

  let data: Awaited<ReturnType<typeof getProgramDetail>> | null = null;
  try {
    data = await getProgramDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") data = null;
    else throw error;
  }

  if (!data) notFound();

  // The editor takes the same questions as the add form, so the registries come along too.
  const registries = await getProgramRegistryOptions();
  const programOptions: OptionSets = {
    bodies: registries.bodies,
    programTypes: registries.programTypes,
    feeCadences: registries.feeCadences,
    departments: registries.departments,
  };

  const { program, activeEnrollments, completedEnrollments } = data;
  const plan = program.feePlans[0] ?? null;
  const archived = program.archivedAt !== null;
  const base = `/dashboard/programs/${program.id}`;

  // Only the settings this programme actually has; an "Attachment · none" row is noise.
  const details = [
    { label: fields.code, value: program.code },
    { label: fields.body, value: `${program.body.name} (${program.body.code})` },
    { label: fields.type, value: program.type.name },
    { label: fields.department, value: program.department.name },
    { label: fields.structure, value: labels.programStructure[program.structure] },
    { label: fields.duration, value: copy.duration(program.durationMonths) },
    { label: fields.cadence, value: program.cadence.name },
    { label: fields.minGrade, value: labels.entryGrade[program.minKcseGrade] },
    {
      label: fields.campuses,
      value: program.campuses.map((campus) => campus.name).join(", ") || common.notSet,
    },
  ];

  // What is still missing, in the order an administrator would fix it.
  const setup = [
    {
      label: readiness.placed,
      done: program._count.units > 0,
      value: String(program._count.units),
      href: `${base}/units`,
      hint: readiness.noUnitsHint,
    },
    {
      label: readiness.fee,
      done: plan !== null,
      value: plan ? readiness.set(money(plan.totalAmount)) : readiness.none,
      href: `${base}/fees`,
      hint: readiness.noneHint,
    },
    {
      label: readiness.attachment,
      done: program._count.attachmentRequirements > 0,
      value: String(program._count.attachmentRequirements),
      href: `${base}/attachment`,
      hint: readiness.noAttachmentHint,
    },
  ];

  const moduleRows: Row[] = program.modules.map((module) => ({
    id: module.id,
    cells: {
      code: module.code,
      name: module.name,
      units: String(module._count.units),
    },
  }));

  const moduleColumns: Column[] = [
    { key: "code", label: "Code" },
    { key: "name", label: "Module" },
    { key: "units", label: "Units", align: "end" },
  ];

  const attachmentRows: Row[] = program.attachmentRequirements.map((requirement) => ({
    id: requirement.id,
    cells: {
      label: requirement.label,
      when: describeTrigger(requirement),
      duration:
        [
          requirement.durationWeeks ? `${requirement.durationWeeks} weeks` : null,
          requirement.durationMonths ? `${requirement.durationMonths} months` : null,
        ]
          .filter(Boolean)
          .join(" · ") || common.notSet,
      tracked: String(requirement._count.studentAttachments),
    },
  }));

  const attachmentColumns: Column[] = [
    { key: "label", label: "Stage" },
    { key: "when", label: "When" },
    { key: "duration", label: "Duration" },
    { key: "tracked", label: "Students tracked", align: "end" },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Link
          href="/dashboard/programs"
          className="inline-flex min-h-8 items-center gap-1 text-sm text-eavi-muted-text hover:text-eavi-primary-text"
        >
          ← {detail.back}
        </Link>

        <PageHeader
          title={program.name}
          action={<PrintButton label={common.print} />}
          meta={
            <div className="mt-1.5 space-y-1.5 text-sm text-eavi-muted-text">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-eavi-on-bg tabular-nums">{program.code}</span>
                <span aria-hidden className="text-eavi-border">·</span>
                <span>{labels.programStructure[program.structure]}</span>
                <span aria-hidden className="text-eavi-border">·</span>
                <span>{copy.duration(program.durationMonths)}</span>
                {archived ? (
                  <StatusChip tone="neutral">{detail.archivedOn(formatDate(program.archivedAt!))}</StatusChip>
                ) : null}
              </p>
              <p>{copy.studentsLine(activeEnrollments, completedEnrollments)}</p>
            </div>
          }
        />
      </div>

      <SectionTabs
        label={tabs.label}
        tabs={[
          { href: base, label: tabs.overview, active: true },
          { href: `${base}/units`, label: tabs.units },
          { href: `${base}/fees`, label: tabs.fees },
          { href: `${base}/attachment`, label: tabs.attachment },
        ]}
      />

      <section aria-label={readiness.heading} className="grid gap-2 sm:grid-cols-3">
        {setup.map((item) =>
          item.done ? (
            <StatTile
              key={item.label}
              compact
              label={item.label}
              value={item.value}
              hint={undefined}
              icon="programs"
              tone="money"
            />
          ) : (
            <Link key={item.label} href={item.href} className="group min-w-0">
              <StatTile compact label={item.label} value={item.value} hint={item.hint} icon="programs" tone="attention" />
            </Link>
          ),
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel
          title={detail.overview}
          className="lg:col-span-7"
          aside={
            program.description ? (
              <p className="max-w-md text-sm text-eavi-muted-text lg:text-right">{program.description}</p>
            ) : null
          }
        >
          <DetailList items={details} />
        </Panel>

        {/* Fee first, then the two destructive controls kept apart from it. */}
        <div className="space-y-4 lg:col-span-5">
          <Panel
            title={detail.summary.fee}
            description={plan ? detail.summary.feeVersion(plan.version) : undefined}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <p className="text-2xl font-semibold tabular-nums">{plan ? money(plan.totalAmount) : common.notSet}</p>
              <Link
                href={`${base}/fees`}
                className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
              >
                {detail.manageFees}
              </Link>
            </div>
          </Panel>

          {canManage ? (
          <Panel title={detail.actions}>
            <div className="flex flex-col gap-3 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <RowForm
                  id={`edit-${program.id}`}
                  button={copy.edit.button}
                  fields={copy.create.fields}
                  options={programOptions}
                  values={{
                    name: program.name,
                    bodyId: program.bodyId,
                    typeId: program.typeId,
                    departmentId: program.departmentId,
                    cadenceId: program.cadenceId,
                    structure: program.structure,
                    durationMonths: String(program.durationMonths),
                    minKcseGrade: program.minKcseGrade,
                    description: program.description ?? "",
                  }}
                  hidden={{ programId: program.id }}
                  action={updateProgram}
                  submitLabel={common.update}
                  wide
                />
                {archived ? null : (
                  <RowForm
                    id={`archive-${program.id}`}
                    button={copy.archive.button}
                    fields={[{ name: "reason", label: copy.archive.reason, type: "text", wide: true }]}
                    hidden={{ programId: program.id }}
                    action={archiveProgram}
                    submitLabel={copy.archive.button}
                  />
                )}
                <RowForm
                  id={`delete-${program.id}`}
                  button={copy.remove.button}
                  fields={[]}
                  hidden={{ programId: program.id }}
                  action={deleteProgram}
                  submitLabel={copy.remove.button}
                  tone="danger"
                />
              </div>
            </div>
          </Panel>
          ) : null}
        </div>
      </div>

      {program.modules.length > 0 ? (
        <Panel
          title={detail.summary.modules}
          aside={
            <Link
              href={`${base}/units`}
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
            >
              {detail.manageUnits}
            </Link>
          }
        >
          <DataTable columns={moduleColumns} rows={moduleRows} caption={detail.summary.modules} />
        </Panel>
      ) : null}

      <Panel
        title={detail.manageAttachment}
        aside={
          <Link
            href={`${base}/attachment`}
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {detail.openAttachment}
          </Link>
        }
      >
        {attachmentRows.length === 0 ? (
          <EmptyState body={detail.noAttachment} icon="calendar" />
        ) : (
          <DataTable columns={attachmentColumns} rows={attachmentRows} caption={detail.manageAttachment} />
        )}
      </Panel>
    </div>
  );
}
