import { getTutorExams } from "@/lib/dal/tutor";
import { labels, tutorPortal, type Column } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { addMinutes, cleanTime, formatDate } from "@/lib/format";

const copy = tutorPortal.exams;

const examTone: Record<string, ChipTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  COMPLETED: "warning",
  RELEASED: "success",
};

const time = (value: string) => cleanTime(value) ?? value;

export default async function TutorExamsPage() {
  const exams = await getTutorExams();

  const rows: Row[] = exams.map((exam) => ({
    id: exam.id,
    cells: {
      title: exam.title,
      program: `${exam.program.name} (${exam.program.code})`,
      date: formatDate(exam.date),
      window: `${time(exam.startAt)}–${time(addMinutes(exam.startAt, exam.durationMinutes))}`,
      room: exam.room ?? tutorPortal.home.room,
      status: (
        <StatusChip tone={examTone[exam.status] ?? "neutral"}>{labels.examStatus[exam.status]}</StatusChip>
      ),
    },
  }));

  const columns: Column[] = copy.columns;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Panel title={copy.title}>
        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="exams" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={copy.title} />
        )}
      </Panel>
    </div>
  );
}
