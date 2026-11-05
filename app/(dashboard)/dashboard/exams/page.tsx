import { createExam } from "@/lib/actions/college/exams";
import { getExams, getProgramOptions, getTermOptions, getTutorOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm } from "@/components/dashboard/record-form";
import { ListFilters } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { addMinutes, cleanTime, formatDate } from "@/lib/format";
import type { OptionSets } from "@/components/dashboard/record-form";


const copy = pages.exams;

const examTone: Record<string, ChipTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  COMPLETED: "warning",
  RELEASED: "success",
};

/** Papers store validated "HH:mm" strings; the fallback only narrows the formatter. */
const time = (value: string) => cleanTime(value) ?? value;

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; invalid?: string }>;
}) {
  const { q, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [exams, programOptions, tutorOptions, termOptions] = await Promise.all([
    getExams({ q }),
    getProgramOptions(scope.campusId),
    getTutorOptions(scope.campusId),
    getTermOptions(),
  ]);

  const options: OptionSets = { programs: programOptions, tutors: tutorOptions, terms: termOptions };

  const rows: Row[] = exams.map((exam) => ({
    id: exam.id,
    href: `/dashboard/exams/${exam.id}`,
    cells: {
      title: exam.title,
      program: `${exam.program.name} (${exam.program.code})`,
      type: labels.examType[exam.type],
      date: formatDate(exam.date),
      window: `${time(exam.startAt)}–${time(addMinutes(exam.startAt, exam.durationMinutes))}`,
      room: exam.room ?? common.notSet,
      invigilator: exam.invigilator?.user.fullName ?? pages.timetable.unassignedTutor,
      status: (
        <StatusChip tone={examTone[exam.status] ?? "neutral"}>
          {labels.examStatus[exam.status]}
        </StatusChip>
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-exam"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={options}
        action={createExam}
        submitLabel={common.create}
      />

      <Panel title={copy.title}>
        <div className="p-4">
          <ListFilters basePath="/dashboard/exams" q={q} searchLabel={copy.searchLabel} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="exams" />
        ) : (
          <DataTable columns={copy.columns} rows={rows} caption={copy.title} />
        )}
      </Panel>
    </div>
  );
}