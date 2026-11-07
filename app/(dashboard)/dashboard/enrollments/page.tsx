import Link from "next/link";

import { promoteEnrollment, setEnrollmentStatus } from "@/lib/actions/college/enrollments";
import { getApplications, getEnrollments } from "@/lib/dal/college";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { RowForm } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { RecordCard, RecordCardGrid, type RecordCardData } from "@/components/dashboard/record-card";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import { periodLabel } from "@/lib/academics/progression";

const copy = pages.enrollments;
const cardCopy = copy.card;

const enrollmentTone: Record<string, ChipTone> = {
  ACTIVE: "success",
  SUSPENDED: "warning",
  COMPLETED: "info",
  WITHDRAWN: "danger",
};

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string }>;
}) {
  const { q, status, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, apps] = await Promise.all([
    getEnrollments({ q, status, page: Number(page) || 1 }),
    getApplications({ q, page: 1 }),
  ]);

  const enrolledIds = new Set(
    (await prisma.studentProfile.findMany({ where: { applicationId: { not: null } }, select: { applicationId: true } }))
      .map((r) => r.applicationId as string),
  );
  const availableApps = apps.rows.filter((a) => !enrolledIds.has(a.id)).slice(0, 8);

  const statuses = Object.entries(labels.enrollmentStatus).map(([value, label]) => ({
    value,
    label,
  }));

  // One enrolment, one card. The status form stays on the card so suspending a student is
  // still one tap from the list; the rest of the record is behind the card's link.
  const cards: RecordCardData[] = list.rows.map((enrollment) => ({
    id: enrollment.id,
    href: `/dashboard/students/${enrollment.student.id}`,
    eyebrow: enrollment.student.admissionNo,
    title: enrollment.student.user.fullName,
    subtitle: `${enrollment.program.code} · ${enrollment.program.name}`,
    status: (
      <StatusChip tone={enrollmentTone[enrollment.status] ?? "neutral"}>
        {labels.enrollmentStatus[enrollment.status]}
      </StatusChip>
    ),
    facts: [
      {
        label: cardCopy.intake,
        // The cohort names the month the student joined, which is what staff go by.
        value: enrollment.intake.name,
        tone: "muted" as const,
        showLabel: true,
      },
      {
        // The student's own period, counted from their intake — not the campus semester.
        label: cardCopy.period,
        value: periodLabel({
          yearIndex: enrollment.yearIndex,
          semesterNo: enrollment.semesterNo,
        }),
        tone: "default" as const,
        showLabel: true,
      },
    ],
    figure: { label: cardCopy.enrolled, value: formatDate(enrollment.enrolledAt) },
    action: (
      <span className="flex flex-wrap items-center gap-2">
        <RowForm
          id={`enrollment-${enrollment.id}-status`}
          button={copy.update.title}
          fields={[copy.update.statusField]}
          values={{ status: enrollment.status }}
          hidden={{ enrollmentId: enrollment.id }}
          action={setEnrollmentStatus}
          submitLabel={common.update}
        />
        {/* Progression normally advances on its own; this is for the deliberate case. */}
        <RowForm
          id={`enrollment-${enrollment.id}-promote`}
          button={cardCopy.promoteButton}
          fields={[]}
          hidden={{ enrollmentId: enrollment.id }}
          action={promoteEnrollment}
          submitLabel={cardCopy.promote}
        />
      </span>
    ),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description="Search once at the top — it filters both the pending applications and the enrolled students."
        action={
          <Link
            href="/dashboard/students/enrol"
            className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
          >
            New enrolment
          </Link>
        }
      />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      {/* THE one and only search — top of page, filters everything below */}
      <Panel>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/enrollments"
            q={q}
            status={status}
            statuses={statuses}
            searchLabel="Search applications and enrolled students…"
          />
        </div>
      </Panel>

      {/* Pending applications */}
      <Panel
        title="Applications waiting to be enrolled"
        description="Start the two-step enrolment form for one of these."
        aside={
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-eavi-primary-soft px-3 py-1 text-xs font-medium text-eavi-primary-text">
              {availableApps.length} pending
            </span>
            <Link
              href="/dashboard/applications"
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-xs font-medium text-eavi-primary-text hover:bg-eavi-muted"
            >
              All applications →
            </Link>
          </span>
        }
      >
        {availableApps.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">No pending applications match. New submissions will appear here once logged.</p>
        ) : (
          <ul className="divide-y divide-eavi-border">
            {availableApps.map((app) => (
              <li key={app.id} className="flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm leading-tight font-medium sm:truncate">{app.fullName}</p>
                  <p className="text-xs leading-tight text-eavi-muted-text sm:truncate">
                    {app.reference} · {app.program.name} ({app.program.code})
                  </p>
                </div>
                <Link
                  href={`/dashboard/students/enrol?application=${app.id}`}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill sm:w-auto sm:justify-start"
                >
                  Start enrolment
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Enrolled students */}
      <Panel title="Enrolled students" description={pages.overview.scopeNote(scope.campusName)}>
        <div className="border-b border-eavi-border p-4">
          <ResultCount total={list.total} />
        </div>

        {cards.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="enrollments" />
        ) : (
          <>
            <RecordCardGrid>
              {cards.map((card) => (
                <RecordCard key={card.id} card={card} openLabel={cardCopy.open} />
              ))}
            </RecordCardGrid>
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/enrollments"
                page={list.page}
                total={list.total}
                q={q}
                status={status}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
