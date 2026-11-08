import { getStudentProfile } from "@/lib/dal/student-portal";
import { studentPortal } from "@/lib/content/dashboard";
import { Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { formatDate } from "@/lib/format";

const copy = studentPortal.profile;

export default async function StudentProfilePage() {
  const { profile } = await getStudentProfile();

  if (!profile) {
    return (
      <div className="space-y-6">
        <PageHeader title={copy.title} description={copy.description} />
        <Notice tone="warning" title={copy.title} body={copy.changeNote} />
      </div>
    );
  }

  const name = profile.user.fullName;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Panel title={name}>
        <dl className="divide-y divide-eavi-border">
          <Row label={copy.admissionNo} value={profile.admissionNo} />
          <Row label={copy.campus} value={profile.campus.name} />
          <Row label={copy.email} value={profile.user.email ?? copy.notSet} />
          <Row label={copy.phone} value={profile.user.phone ?? copy.notSet} />
          <Row
            label={copy.gender}
            value={profile.gender ? (copy.genderLabel[profile.gender] ?? profile.gender) : copy.notSet}
          />
          <Row label={copy.dob} value={formatDate(profile.dateOfBirth)} />
          <Row label={copy.guardian} value={profile.guardianName ?? copy.notSet} />
          <Row label={copy.guardianPhone} value={profile.guardianPhone ?? copy.notSet} />
          <Row label={copy.address} value={profile.address ?? copy.notSet} />
        </dl>
      </Panel>

      <Notice tone="neutral" title={copy.title} body={copy.changeNote} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const missing = value === copy.notSet;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-sm text-eavi-muted-text">{label}</dt>
      <dd className={missing ? "text-eavi-muted-text" : "font-medium text-eavi-on-bg"}>{value}</dd>
    </div>
  );
}
