import { Bar, EmptyState, PageHeader, Panel, StatTile } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { formatDate, money } from "@/lib/format";
import { getOverview } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";

const toneFor = {
  application: (status: string) =>
    status === "APPROVED" ? "success" : status === "REJECTED" || status === "WITHDRAWN" ? "danger" : "info",
  exam: (status: string) => (status === "RELEASED" ? "success" : status === "DRAFT" ? "neutral" : "info"),
} as const;

export default async function OverviewPage() {
  const { scope, stats, deadlines, events, exams, recentStudents, announcements } = await getOverview();
  const kpis = pages.overview.kpis;
  const values: Record<(typeof kpis)[number]["key"], string> = {
    students: String(stats.students),
    activeEnrollments: String(stats.activeEnrollments),
    applicationsOpen: String(stats.applicationsOpen),
    tutors: String(stats.tutors),
    billed: money(stats.billed),
    collected: money(stats.collected),
    outstanding: money(stats.outstanding),
    cardsPending: String(stats.cardsPending),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={pages.overview.title}
        description={pages.overview.description}
        meta={<p className="mt-2 text-xs text-eavi-muted-text">{pages.overview.scopeNote(scope.campusName)}</p>}
      />

      <section aria-label={pages.overview.title} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <StatTile
            key={kpi.key}
            label={kpi.label}
            value={values[kpi.key]}
            hint={kpi.hint}
            icon={kpi.icon}
            tone={kpi.key === "applicationsOpen" || kpi.key === "cardsPending" ? "attention" : kpi.key === "collected" ? "money" : "neutral"}
          />
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={pages.overview.lists.events}>
          {events.length === 0 ? (
            <EmptyState body={pages.overview.lists.eventsEmpty} icon="calendar" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {events.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-eavi-muted-text">
                      {event.campus?.name ?? pages.calendar.events.collegeWide}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{formatDate(event.startsAt)}</span>
                    <StatusChip tone="neutral">{labels.calendarEventType[event.type]}</StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={pages.overview.lists.exams}>
          {exams.length === 0 ? (
            <EmptyState body={pages.overview.lists.examsEmpty} icon="exams" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {exams.map((exam) => (
                <li key={exam.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{exam.title}</p>
                    <p className="text-xs text-eavi-muted-text">
                      {exam.program.code} · {exam.room ?? common.notSet}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm tabular-nums">{formatDate(exam.date)}</span>
                    <StatusChip tone={toneFor.exam(exam.status)}>{labels.examStatus[exam.status]}</StatusChip>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={pages.overview.lists.deadlines}>
          {deadlines.length === 0 ? (
            <EmptyState body={pages.overview.lists.deadlinesEmpty} icon="applications" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {deadlines.map((intake) => (
                <li key={intake.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{intake.name}</p>
                    <p className="text-xs text-eavi-muted-text">{intake.term.name}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatDate(intake.applicationDeadline)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={pages.overview.lists.recentStudents}>
          {recentStudents.length === 0 ? (
            <EmptyState
              title={pages.overview.lists.recentStudents}
              body={pages.overview.lists.recentStudentsEmpty}
              icon="students"
            />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {recentStudents.map((student) => (
                <li key={student.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{student.user.fullName}</p>
                    <p className="text-xs text-eavi-muted-text">
                      {student.admissionNo} · {student.enrollments[0]?.program.name ?? common.none}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums">{formatDate(student.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={pages.overview.lists.announcements} className="lg:col-span-2">
          {announcements.length === 0 ? (
            <EmptyState
              title={pages.overview.lists.announcements}
              body={pages.overview.lists.announcementsEmpty}
              icon="communication"
            />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {announcements.map((notice) => (
                <li key={notice.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <p className="min-w-0 truncate text-sm font-medium">{notice.title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusChip tone="neutral">{labels.audience[notice.audience]}</StatusChip>
                    <span className="text-xs tabular-nums text-eavi-muted-text">
                      {formatDate(notice.publishedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={pages.reports.blocks.fees.title} className="lg:col-span-2">
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            {[
              { label: pages.accounts.summary.billed, value: stats.billed },
              { label: pages.accounts.summary.collected, value: stats.collected },
              { label: pages.accounts.summary.outstanding, value: stats.outstanding },
            ].map((row) => (
              <div key={row.label} className="space-y-2">
                <p className="text-sm text-eavi-muted-text">{row.label}</p>
                <p className="text-lg font-semibold tabular-nums">{money(row.value)}</p>
                <Bar
                  ratio={stats.billed === 0 ? 0 : row.value / stats.billed}
                  label={`${row.label}: ${money(row.value)}`}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
