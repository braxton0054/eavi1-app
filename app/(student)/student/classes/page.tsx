import { getStudentClass } from "@/lib/dal/student-portal";
import { studentPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { formatDate } from "@/lib/format";

const copy = studentPortal.classes;

export default async function StudentClassPage() {
  const { enrollment, current, previous } = await getStudentClass();

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title={copy.title} description={copy.description} />
        <EmptyState
          title={studentPortal.home.noEnrolment.title}
          body={studentPortal.home.noEnrolment.body}
          icon="students"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {!current ? (
        <EmptyState title={copy.none.title} body={copy.none.body} icon="students" />
      ) : (
        <Panel title={copy.current}>
          <dl className="divide-y divide-eavi-border">
            <Row label={copy.current} value={current.name} />
            {current.note ? <Row label={copy.note} value={current.note} muted /> : null}
            <Row
              label={copy.tutor}
              value={current.tutors.length > 0 ? current.tutors.join(", ") : copy.none.title}
              muted={current.tutors.length === 0}
            />
            <Row label={copy.members} value={String(current.classmates)} />
            <Row label={copy.joined} value={formatDate(current.joinedAt)} />
          </dl>
        </Panel>
      )}

      {previous.length > 0 ? (
        <Panel title={copy.previous}>
          <ul className="divide-y divide-eavi-border">
            {previous.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4">
                <span className="font-medium text-eavi-on-bg">{row.name}</span>
                <span className="text-sm text-eavi-muted-text">
                  {formatDate(row.joinedAt)} – {formatDate(row.leftAt)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-sm text-eavi-muted-text">{label}</dt>
      <dd className={muted ? "text-eavi-muted-text" : "font-medium text-eavi-on-bg"}>{value}</dd>
    </div>
  );
}
