import { createCard, moveCard } from "@/lib/actions/college/cards";
import { getCards, getProgramOptions, getStudentOptions } from "@/lib/dal/college";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { DisclosureForm, RowForm, type OptionSets } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";
import type { Column } from "@/lib/content/dashboard";


const copy = pages.cards;

const cardTone: Record<string, ChipTone> = {
  PENDING: "warning",
  PRINTING: "warning",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "neutral",
};

/** The card face is a print layout, so it reuses the summary control from `RowForm`. */
const detail =
  "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; invalid?: string }>;
}) {
  const { q, status, page, invalid } = await searchParams;
  const scope = await requireCollegeAdmin();

  const [list, studentOptions, programOptions] = await Promise.all([
    getCards({ q, status, page: Number(page) || 1 }),
    getStudentOptions(scope.campusId),
    getProgramOptions(scope.campusId),
  ]);

  const options: OptionSets = { students: studentOptions, programs: programOptions };

  const statuses = Object.entries(labels.cardStatus).map(([value, label]) => ({ value, label }));

  const columns: Column[] = [...copy.columns, { key: "actions", label: common.actions }];

  const rows: Row[] = list.rows.map((card) => {
    const programme = card.program?.name ?? card.student.enrollments[0]?.program.name ?? common.none;

    const face = [
      { label: copy.print.studentLabel, value: card.student.admissionNo },
      { label: copy.print.programmeLabel, value: programme },
      { label: copy.print.campusLabel, value: scope.campusName },
      { label: copy.print.serialLabel, value: card.serial },
      { label: copy.print.validLabel, value: card.expiresAt ? formatDate(card.expiresAt) : common.notSet },
    ];

    return {
      id: card.id,
      cells: {
        serial: card.serial,
        student: `${card.student.admissionNo} · ${card.student.user.fullName}`,
        program: programme,
        status: (
          <StatusChip tone={cardTone[card.status] ?? "neutral"}>{labels.cardStatus[card.status]}</StatusChip>
        ),
        issuedAt: card.issuedAt ? formatDate(card.issuedAt) : common.notSet,
        expiresAt: card.expiresAt ? formatDate(card.expiresAt) : common.notSet,
        actions: (
          <div className="flex flex-wrap items-start gap-2">
            <RowForm
              id={`card-${card.id}-move`}
              button={copy.move.title}
              fields={[copy.move.statusField]}
              values={{ status: card.status }}
              hidden={{ cardId: card.id }}
              action={moveCard}
              submitLabel={common.update}
            />

            <details>
              <summary className={detail}>{copy.print.open}</summary>
              <div className="mt-2 w-full max-w-xs rounded-xl border border-eavi-border bg-eavi-card p-4 shadow-eavi-card">
                <p className="text-xs text-eavi-muted-text">{copy.print.heading}</p>
                <p className="mt-1 text-sm font-semibold tracking-tight">{copy.print.institution}</p>
                <p className="mt-2 text-sm font-medium">{card.student.user.fullName}</p>
                <dl className="mt-2 space-y-1">
                  {face.map((line) => (
                    <div key={line.label} className="flex items-baseline justify-between gap-3">
                      <dt className="shrink-0 text-xs text-eavi-muted-text">{line.label}</dt>
                      <dd className="min-w-0 truncate text-xs">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </details>
          </div>
        ),
      },
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}

      <DisclosureForm
        id="new-card"
        button={copy.create.button}
        title={copy.create.title}
        fields={copy.create.fields}
        options={options}
        action={createCard}
        submitLabel={common.create}
      />

      <Panel title={copy.title} description={pages.overview.scopeNote(scope.campusName)}>
        <div className="space-y-4 p-4">
          <ListFilters
            basePath="/dashboard/cards"
            q={q}
            status={status}
            statuses={statuses}
            searchLabel={copy.searchLabel}
          />
          <ResultCount total={list.total} />
        </div>

        {rows.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="cards" />
        ) : (
          <>
            <DataTable columns={columns} rows={rows} caption={copy.title} />
            <div className="border-t border-eavi-border p-4">
              <Paginator
                basePath="/dashboard/cards"
                page={list.page}
                total={list.total}
                q={q}
                status={status}
              />
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
