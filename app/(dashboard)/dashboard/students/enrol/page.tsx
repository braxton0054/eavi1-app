import { getApplication, getApplications, getIntakeOptions, getProgramOptions } from "@/lib/dal/college";
import { getClassOptions, getPlacementOptionsByProgram } from "@/lib/dal/classes";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { EnrolmentForm } from "@/components/enrolment-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { shell } from "@/lib/content/dashboard";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
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

  // Classes and stages follow the programme the student is being enrolled on, so every
  // offered programme carries its own stage list and the form switches between them.
  const [classOptions, placementsByProgram] = await Promise.all([
    getClassOptions(scope.campusId),
    getPlacementOptionsByProgram(programOptions.map((option) => option.value)),
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
      if (!enrolledIds.has(app.id)) {
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
    } catch (error) {
      // A bare catch here once hid a real failure: the office saw an empty form with no
      // explanation. Log it so the cause is in the server log, never silently dropped.
      console.error("enrol: could not load application", applicationId, error);
      selectedApplication = null;
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={selectedApplication ? `Enrol ${selectedApplication.fullName}` : "New enrolment"}
        description={
          selectedApplication
            ? `Application ${selectedApplication.reference} · ${selectedApplication.program.name}`
            : "Pick an application to auto-fill the form, or fill it in manually."
        }
        action={
          <Link
            href="/dashboard/enrollments"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            Back to enrolments
          </Link>
        }
      />

      {scope.campusId === null ? (
        <Notice tone="neutral" title="New enrolment" body={shell.chooseCampus} />
      ) : (
        <Panel>
          <div className="p-4 sm:p-6">
            <EnrolmentForm
              application={selectedApplication}
              applications={availableApps}
              programs={programOptions}
              intakes={intakeOptions}
              classes={classOptions}
              placementsByProgram={placementsByProgram}
            />
          </div>
        </Panel>
      )}

      {scope.campusId !== null && !selectedApplication && availableApps.length === 0 && (
        <Panel>
          <EmptyState title="No pending applications" body="All applications have been enrolled, or none have been submitted yet." icon="students" action={<ShimmerButton asChild><Link href="/dashboard/applications">Go to applications</Link></ShimmerButton>} />
        </Panel>
      )}
    </div>
  );
}
