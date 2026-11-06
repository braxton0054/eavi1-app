import Link from "next/link";
import { notFound } from "next/navigation";

import { tutorPublishAll, tutorSaveGrade } from "@/lib/actions/tutor/marks";
import { getTutorExamForMarks } from "@/lib/dal/tutor";
import { common, tutorPortal, type Column } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { RecordForm, RowForm } from "@/components/dashboard/record-form";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { formatDate, percent } from "@/lib/format";

const copy = tutorPortal.entry;

export default async function TutorMarkEntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invalid?: string }>;
}) {
  const { id } = await params;
  const { invalid } = await searchParams;

  const found = await getTutorExamForMarks(id);
  if (!found) notFound();
  const { exam, rows: students } = found;

  const rows: Row[] = students.map((student) => {
    const grade = student.grade;
    const formId = `grade-${student.enrollmentId}`;
    return {
      id: student.enrollmentId,
      cells: {
        admissionNo: student.admissionNo,
        student: student.fullName,
        score: grade ? String(grade.score) : common.notSet,
        maxScore: grade ? String(grade.maxScore) : common.notSet,
        pct: grade ? percent(grade.score, grade.maxScore) : common.notSet,
        published: grade?.published ? (
          <StatusChip tone="success">{copy.yes}</StatusChip>
        ) : (
          <StatusChip tone="neutral">{copy.no}</StatusChip>
        ),
        actions: (
          <RowForm
            id={formId}
            button={grade ? common.update : common.record}
            fields={copy.fields}
            values={{
              score: grade ? String(grade.score) : undefined,
              maxScore: grade ? String(grade.maxScore) : copy.defaultMaxScore,
              remark: grade?.remark ?? undefined,
              published: grade?.published ? "yes" : undefined,
            }}
            hidden={{ examId: exam.id, enrollmentId: student.enrollmentId }}
            action={tutorSaveGrade}
            submitLabel={common.save}
          />
        ),
      },
    };
  });

  const columns: Column[] = copy.columns;

  return (
    <div className="space-y-6">
      <Link href="/tutor/marks" className="text-sm text-eavi-primary-text underline-offset-4 hover:underline">
        ← {copy.back}
      </Link>

      <PageHeader
        title={exam.title}
        description={`${exam.program.name} (${exam.program.code}) · ${formatDate(exam.date)}`}
        action={
          <RecordForm
            id="publish-all"
            fields={[]}
            hidden={{ examId: exam.id }}
            action={tutorPublishAll}
            submitLabel={copy.publish}
          />
        }
      />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <Panel title={exam.title}>
        {rows.length === 0 ? (
          <EmptyState title={exam.title} body={copy.empty} icon="reports" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={exam.title} />
        )}
      </Panel>
    </div>
  );
}
