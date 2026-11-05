import { getApplication, getApplications, getIntakeOptions, getProgramOptions } from "@/lib/dal/college";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { EnrolmentForm } from "@/components/enrolment-form";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { labels } from "@/lib/content/dashboard";
import Link from "next/link";

export default async function EnrolStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const { application: applicationId } = await searchParams;
  const scope = await requireCollegeAdmin();

  if (applicationId) {
    let application;
    try {
      application = await getApplication(applicationId);
    } catch {
      application = null;
    }

    if (!application) {
      return (
        <div className="space-y-6">
          <PageHeader title="Enrol a student" />
          <Panel>
            <EmptyState title="Application not found" body="It may belong to another campus." icon="students" action={<Link href="/dashboard/students/enrol">Back to list</Link>} />
          </Panel>
        </div>
      );
    }

    const existing = await prisma.studentProfile.findUnique({ where: { applicationId } });
    if (existing) {
      return (
        <div className="space-y-6">
          <PageHeader title="Enrol a student" />
          <Panel>
            <EmptyState title="Already enrolled" body="This application has already been converted to a student." icon="students" action={<Link href="/dashboard/students/enrol">Back to list</Link>} />
          </Panel>
        </div>
      );
    }

    const [programOptions, intakeOptions] = await Promise.all([
      getProgramOptions(scope.campusId),
      getIntakeOptions(),
    ]);

    return (
      <div className="space-y-6">
        <PageHeader title="Enrol a student" description={`From application ${application.reference}`} />
        <Panel>
          <div className="p-4">
            <EnrolmentForm application={application} programs={programOptions} intakes={intakeOptions} />
          </div>
        </Panel>
      </div>
    );
  }

  // No application selected: show available applications to enrol.
  const { rows } = await getApplications({ page: 1 });
  const enrolledIds = new Set(
    (await prisma.studentProfile.findMany({ where: { applicationId: { not: null } }, select: { applicationId: true } }))
      .map((r) => r.applicationId as string),
  );

  const available = rows.filter((a) => !enrolledIds.has(a.id));

  return (
    <div className="space-y-6">
      <PageHeader title="Enrol a student" description="Select an application to convert into a student record." />
      {available.length === 0 ? (
        <Panel>
          <EmptyState title="No applications to enrol" body="All applications have been enrolled, or none have been submitted yet." icon="students" action={<Link href="/dashboard/applications">Go to applications</Link>} />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-eavi-border">
            {available.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{app.fullName}</p>
                  <p className="text-xs text-eavi-muted-text">
                    {app.reference} · {app.program.name} ({app.program.code}) ·{" "}
                    <StatusChip tone="info">{labels.applicationStatus[app.status]}</StatusChip>
                  </p>
                </div>
                <Link
                  href={`/dashboard/students/enrol?application=${app.id}`}
                  className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill"
                >
                  Enrol
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}