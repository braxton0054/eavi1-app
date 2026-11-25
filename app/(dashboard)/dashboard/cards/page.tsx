import Link from "next/link";

import { moveCard } from "@/lib/actions/college/cards";
import { getCards, getStudentOptions } from "@/lib/dal/college";
import { getCardCandidates } from "@/lib/dal/cards";
import { getClassOptions, getIntakeChoices } from "@/lib/dal/classes";
import { CardGenerator } from "@/components/dashboard/card-generator";
import { ensureDocument } from "@/lib/documents/service";
import { savedCardFaces } from "@/lib/documents/renderers";
import { syncCardTemplate } from "@/lib/cards/template-version";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { RecordCard, RecordCardGrid, type RecordCardData } from "@/components/dashboard/record-card";
import { prisma } from "@/lib/prisma";
import { RowForm } from "@/components/dashboard/record-form";
import { ListFilters, Paginator, ResultCount } from "@/components/dashboard/list-tools";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip } from "@/components/dashboard/status-chip";
import { formatDate } from "@/lib/format";


const copy = pages.cards;


/** The card face is a print layout, so it reuses the summary control from `RowForm`. */
const detail =
  "inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg border border-eavi-border px-3 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden";

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    invalid?: string;
    empty?: string;
    tooMany?: string;
    ready?: string;
  }>;
}) {
  const { q, status, page, invalid, empty, tooMany, ready } = await searchParams;
  const scope = await requireCollegeAdmin();

  // Opening the card register is where a changed template is noticed: it refreshes every
  // saved card in the background, never through a button on this page.
  await syncCardTemplate().catch(() => null);

  const [list, studentOptions, classChoices, intakeChoices] = await Promise.all([
    getCards({ q, status, page: Number(page) || 1 }),
    getStudentOptions(scope.campusId),
    getClassOptions(scope.campusId),
    getIntakeChoices(),
  ]);

  // The picker shows who each choice would print before anything is generated. Every
  // target's list is resolved here so changing the picker needs no round trip.
  const targets = [
    ...studentOptions.map((o) => ({ kind: "student", id: o.value })),
    ...classChoices.map((o) => ({ kind: "class", id: o.value })),
    ...intakeChoices.map((o) => ({ kind: "intake", id: o.id })),
  ];
  const resolved = await Promise.all(
    targets.map((t) =>
      getCardCandidates(
        t.kind === "student"
          ? { kind: "student", studentId: t.id }
          : t.kind === "class"
            ? { kind: "class", classId: t.id }
            : { kind: "intake", intakeId: t.id },
        scope.campusId,
      ),
    ),
  );
  const candidatesByTarget = Object.fromEntries(
    targets.map((t, i) => [`${t.kind}:${t.id}`, resolved[i]]),
  );

  // Past runs, so a batch generated last week can be reopened without regenerating it.
  const batches = await prisma.cardBatch.findMany({
    where: scope.campusId === null ? {} : { campusId: scope.campusId },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { id: true, targetLabel: true, cardCount: true, sheetCount: true, createdAt: true },
  });


  const statuses = Object.entries(labels.cardStatus).map(([value, label]) => ({ value, label }));

  // Previews come from the saved card documents. Opening this list never re-merges the
  // artwork: a card is a record, and the record is what the office sees and prints.
  const documents = await Promise.all(
    list.rows.map((card) => ensureDocument("ID_CARD", card.id)),
  );
  const faceByCard = new Map(
    list.rows.map((card, index) => [
      card.id,
      documents[index] ? savedCardFaces(documents[index]!.svgText) : null,
    ]),
  );

  // One card, one record card — the same treatment as programmes, students and invoices.
  // The whole card opens the card's own page, and the actions stay in the footer strip so a
  // record never needs a row menu.
  const cards: RecordCardData[] = list.rows.map((card) => {
    const programme = card.program?.name ?? card.student.enrollments[0]?.program.name ?? common.none;
    const faceData = faceByCard.get(card.id) ?? null;

    const face = [
      { label: copy.print.studentLabel, value: card.student.admissionNo },
      { label: copy.print.programmeLabel, value: programme },
      { label: copy.print.campusLabel, value: scope.campusName },
      { label: copy.print.serialLabel, value: card.serial },
      { label: copy.print.validLabel, value: card.expiresAt ? formatDate(card.expiresAt) : common.notSet },
    ];

    const action = (
      <div className="flex w-full flex-wrap items-start gap-2">
        <RowForm
          id={`card-${card.id}-move`}
          button={copy.move.title}
          fields={[copy.move.statusField]}
          values={{ status: card.status }}
          hidden={{ cardId: card.id }}
          action={moveCard}
          submitLabel={common.update}
        />

        <details className="min-w-0">
          <summary className={detail}>{copy.print.open}</summary>
          <div className="mt-2 w-[18rem] max-w-full rounded-xl border border-eavi-border bg-eavi-card p-3 text-xs shadow-eavi-card">
            <p className="text-xs text-eavi-muted-text">{copy.print.heading}</p>
            {faceData?.frontSvg ? (
              // The artwork is the campus's own file, inlined so the browser renders the
              // real card rather than a redesign of it.
              <div className="mt-2 space-y-2">
                <div
                  className="w-full overflow-hidden rounded-md ring-1 ring-eavi-border [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: faceData.frontSvg }}
                />
                <div
                  className="w-full overflow-hidden rounded-md ring-1 ring-eavi-border [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: faceData.backSvg }}
                />
              </div>
            ) : null}
            <dl className="mt-2 space-y-1">
              {face.map((line) => (
                <div key={line.label} className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0 text-xs text-eavi-muted-text">{line.label}</dt>
                  <dd className="min-w-0 text-xs text-right sm:truncate">{line.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      </div>
    );

    return {
      id: card.id,
      href: `/dashboard/cards/${card.id}`,
      eyebrow: card.serial,
      title: card.student.user.fullName,
      subtitle: card.student.admissionNo,
      status: (
        // The chip is the STUDENT's state (enrolled or not) — the authoritative enrolment,
        // never the card's print lifecycle. The print state stays as the small line under
        // it, so the office still sees which cards await printing without an enrolled
        // student ever being told "PENDING".
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={card.student.enrollments.length > 0 ? "success" : "neutral"}>
            {card.student.enrollments.length > 0 ? "Enrolled" : "Not enrolled"}
          </StatusChip>
          <span className="text-[11px] text-eavi-muted-text">
            Card: {labels.cardStatus[card.status] ?? card.status}
          </span>
        </span>
      ),
      facts: [
        { label: copy.print.programmeLabel, value: programme, showLabel: true },
        {
          label: copy.print.validLabel,
          value: card.expiresAt ? formatDate(card.expiresAt) : common.notSet,
          showLabel: true,
          tone: "muted" as const,
        },
        {
          label: "Issued",
          value: card.issuedAt ? formatDate(card.issuedAt) : common.notSet,
          showLabel: true,
          tone: "muted" as const,
        },
      ],
      action,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}
      {empty ? <Notice tone="warning" title={copy.generate.title} body={copy.generate.limits.empty} /> : null}
      {tooMany ? <Notice tone="warning" title={copy.generate.title} body={copy.generate.limits.tooMany} /> : null}
      {ready ? <Notice tone="success" title={copy.generate.title} body={copy.generate.limits.saved} /> : null}

      <Panel title={copy.generate.title} description={copy.generate.hint}>
        <div className="p-4">
          <CardGenerator
            students={studentOptions}
            classes={classChoices.map((c) => ({ value: c.value, label: c.label }))}
            intakes={intakeChoices.map((i) => ({ value: i.id, label: i.label }))}
            candidatesByTarget={candidatesByTarget}
          />
        </div>
      </Panel>

      {batches.length > 0 ? (
        <Panel title={copy.history}>
          <ul className="divide-y divide-eavi-border">
            {batches.map((batch) => (
              <li key={batch.id}>
                <Link
                  href={`/dashboard/cards/batches/${batch.id}`}
                  className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm hover:bg-eavi-muted"
                >
                  <span className="font-medium">{batch.targetLabel}</span>
                  <span className="text-eavi-muted-text">{copy.generate.preview(batch.cardCount)}</span>
                  <span className="ms-auto text-xs text-eavi-muted-text tabular-nums">
                    {formatDate(batch.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

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

        {cards.length === 0 ? (
          <EmptyState title={copy.empty.title} body={copy.empty.body} icon="cards" />
        ) : (
          <>
            <RecordCardGrid>
              {cards.map((card) => (
                <RecordCard key={card.id} card={card} openLabel={copy.openLabel} />
              ))}
            </RecordCardGrid>
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
