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

  const [apps, programOptions, intakeOptions] = await Promise.all([
    getApplications({ page: 1 }),
    getProgramOptions(scope.campusId),
    getIntakeOptions(),
  ]);

  const enrolledIds = new Set(
    (await prisma.studentProfile.findMany({ where: { applicationId: { not: null } }, select: { applicationId: true } }))
      .map((r) => r.applicationId as string),
  );

  const availableApps = apps.rows
    .filter((a) => !enrolledIds.has(a.id))
    .map((a) => ({
      id: a.id,
      fullName: a.fullName,
      email: a.email,
      phone: a.phone,
      gender: a.gender,
      program: { id: a.programId, name: a.program.name, code: a.program.code },
      campus: null,
      reference: a.reference,
    }));

  let selectedApplication = null;
  if (applicationId) {
    try {
      const app = await getApplication(applicationId);
      const isEnrolled = enrolledIds.has(app.id);
      if (!isEnrolled) {
        selectedApplication = {
          id: app.id,
          fullName: app.fullName,
          email: app.email,
          phone: app.phone,
          gender: app.gender,
          program: { id: app.program.id, name: app.program.name, code: app.program.code },
          campus: app.campus ? { name: app.campus.name } : null,
          reference: app.reference,
        };
      }
    } catch {
      selectedApplication = null;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Enrol a student" description="Convert an application into a registered student record." />
      <Panel>
        <div className="p-4">
          <EnrolmentForm application={selectedApplication} applications={availableApps} programs={programOptions} intakes={intakeOptions} />
        </div>
      </Panel>

      {availableApps.length > 0 && !selectedApplication && (
        <Panel title="Pending applications">
          <ul className="divide-y divide-eavi-border">
            {availableApps.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{app.fullName}</p>
                  <p className="text-xs text-eavi-muted-text">{app.reference} · {app.program.name} ({app.program.code})</p>
                </div>
                <Link href={`/dashboard/students/enrol?application=${app.id}`} className="inline-flex min-h-11 items-center rounded-lg bg-eavi-fill px-4 text-sm font-medium text-eavi-on-fill">
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