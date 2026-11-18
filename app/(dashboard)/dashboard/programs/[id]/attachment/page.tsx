import Link from "next/link";
import { notFound } from "next/navigation";

import {
  removeAttachmentRequirement,
  saveAttachmentRequirement,
} from "@/lib/actions/college/attachments";
import { getProgramAttachmentPlan } from "@/lib/dal/college";
import { common, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { SectionTabs } from "@/components/dashboard/section-tabs";
import { describeTrigger, triggerValue } from "@/lib/academics/structure";
import type { Column, Field } from "@/lib/content/dashboard";

const copy = pages.programs;
const attachmentCopy = copy.attachments;
const tabs = copy.sectionTabs;

export default async function ProgramAttachmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getProgramAttachmentPlan>> | null = null;
  try {
    data = await getProgramAttachmentPlan(id);
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") data = null;
    else throw error;
  }

  if (!data) notFound();

  const { program, periods, requirements, enrolled, scope } = data;
  const canManage = scope.role === "SUPERADMIN";
  const archived = program.archivedAt !== null;

  // Only stages the programme actually has: each semester or month, or the whole course.
  const triggerOptions = [
    ...periods.map((period) => ({ value: triggerValue(period), label: period.label })),
    { value: "ALL", label: attachmentCopy.allPeriods },
  ];

  const fields: Field[] = [
    { name: "label", label: attachmentCopy.label, type: "text", required: true, wide: true },
    { name: "trigger", label: attachmentCopy.trigger, type: "select", required: true, options: triggerOptions },
    { name: "durationWeeks", label: attachmentCopy.durationWeeks, type: "number", step: "1" },
    { name: "durationMonths", label: attachmentCopy.durationMonths, type: "number", step: "1" },
    { name: "startsAt", label: attachmentCopy.startsAt, type: "date" },
    { name: "endsAt", label: attachmentCopy.endsAt, type: "date" },
    { name: "prerequisiteNote", label: attachmentCopy.prerequisiteNote, type: "textarea", wide: true },
    { name: "assessmentNote", label: attachmentCopy.assessmentNote, type: "textarea", wide: true },
  ];

  const rows: Row[] = requirements.map((requirement) => ({
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
      actions: canManage ? (
        requirement._count.studentAttachments > 0 ? (
          <span className="text-xs text-eavi-muted-text">{attachmentCopy.removeBlocked}</span>
        ) : (
          <RowForm
            id={`remove-attachment-${requirement.id}`}
            button={attachmentCopy.remove}
            fields={[]}
            hidden={{ programId: program.id, requirementId: requirement.id }}
            action={removeAttachmentRequirement}
            submitLabel={attachmentCopy.remove}
            tone="danger"
          />
        )
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
        title={attachmentCopy.title}
        description={attachmentCopy.description}
        meta={
          <p className="mt-1 text-sm text-eavi-muted-text">
            {program.code} · {enrolled} active {enrolled === 1 ? "student" : "students"} tracked
          </p>
        }
      />

      <SectionTabs
        label={tabs.label}
        tabs={[
          { href: `/dashboard/programs/${program.id}`, label: tabs.overview },
          { href: `/dashboard/programs/${program.id}/units`, label: tabs.units },
          { href: `/dashboard/programs/${program.id}/fees`, label: tabs.fees },
          { href: `/dashboard/programs/${program.id}/attachment`, label: tabs.attachment, active: true },
        ]}
      />

      {archived ? (
        <Notice tone="warning" title={attachmentCopy.title} body={attachmentCopy.archived} />
      ) : null}

      {!archived && canManage ? (
        <DisclosureForm
          id="new-attachment-stage"
          button={attachmentCopy.add}
          title={attachmentCopy.addTitle}
          fields={fields}
          hidden={{ programId: program.id }}
          action={saveAttachmentRequirement}
          submitLabel={attachmentCopy.add}
        />
      ) : null}

      <Panel title={attachmentCopy.stages}>
        {rows.length === 0 ? (
          <EmptyState
            title={attachmentCopy.stages}
            body={attachmentCopy.empty}
            icon="calendar"
          />
        ) : (
          <DataTable
            columns={(canManage ? attachmentCopy.stageColumns : attachmentCopy.stageColumns.slice(0, -1)) as Column[]}
            rows={rows}
            caption={attachmentCopy.stages}
          />
        )}
      </Panel>
    </div>
  );
}
