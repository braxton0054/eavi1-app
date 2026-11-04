import Link from "next/link";
import type { ReactNode } from "react";

import { publishAll, saveGrade, setExamStatus } from "@/lib/actions/college/exams";
import { getExam } from "@/lib/dal/college";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RecordForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { addMinutes, cleanTime, formatDate, percent } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";

const copy = pages.exams;

const examTone: Record<string, ChipTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  COMPLETED: "warning",
  RELEASED: "success",
};

/** Papers store validated "HH:mm" strings; the fallback only narrows the formatter. */
const time = (value: string) => cleanTime(value) ?? value;

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let paper: Awaited<ReturnType<typeof getExam>> | null = null;
  try {
    paper = await getExam(id);
  } catch (error) {
    // getExam throws "not_found" for another campus's row; everything else,
    // including the sign-in redirect from requireCollegeAdmin, must keep travelling up.
    if (error instanceof Error && error.message === "not_found") paper = null;
    else throw error;
  }

  if (!paper) {
    return (
      <div className="space-y-6">
        <PageHeader title={common.notFoundTitle} description={common.notFoundBody} />
        <Panel>
          <EmptyState
            title={common.notFoundTitle}
            body={common.notFoundBody}
            icon="exams"
            action={<Link href="/dashboard/exams">{common.back}</Link>}
          />
        </Panel>
      </div>
    );
  }

  const { exam, rows } = paper;

  // The status select reuses the scheduling form's descriptor; the mark form drops the
  // enrollment picker because each row already carries its enrollment in a hidden input.
  const statusFields = copy.create.fields.filter((field) => field.name === "status");
  const markFields = copy.grades.record.fields.filter((field) => field.name !== "enrollmentId");

  const programLabel = `${exam.program.name} (${exam.program.code})`;

  const headerValues: Record<string, ReactNode> = {
    date: formatDate(exam.date),
    window: `${time(exam.startAt)}–${time(addMinutes(exam.startAt, exam.durationMinutes))}`,
    room: exam.room ?? common.notSet,
    invigilator: exam.invigilator?.user.fullName ?? pages.timetable.unassignedTutor,
    status: (
      <StatusChip tone={examTone[exam.status] ?? "neutral"}>
        {labels.examStatus[exam.status]}
      </StatusChip>
    ),
  };

  const entered = rows.filter((row) => row.grade !== null && row.grade.score !== null).length;

  const columns: Column[] = [...copy.grades.columns, { key: "actions", label: common.actions }];

  const gradeRows: Row[] = rows.map(({ enrollment, grade }) => ({
    id: enrollment.id,
    cells: {
      admissionNo: enrollment.student.admissionNo,
      student: enrollment.student.user.fullName,
      score: grade && grade.score !== null ? String(grade.score) : common.notSet,
      maxScore: grade ? String(grade.maxScore) : common.notSet,
      pct: percent(grade?.score ?? null, grade?.maxScore ?? null),
      published: grade?.published ? common.yes : common.none,
      actions: (
        <RowForm
          id={`mark-${enrollment.id}`}
          button={common.record}
          fields={markFields}
          values={{
            score: grade && grade.score !== null ? String(grade.score) : undefined,
            maxScore: grade ? String(grade.maxScore) : undefined,
            remark: grade?.remark ?? undefined,
            published: grade?.published ? "yes" : undefined,
          }}
          hidden={{ examId: exam.id, enrollmentId: enrollment.id }}
          action={saveGrade}
          submitLabel={common.record}
        />
      ),
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={exam.title}
        meta={
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-sm tabular-nums text-eavi-muted-text">
              {formatDate(exam.date)} · {headerValues.window}
            </p>
            <StatusChip tone={examTone[exam.status] ?? "neutral"}>
              {labels.examStatus[exam.status]}
            </StatusChip>
          </div>
        }
        action={
          <Link
            href="/dashboard/exams"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {common.back}
          </Link>
        }
      />

      <Panel title={copy.title} description={programLabel}>
        <dl className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
          {copy.columns
            .filter((column) => column.key !== "title" && column.key !== "program")
            .map((column) => (
              <div key={column.key}>
                <dt className="text-xs text-eavi-muted-text">{column.label}</dt>
                <dd className="text-sm">{headerValues[column.key] ?? common.notSet}</dd>
              </div>
            ))}
        </dl>
      </Panel>

      <Panel title={common.status}>
        <div className="p-4">
          <RecordForm
            id="exam-status"
            fields={statusFields}
            values={{ status: exam.status }}
            action={setExamStatus}
            submitLabel={common.update}
            hidden={{ examId: exam.id }}
          />
        </div>
      </Panel>

      <Panel title={copy.grades.heading} description={copy.grades.summary(entered, rows.length)}>
        {gradeRows.length === 0 ? (
          <EmptyState body={copy.grades.empty} icon="exams" />
        ) : (
          <>
            <DataTable columns={columns} rows={gradeRows} caption={copy.grades.heading} />
            <div className="border-t border-eavi-border p-4">
              <RowForm
                id="publish-all"
                button={copy.grades.publishAll}
                fields={[]}
                hidden={{ examId: exam.id }}
                action={publishAll}
                submitLabel={copy.grades.publishAll}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
