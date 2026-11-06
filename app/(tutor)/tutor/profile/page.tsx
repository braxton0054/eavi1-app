import { getTutorProfile } from "@/lib/dal/tutor";
import { common, tutorPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";

const copy = tutorPortal.profile;

export default async function TutorProfilePage() {
  const { profile, weeklyHours } = await getTutorProfile();

  if (!profile) {
    return <EmptyState title={copy.title} body={copy.description} icon="profile" />;
  }

  const details = [
    { label: copy.staffNo, value: profile.staffNo },
    { label: copy.department, value: profile.department ?? common.notSet },
    { label: copy.campus, value: profile.campus.name },
    { label: copy.email, value: profile.user.email },
    { label: copy.weeklyHours, value: String(weeklyHours) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Panel title={copy.title}>
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="space-y-1">
              <dt className="text-xs text-eavi-muted-text">{item.label}</dt>
              <dd className="font-medium">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title={copy.programmes}>
        {profile.programs.length === 0 ? (
          <p className="p-5 text-sm text-eavi-muted-text">{copy.noProgrammes}</p>
        ) : (
          <ul className="divide-y divide-eavi-border">
            {profile.programs.map((program) => (
              <li key={program.code} className="p-4 text-sm">
                {program.name} <span className="text-eavi-muted-text">({program.code})</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
