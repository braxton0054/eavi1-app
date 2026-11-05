import { getStudents } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { money } from "@/lib/format";



const copy = pages.students;

/** Card pipeline stages read left to right, so the chip colour follows the stage. */
const cardTone: Record<string, ChipTone> = {
  PENDING: "neutral",
  PRINTING: "info",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "warning",
};

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; invalid?: string }>;
}) {
  const { q, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const list = await getStudents({ q, page: Number(page) || 1 });

  const rows: Row[] = list.rows.map((student) => {
    const program = student.enrollments[0]?.program;
    const card = student.idCards[0];

    return {
      id: student.id,
      href: `/dashboard/students/${student.id}`,
      cells: {
        admissionNo: student.admissionNo,
        fullName: student.user.fullName,
        contact: (
          <span className="flex flex-col">
            <span>{student.user.email}</span>
            {student.user.phone ? (
              <span className="text-xs text-eavi-muted-text">{student.user.phone}</span>
            ) : null}
          </span>
        ),
        program: program ? `${program.name} (${program.code})` : common.notSet,
        account: (
          <span className={student.balance > 0 ? "text-eavi-destructive" : undefined}>
            {money(student.balance)}
          </span>
        ),
        card: card ? (
          <StatusChip tone={cardTone[card.status] ?? "neutral"}>
            {labels.cardStatus[card.status as keyof typeof labels.cardStatus]}
          </StatusChip>
        ) : (
          common.none
        ),
      },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <Panel title={copy.title} description={pages.overview.scopeNote(scope.campusName)}>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/students"
            q={q}
            searchLabel={copy.searchLabel}
          />
          <ResultCount total={list.total} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="students" />
        ) : (
          <>
            <DataTable columns={copy.columns} rows={rows} caption={copy.title} />
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/students"
                page={list.page}
                total={list.total}
                q={q}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
