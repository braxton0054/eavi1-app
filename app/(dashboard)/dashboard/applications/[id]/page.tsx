import Link from "next/link";
import type { ReactNode } from "react";

import { decideApplication } from "@/lib/actions/college/applications";
import { getApplication } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { RecordForm } from "@/components/dashboard/record-form";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import type { Field } from "@/lib/content/dashboard";

const copy = pages.applications;

const applicationTone: Record<string, ChipTone> = {
  SUBMITTED: "info",
  REVIEWING: "info",
  APPROVED: "success",
  REJECTED: "danger",
  WITHDRAWN: "danger",
};

/** The three outcomes an administrator may record, in the order they read on the form. */
const DECIDABLE = ["APPROVED", "REJECTED", "REVIEWING"] as const;

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
            action={<Link href="/dashboard/applications">{common.back}</Link>}
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
    programId: `${application.program.name} (${application.program.code})`,
    previousQualification: application.previousQualification ?? common.notSet,
    notes: application.notes ?? common.notSet,
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
    student: application.student?.admissionNo ?? common.notSet,
  };

  // The credentials are only set while the applicant is still a prospect to admit.
  const openToDecide = application.status === "SUBMITTED" || application.status === "REVIEWING";
  const temporaryPassword = pages.students.create.fields.find((field) => field.name === "password");

  const decisionFields: Field[] = [
    {
      ...copy.decision.statusField,
      options: DECIDABLE.map((value) => ({ value, label: labels.applicationStatus[value] })),
    },
    ...(openToDecide && temporaryPassword ? [temporaryPassword] : []),
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
              <dd className="text-sm">{fieldValues[field.name] ?? common.notSet}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={copy.detail.decision}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-eavi-muted-text">{common.status}</dt>
            <dd className="text-sm">{decisionValues.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.student}</dt>
            <dd className="text-sm tabular-nums">{decisionValues.student}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.decidedBy}</dt>
            <dd className="text-sm">{decisionValues.decidedBy}</dd>
          </div>
          <div>
            <dt className="text-xs text-eavi-muted-text">{copy.detail.decidedAt}</dt>
            <dd className="text-sm">{decisionValues.decidedAt}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-eavi-muted-text">{copy.decision.note.label}</dt>
            <dd className="text-sm">{decisionValues.decisionNote}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={copy.decision.button} description={openToDecide ? copy.detail.admit : undefined}>
        <div className="p-4">
          <RecordForm
            id="application-decision"
            fields={decisionFields}
            action={decideApplication}
            submitLabel={copy.decision.button}
            note={copy.detail.enrollNote}
            hidden={{ applicationId: application.id }}
          />
        </div>
      </Panel>
    </div>
  );
}
