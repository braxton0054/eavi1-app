import Link from "next/link";

import { getStudentOverview } from "@/lib/dal/student-portal";
import { studentPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { formatDate } from "@/lib/format";

const copy = studentPortal.home;

/** Money as the student reads it: grouped thousands, no cents unless there are any. */
const kwacha = (value: number) =>
  `KSh ${value.toLocaleString("en-KE", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export default async function StudentHomePage() {
  const { student, enrollment, place, units, fees, classroom } = await getStudentOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${copy.greeting} ${student.fullName}`}
        description={copy.description}
        meta={
          <p className="mt-1 text-sm text-eavi-muted-text">
            {student.admissionNo} · {student.campusName}
          </p>
        }
      />

      {/*
        An active account with no enrolment is not an error: they have registered but the office
        has not placed them yet. Saying so plainly beats showing four empty panels.
      */}
      {!enrollment ? (
        <EmptyState title={copy.noEnrolment.title} body={copy.noEnrolment.body} icon="enrollments" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={copy.course}>
              <dl className="divide-y divide-eavi-border">
                <Row label={copy.course} value={enrollment.program.name} />
                <Row label={copy.intake} value={enrollment.period.name} />
                <Row
                  label={copy.place}
                  value={`${copy.year} ${place.yearIndex} · ${copy.semester} ${place.semesterNo}`}
                />
                <Row
                  label={copy.class}
                  value={classroom ? classroom.name : copy.noClass}
                  muted={!classroom}
                />
              </dl>
            </Panel>

            <Panel
              title={copy.fees}
              aside={
                <Link
                  href="/student/fees"
                  className="text-sm font-medium text-eavi-accent underline-offset-4 hover:underline"
                >
                  {copy.seeFees}
                </Link>
              }
            >
              <dl className="divide-y divide-eavi-border">
                <Row
                  label={copy.balance}
                  value={
                    !fees.hasInvoices
                      ? copy.noDue
                      : fees.balance > 0
                        ? kwacha(fees.balance)
                        : copy.cleared
                  }
                  tone={fees.hasInvoices && fees.balance > 0 ? "warn" : undefined}
                />
                <Row
                  label={copy.nextDue}
                  value={
                    fees.nextDueAt
                      ? `${formatDate(fees.nextDueAt)}${fees.nextDueAmount ? ` · ${kwacha(fees.nextDueAmount)}` : ""}`
                      : copy.noDue
                  }
                  muted={!fees.nextDueAt}
                />
              </dl>
            </Panel>
          </div>

          <Panel
            title={copy.units}
            aside={
              <Link
                href="/student/units"
                className="text-sm font-medium text-eavi-accent underline-offset-4 hover:underline"
              >
                {copy.seeAll}
              </Link>
            }
          >
            {units.length === 0 ? (
              <EmptyState title={copy.units} body={copy.noUnits} icon="programs" />
            ) : (
              <ul className="divide-y divide-eavi-border">
                {units.map((unit) => (
                  <li key={unit.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-eavi-on-bg">{unit.title}</p>
                      <p className="mt-0.5 text-sm text-eavi-muted-text">{unit.code}</p>
                    </div>
                    <span className="shrink-0 text-sm text-eavi-muted-text tabular-nums">
                      {unit.grade ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

/**
 * One labelled line of the student's own record. Rendered as a definition list so the label
 * and its value stay associated for a screen reader.
 */
function Row({
  label,
  value,
  muted = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-sm text-eavi-muted-text">{label}</dt>
      <dd
        className={
          tone === "warn"
            ? "font-semibold text-eavi-warn-text"
            : muted
              ? "text-eavi-muted-text"
              : "font-medium text-eavi-on-bg"
        }
      >
        {value}
      </dd>
    </div>
  );
}
