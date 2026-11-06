import Link from "next/link";

import { getTutorToday } from "@/lib/dal/tutor";
import { labels, tutorPortal } from "@/lib/content/dashboard";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { cleanTime, formatDate } from "@/lib/format";

const copy = tutorPortal.home;

const time = (value: string) => cleanTime(value) ?? value;

export default async function TutorHomePage() {
  const { tutor, todayKey, classes, papers } = await getTutorToday();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${copy.greeting} ${tutor.fullName}`}
        description={copy.description}
        meta={<p className="mt-1 text-sm text-eavi-muted-text">{tutor.campusName}</p>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={copy.classes}>
          {todayKey === "SUNDAY" ? (
            <EmptyState title={copy.classes} body={copy.sunday} icon="timetable" />
          ) : classes.length === 0 ? (
            <EmptyState title={copy.classes} body={copy.noClasses} icon="timetable" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {classes.map((slot) => (
                <li key={slot.id} className="flex flex-col gap-1 p-4">
                  <span className="font-medium">
                    {slot.program.name} <span className="text-eavi-muted-text">({slot.program.code})</span>
                  </span>
                  <span className="text-sm text-eavi-muted-text">
                    {time(slot.startAt)}–{time(slot.endAt)} · {slot.room ?? copy.room}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={copy.papers}>
          {papers.length === 0 ? (
            <EmptyState title={copy.papers} body={copy.noPapers} icon="exams" />
          ) : (
            <ul className="divide-y divide-eavi-border">
              {papers.map((paper) => (
                <li key={paper.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <span className="flex flex-col">
                    <span className="font-medium">{paper.title}</span>
                    <span className="text-sm text-eavi-muted-text">
                      {formatDate(paper.date)} · {paper.program.name}
                    </span>
                  </span>
                  <StatusChip tone="info">{labels.examStatus[paper.status]}</StatusChip>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-eavi-border p-4 text-sm">
            <Link href="/tutor/marks" className="font-medium text-eavi-primary-text underline-offset-4 hover:underline">
              {copy.open}
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}
