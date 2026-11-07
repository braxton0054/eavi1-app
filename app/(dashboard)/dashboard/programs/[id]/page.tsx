import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveProgram, deleteProgram } from "@/lib/actions/college/programs";
import { getProgramDetail } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RowForm } from "@/components/dashboard/record-form";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { describeTrigger } from "@/lib/academics/structure";
import { formatDate, money } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.programs;
const detail = copy.detail;

const linkClass =
  "inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getProgramDetail>> | null = null;
  try {
    data = await getProgramDetail(id);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") data = null;
    else throw error;
  }

  if (!data) notFound();

  const { program, activeEnrollments } = data;
  const plan = program.feePlans[0] ?? null;

  const details = [
    { label: "Code", value: program.code },
    { label: "Awarding body", value: `${program.body.name} (${program.body.code})` },
    { label: "Programme type", value: program.type.name },
    { label: "Department", value: program.department.name },
    { label: "Delivery structure", value: labels.programStructure[program.structure] },
    { label: "Duration", value: copy.duration(program.durationMonths) },
    { label: "Fee payment type", value: program.cadence.name },
    { label: "Minimum KCSE grade", value: labels.entryGrade[program.minKcseGrade] },
    { label: "Campuses", value: program.campuses.map((campus) => campus.name).join(", ") || common.notSet },
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
        [requirement.durationWeeks ? `${requirement.durationWeeks} weeks` : null, requirement.durationMonths ? `${requirement.durationMonths} months` : null]
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
    <div className="space-y-6">
      <Link href="/dashboard/programs" className="text-sm text-eavi-primary-text underline-offset-4 hover:underline">
        ← {detail.back}
      </Link>

      <PageHeader
        title={program.name}
        description={program.description ?? undefined}
        meta={
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-eavi-muted-text">
            <span className="tabular-nums">{program.code}</span>
            <span>·</span>
            <span>{labels.programStructure[program.structure]}</span>
            <span>·</span>
            <span>{copy.duration(program.durationMonths)}</span>
            {program.archivedAt ? (
              <StatusChip tone="neutral">
                {detail.archivedOn(formatDate(program.archivedAt))}
              </StatusChip>
            ) : null}
          </p>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/programs/${program.id}/fees`} className={linkClass}>
              {detail.manageFees}
            </Link>
            <Link href={`/dashboard/programs/${program.id}/units`} className={linkClass}>
              {detail.manageUnits}
            </Link>
            <Link href={`/dashboard/programs/${program.id}/attachment`} className={linkClass}>
              {detail.manageAttachment}
            </Link>
          </div>
        }
      />

      <section aria-label={detail.summary.units} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={detail.summary.units} value={String(program._count.units)} icon="programs" tone="neutral" />
        <StatTile label={detail.summary.modules} value={String(program._count.modules)} icon="programs" tone="neutral" />
        <StatTile
          label={detail.summary.attachment}
          value={String(program._count.attachmentRequirements)}
          icon="calendar"
          tone="neutral"
        />
        <StatTile label={detail.summary.enrolled} value={String(activeEnrollments)} icon="students" tone="neutral" />
      </section>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel title={detail.overview} className="lg:col-span-7">
          <dl className="grid gap-4 p-4 sm:grid-cols-2">
            {details.map((item) => (
              <div key={item.label}>
                <dt className="text-xs text-eavi-muted-text">{item.label}</dt>
                <dd className="text-sm">{item.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel
          title={detail.summary.fee}
          description={plan ? detail.summary.feeVersion(plan.version) : detail.summary.noFee}
          className="lg:col-span-5"
        >
          <div className="space-y-4 p-4">
            <p className="text-2xl font-semibold tabular-nums">
              {plan ? money(plan.totalAmount) : common.notSet}
            </p>
            <Link href={`/dashboard/programs/${program.id}/fees`} className={linkClass}>
              {detail.manageFees}
            </Link>

            <div className="flex flex-wrap gap-2 border-t border-eavi-border pt-4">
              {program.archivedAt ? null : (
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
      </div>

      {program.modules.length > 0 ? (
        <Panel title={detail.summary.modules}>
          <DataTable columns={moduleColumns} rows={moduleRows} caption={detail.summary.modules} />
        </Panel>
      ) : null}

      <Panel title={detail.manageAttachment}>
        {attachmentRows.length === 0 ? (
          <EmptyState title={detail.manageAttachment} body={detail.noAttachment} icon="calendar" />
        ) : (
          <DataTable columns={attachmentColumns} rows={attachmentRows} caption={detail.manageAttachment} />
        )}
      </Panel>
    </div>
  );
}
