import { getApplication, getIntakeOptions, getProgramOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { EnrolmentForm } from "@/components/enrolment-form";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import Link from "next/link";

export default async function EnrolStudentPage({
  searchParams,
}: {
  searchParams: Promise<{ application?: string }>;
}) {
  const { application: applicationId } = await searchParams;
  const scope = await requireCollegeAdmin();

  if (!applicationId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Enrol a student" />
        <Panel>
          <EmptyState title="No application selected" body="Open an application and choose Enrol." icon="students" action={<Link href="/dashboard/applications">Back to applications</Link>} />
        </Panel>
      </div>
    );
  }

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
          <EmptyState title="Application not found" body="It may belong to another campus." icon="students" action={<Link href="/dashboard/applications">Back to applications</Link>} />
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
      <PageHeader title="Enrol a student" description={`From application ${application.reference ?? ""}`} />
      <Panel>
        <div className="p-4">
          <EnrolmentForm application={application} programs={programOptions} intakes={intakeOptions} />
        </div>
      </Panel>
    </div>
  );
}