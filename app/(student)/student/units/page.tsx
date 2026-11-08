import { getStudentUnits } from "@/lib/dal/student-portal";
import { labels, studentPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";

const copy = studentPortal.units;

/** A unit's standing, read the same way the tutor screens read it. */
const unitTone: Record<string, ChipTone> = {
  COMPLETED: "success",
  IN_PROGRESS: "info",
  REGISTERED: "info",
  FAILED: "danger",
  DEFERRED: "warning",
};

export default async function StudentUnitsPage() {
  const { enrollment, years } = await getStudentUnits();

  if (!enrollment) {
    return (
      <div className="space-y-6">
        <PageHeader title={copy.title} description={copy.description} />
        <EmptyState
          title={studentPortal.home.noEnrolment.title}
          body={studentPortal.home.noEnrolment.body}
          icon="programs"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {years.length === 0 ? (
        <EmptyState title={copy.title} body={copy.empty} icon="programs" />
      ) : (
        years.map((year) => (
          <section key={year.yearIndex} className="space-y-4">
            {year.yearIndex > 0 ? (
              <h2 className="text-sm font-semibold text-eavi-muted-text">
                Year {year.yearIndex}
              </h2>
            ) : null}

            {year.semesters.map((semester) => (
              <Panel
                key={semester.semesterNo}
                title={
                  semester.semesterNo > 0
                    ? `Semester ${semester.semesterNo}${semester.current ? ` · ${copy.thisSemester}` : ""}`
                    : copy.other
                }
                /* The semester the student is in now is marked in words, not by colour alone. */
                description={semester.current ? copy.thisSemester : undefined}
              >
                <ul className="divide-y divide-eavi-border">
                  {semester.units.map((unit) => (
                    <li key={unit.id} className="flex items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <p className="font-medium text-eavi-on-bg">{unit.title}</p>
                        <p className="mt-0.5 text-sm text-eavi-muted-text">{unit.code}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusChip tone={unitTone[unit.status] ?? "neutral"}>
                          {labels.unitStatus[unit.status as keyof typeof labels.unitStatus] ?? unit.status}
                        </StatusChip>
                        {unit.grade ? (
                          <span className="text-sm text-eavi-muted-text tabular-nums">
                            {unit.grade}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
