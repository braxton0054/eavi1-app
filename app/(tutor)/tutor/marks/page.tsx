import { getTutorMarkList } from "@/lib/dal/tutor";
import { labels, tutorPortal, type Column } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";

const copy = tutorPortal.marks;

const examTone: Record<string, ChipTone> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  COMPLETED: "warning",
  RELEASED: "success",
};

export default async function TutorMarksPage() {
  const papers = await getTutorMarkList();

  const rows: Row[] = papers.map((paper) => ({
    id: paper.id,
    href: `/tutor/marks/${paper.id}`,
    cells: {
      title: paper.title,
      program: `${paper.program.name} (${paper.program.code})`,
      date: formatDate(paper.date),
      marked: copy.entered(paper._count.grades, paper.students),
      status: (
        <StatusChip tone={examTone[paper.status] ?? "neutral"}>{labels.examStatus[paper.status]}</StatusChip>
      ),
    },
  }));

  const columns: Column[] = copy.columns;

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Panel title={copy.title}>
        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="reports" />
        ) : (
          <DataTable columns={columns} rows={rows} caption={copy.title} />
        )}
      </Panel>
    </div>
  );
}
