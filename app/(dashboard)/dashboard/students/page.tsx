import { getStudents } from "@/lib/dal/college";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { RecordCard, RecordCardGrid, type RecordCardData } from "@/components/dashboard/record-card";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { money } from "@/lib/format";

const copy = pages.students;
const cardCopy = copy.card;

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

  const cards: RecordCardData[] = list.rows.map((student) => {
    const program = student.enrollments[0]?.program;
    const idCard = student.idCards[0];
    const owes = student.balance > 0;

    return {
      id: student.id,
      href: `/dashboard/students/${student.id}`,
      eyebrow: student.admissionNo,
      title: student.user.fullName,
      subtitle: program ? `${program.code} · ${program.name}` : cardCopy.noProgram,
      /*
       * Read through the authenticated thumbnail route, never the storage URL.
       *
       * The bucket address is not signed and does not expire, so rendering it in a list hands
       * every visitor a permanent link to a student's photograph — and bypasses the ownership
       * check the route enforces. One extra hop keeps the picture inside the portal.
       */
      avatarUrl: student.profilePhotoUrl ? `/api/chat/avatar/${student.user.id}` : null,
      avatarAlt: student.user.fullName,
      // No chip at all when no card exists: "None" next to a name says nothing, and the
      // fact line below already says the card has not been issued.
      status: idCard ? (
        <StatusChip tone={cardTone[idCard.status] ?? "neutral"}>
          {labels.cardStatus[idCard.status as keyof typeof labels.cardStatus]}
        </StatusChip>
      ) : undefined,
      facts: [
        { label: "Phone", value: student.user.phone ?? cardCopy.noPhone, tone: "muted" as const },
        {
          label: cardCopy.idCard,
          value: idCard?.serial ?? cardCopy.noCard,
          tone: "muted" as const,
        },
      ],
      // Only money owed is a figure worth colouring; a cleared account is stated plainly.
      figure: owes
        ? { label: cardCopy.balance, value: money(student.balance), danger: true }
        : { label: cardCopy.balance, value: cardCopy.cleared },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <Panel title={copy.title} description={pages.overview.scopeNote(scope.campusName)}>
        <div className="space-y-4 border-b border-eavi-border p-4">
          <ListFilters basePath="/dashboard/students" q={q} searchLabel={copy.searchLabel} />
          <ResultCount total={list.total} />
        </div>

        {cards.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="students" />
        ) : (
          <>
            {/* Stripe-style table-first on desktop; the same records become cards on a phone. */}
            <DataTable
              columns={[
                { key: "student", label: "Student" },
                { key: "programme", label: "Programme" },
                { key: "card", label: "ID card" },
                { key: "phone", label: "Phone" },
                { key: "balance", label: "Fee balance", align: "end" },
              ]}
              rows={list.rows.map((student): Row => {
                const program = student.enrollments[0]?.program;
                const idCard = student.idCards[0];
                return {
                  id: student.id,
                  href: `/dashboard/students/${student.id}`,
                  cells: {
                    student: (
                      <span className="block">
                        <span className="font-medium">{student.user.fullName}</span>
                        <span className="block text-xs text-eavi-muted-text">{student.admissionNo}</span>
                      </span>
                    ),
                    programme: program ? `${program.code} · ${program.name}` : cardCopy.noProgram,
                    card: idCard ? (
                      <StatusChip tone={cardTone[idCard.status] ?? "neutral"}>
                        {labels.cardStatus[idCard.status as keyof typeof labels.cardStatus]}
                      </StatusChip>
                    ) : cardCopy.noCard,
                    phone: student.user.phone ?? cardCopy.noPhone,
                    balance: student.balance > 0 ? money(student.balance) : cardCopy.cleared,
                  },
                };
              })}
              caption={copy.title}
              mobile={<RecordCardGrid>{cards.map((card) => (
                <RecordCard key={card.id} card={card} openLabel={cardCopy.open} />
              ))}</RecordCardGrid>}
            />
            <div className="border-t border-eavi-border p-4">
              <Paginator basePath="/dashboard/students" page={list.page} total={list.total} q={q} />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
