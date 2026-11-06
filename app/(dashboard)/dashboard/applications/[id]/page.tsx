import Link from "next/link";
import type { ReactNode } from "react";

import { decideApplication } from "@/lib/actions/college/applications";
import { getApplication } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { RecordForm } from "@/components/dashboard/record-form";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import type { Field } from "@/lib/content/dashboard";

const copy = pages.applications;

const applicationTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "warning",
  REJECTED: "danger",
  WITHDRAWN: "neutral",
};

/** The two outcomes an administrator may record, in the order they read on the form. */
const DECIDABLE = ["REVIEWING", "REJECTED"] as const;

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let application: Awaited<ReturnType<typeof getApplication>> | null = null;
  try {
    application = await getApplication(id);
  } catch (error) {
    // getApplication throws "not_found" for another campus's row; everything else,
    // including the sign-in redirect from requireCollegeAdmin, must keep travelling up.
    if (error instanceof Error && error.message === "not_found") application = null;
    else throw error;
  }

  if (!application) {
    return (
      <div className="space-y-6">
        <PageHeader title={common.notFoundTitle} description={common.notFoundBody} />
        <Panel>
          <EmptyState
            title={common.notFoundTitle}
            body={common.notFoundBody}
            icon="applications"
            action={
              <ShimmerButton asChild>
                <Link href="/dashboard/applications">{common.back}</Link>
              </ShimmerButton>
            }
          />
        </Panel>
      </div>
    );
  }

  // One entry per create-form field name; the descriptor's label doubles as the display label.
  const fieldValues: Record<string, ReactNode> = {
    fullName: application.fullName,
    email: application.email,
    phone: application.phone,
    gender: application.gender ? labels.gender[application.gender] : null,
    grade: application.grade ? labels.entryGrade[application.grade] : null,
    programId: `${application.program.name} (${application.program.code})`,
    previousQualification: application.previousQualification ?? common.notSet,
  };

  const decisionValues: Record<string, ReactNode> = {
    status: (
      <StatusChip tone={applicationTone[application.status] ?? "info"}>
        {labels.applicationStatus[application.status]}
      </StatusChip>
    ),
    decisionNote: application.decisionNote ?? common.notSet,
    decidedBy: application.decidedBy?.fullName ?? common.notSet,
    decidedAt: formatDate(application.decidedAt),
  };

  // A decision is only recorded while the applicant is still waiting on the campus office.
  const openToDecide = application.status === "SUBMITTED" || application.status === "REVIEWING";

  const decisionFields: Field[] = [
    {
      ...copy.decision.statusField,
      options: DECIDABLE.map((value) => ({ value, label: labels.applicationStatus[value] })),
    },
    copy.decision.note,
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={application.fullName}
        meta={
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-sm tabular-nums text-eavi-muted-text">{application.reference}</p>
            <StatusChip tone={applicationTone[application.status] ?? "info"}>
              {labels.applicationStatus[application.status]}
            </StatusChip>
          </div>
        }
        action={
          <Link
            href="/dashboard/applications"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {common.back}
          </Link>
        }
      />

      <Panel title={copy.title} description={application.campus.name}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {copy.create.fields.map((field) => (
            <div key={field.name} className={field.wide ? "sm:col-span-2" : undefined}>
              <dt className="text-xs text-eavi-muted-text">{field.label}</dt>
              <dd className="min-w-0 text-sm break-words">{fieldValues[field.name] ?? common.notSet}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={copy.detail.derivedHeading}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.awardingBody}</dt>
            <dd className="min-w-0 text-sm break-words">{application.program.body.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.programmeType}</dt>
            <dd className="min-w-0 text-sm break-words">{application.program.type.name}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={copy.detail.decision}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-eavi-muted-text">{common.status}</dt>
            <dd className="min-w-0 text-sm break-words">{decisionValues.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.decidedBy}</dt>
            <dd className="min-w-0 text-sm break-words">{decisionValues.decidedBy}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.decidedAt}</dt>
            <dd className="min-w-0 text-sm break-words">{decisionValues.decidedAt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-eavi-muted-text">{copy.decision.note.label}</dt>
            <dd className="min-w-0 text-sm break-words">{decisionValues.decisionNote}</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title={copy.decision.button}
        description={openToDecide ? copy.decision.hold : undefined}
      >
        <div className="p-4">
          <RecordForm
            id="application-decision"
            fields={decisionFields}
            action={decideApplication}
            submitLabel={copy.decision.button}
            hidden={{ applicationId: application.id }}
          />
        </div>
      </Panel>

      <div>
        <Link
          href={`/dashboard/students/enrol?application=${application.id}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
        >
          Enrol this applicant
        </Link>
      </div>
    </div>
  );
}
