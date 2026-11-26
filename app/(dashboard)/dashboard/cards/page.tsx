import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  History,
  Printer,
  ShieldCheck,
  Users,
} from "lucide-react";

import { moveCard } from "@/lib/actions/college/cards";
import { getCards, getStudentOptions } from "@/lib/dal/college";
import { getCardCandidates } from "@/lib/dal/cards";
import { getClassOptions, getIntakeChoices } from "@/lib/dal/classes";
import { CardGenerator } from "@/components/dashboard/card-generator";
import { savedCardFaces } from "@/lib/documents/renderers";
import { syncCardTemplate } from "@/lib/cards/template-version";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { EmptyState, Notice } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { Paginator } from "@/components/dashboard/list-tools";
import { RowForm } from "@/components/dashboard/record-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import s from "./cards.module.css";

const copy = pages.cards;

const tone: Record<string, ChipTone> = {
  PENDING: "warning",
  PRINTING: "warning",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "neutral",
};

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

  await syncCardTemplate().catch(() => null);

  const [list, studentOptions, classChoices, intakeChoices, statusGroups] = await Promise.all([
    getCards({ q, status, page: Number(page) || 1 }),
    getStudentOptions(scope.campusId),
    getClassOptions(scope.campusId),
    getIntakeChoices(),
    prisma.idCard.groupBy({
      by: ["status"],
      where: scope.campusId === null ? {} : { campusId: scope.campusId },
      _count: { _all: true },
    }),
  ]);

  const targets = [
    ...studentOptions.map((option) => ({ kind: "student", id: option.value })),
    ...classChoices.map((option) => ({ kind: "class", id: option.value })),
    ...intakeChoices.map((option) => ({ kind: "intake", id: option.id })),
  ];
  const resolved = await Promise.all(
    targets.map((target) =>
      getCardCandidates(
        target.kind === "student"
          ? { kind: "student", studentId: target.id }
          : target.kind === "class"
            ? { kind: "class", classId: target.id }
            : { kind: "intake", intakeId: target.id },
        scope.campusId,
      ),
    ),
  );
  const candidatesByTarget = Object.fromEntries(
    targets.map((target, index) => [`${target.kind}:${target.id}`, resolved[index]]),
  );

  const [batches, documents] = await Promise.all([
    prisma.cardBatch.findMany({
      where: scope.campusId === null ? {} : { campusId: scope.campusId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, targetLabel: true, cardCount: true, createdAt: true },
    }),
    prisma.generatedDocument.findMany({
      where: { kind: "ID_CARD", scopeKey: { in: list.rows.map((card) => card.id) } },
      select: { scopeKey: true, svgText: true },
    }),
  ]);

  const documentByCard = new Map(documents.map((document) => [document.scopeKey, document]));
  const faceByCard = new Map(
    list.rows.map((card) => {
      const document = documentByCard.get(card.id);
      return [card.id, document ? savedCardFaces(document.svgText) : null];
    }),
  );

  const countFor = (value: string) =>
    statusGroups.find((group) => group.status === value)?._count._all ?? 0;
  const totalCards = statusGroups.reduce((sum, group) => sum + group._count._all, 0);
  const stats = [
    { label: "Total cards", value: totalCards, href: "/dashboard/cards", icon: Users },
    { label: "Issued", value: countFor("ISSUED"), href: "/dashboard/cards?status=ISSUED", icon: ShieldCheck },
    {
      label: "Needs attention",
      value: countFor("PENDING") + countFor("PRINTING"),
      href: "/dashboard/cards?status=PENDING",
      icon: AlertTriangle,
    },
    {
      label: "Lost / replaced",
      value: countFor("LOST") + countFor("REPLACED"),
      href: "/dashboard/cards?status=LOST",
      icon: History,
    },
  ];
  const statuses = Object.entries(labels.cardStatus).map(([value, label]) => ({ value, label }));

  return (
    <div className={s.page}>
      <section className={s.hero} aria-labelledby="cards-title">
        <div>
          <p className={s.heroEyebrow}>Campus credentials</p>
          <h1 id="cards-title">{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <a className={s.heroAction} href="#print-batch">
          <Printer aria-hidden /> Print card batch <ArrowUpRight aria-hidden />
        </a>
      </section>

      <section className={s.stats} aria-label="Card register summary">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href} className={s.stat}>
              <span className={s.statIcon}><Icon aria-hidden /></span>
              <span>
                <strong>{stat.value.toLocaleString()}</strong>
                <span>{stat.label}</span>
              </span>
              <ArrowUpRight aria-hidden className={s.statArrow} />
            </Link>
          );
        })}
      </section>

      {invalid ? <Notice tone="warning" title={common.errorTitle} body={common.invalidSubmit} /> : null}
      {empty ? <Notice tone="warning" title={copy.generate.title} body={copy.generate.limits.empty} /> : null}
      {tooMany ? <Notice tone="warning" title={copy.generate.title} body={copy.generate.limits.tooMany} /> : null}
      {ready ? <Notice tone="success" title={copy.generate.title} body={copy.generate.limits.saved} /> : null}

      <div className={s.workspace}>
        <section className={s.register} aria-labelledby="register-title">
          <header className={s.sectionHeader}>
            <div>
              <p className={s.eyebrow}>Register</p>
              <h2 id="register-title">All cards</h2>
              <p>{pages.overview.scopeNote(scope.campusName)}</p>
            </div>
            <span className={s.resultCount}>{list.total} results</span>
          </header>

          <form action="/dashboard/cards" method="get" className={s.filters}>
            <div className={s.searchField}>
              <Label htmlFor="card-search">{copy.searchLabel}</Label>
              <Input
                id="card-search"
                name="q"
                type="search"
                defaultValue={q}
                placeholder={common.searchPlaceholder}
              />
            </div>
            <div className={s.statusField}>
              <Label htmlFor="card-status">{common.filter}</Label>
              <select
                id="card-status"
                name="status"
                defaultValue={status ?? ""}
                className={s.select}
              >
                <option value="">{common.allStatuses}</option>
                {statuses.map((choice) => (
                  <option key={choice.value} value={choice.value}>{choice.label}</option>
                ))}
              </select>
            </div>
            <input type="hidden" name="page" value="1" />
            <Button type="submit" size="lg">Apply filters</Button>
            {q || status ? (
              <Button asChild size="lg" variant="ghost">
                <Link href="/dashboard/cards">{common.clear}</Link>
              </Button>
            ) : null}
          </form>

          {list.rows.length === 0 ? (
            <EmptyState title={copy.empty.title} body={copy.empty.body} icon="cards" />
          ) : (
            <ul className={s.cardList}>
              {list.rows.map((card) => {
                const face = faceByCard.get(card.id) ?? null;
                const programme = card.program?.name ?? card.student.enrollments[0]?.program.name ?? common.none;
                return (
                  <li key={card.id} className={s.cardRow}>
                    <Link href={`/dashboard/cards/${card.id}`} className={s.cardLink}>
                      <span className={s.thumbnail} aria-hidden="true">
                        {face?.frontSvg ? (
                          <span dangerouslySetInnerHTML={{ __html: face.frontSvg }} />
                        ) : (
                          <span className={s.initials}>
                            {card.student.user.fullName
                              .split(/\s+/)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className={s.identity}>
                        <span className={s.cardTopline}>
                          <span className={s.serial}>{card.serial}</span>
                          <StatusChip tone={tone[card.status] ?? "neutral"}>
                            {labels.cardStatus[card.status] ?? card.status}
                          </StatusChip>
                        </span>
                        <strong>{card.student.user.fullName}</strong>
                        <span>{card.student.admissionNo} · {programme}</span>
                      </span>
                      <span className={s.facts}>
                        <span><span>Issued</span><strong>{card.issuedAt ? formatDate(card.issuedAt) : common.notSet}</strong></span>
                        <span><span>Valid until</span><strong>{card.expiresAt ? formatDate(card.expiresAt) : common.notSet}</strong></span>
                      </span>
                      <span className={s.openRecord}>
                        Open record <ArrowUpRight aria-hidden />
                      </span>
                    </Link>

                    <div className={s.rowActions}>
                      <RowForm
                        id={`card-${card.id}-move`}
                        button="Update status"
                        fields={[copy.move.statusField]}
                        values={{ status: card.status }}
                        hidden={{ cardId: card.id }}
                        action={moveCard}
                        submitLabel={common.update}
                        className={s.rowForm}
                      />
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/dashboard/cards/${card.id}/card`} target="_blank" rel="noopener noreferrer">
                          View PDF <ArrowUpRight aria-hidden />
                        </a>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className={s.pagination}>
            <Paginator
              basePath="/dashboard/cards"
              page={list.page}
              total={list.total}
              q={q}
              status={status}
            />
          </div>
        </section>

        <aside className={s.sidebar}>
          <section id="print-batch" className={s.printPanel} aria-labelledby="print-title">
            <header>
              <span className={s.panelIcon}><Printer aria-hidden /></span>
              <div>
                <p className={s.eyebrow}>Physical cards</p>
                <h2 id="print-title">{copy.generate.title}</h2>
              </div>
            </header>
            <p className={s.panelDescription}>{copy.generate.hint}</p>
            <CardGenerator
              students={studentOptions}
              classes={classChoices.map((choice) => ({ value: choice.value, label: choice.label }))}
              intakes={intakeChoices.map((choice) => ({ value: choice.id, label: choice.label }))}
              candidatesByTarget={candidatesByTarget}
            />
          </section>

          {batches.length > 0 ? (
            <section className={s.batches} aria-labelledby="batches-title">
              <header>
                <History aria-hidden />
                <h2 id="batches-title">{copy.history}</h2>
              </header>
              <ul>
                {batches.map((batch) => (
                  <li key={batch.id}>
                    <Link href={`/dashboard/cards/batches/${batch.id}`}>
                      <span>
                        <strong>{batch.targetLabel}</strong>
                        <span>{copy.generate.preview(batch.cardCount)}</span>
                      </span>
                      <span className={s.batchDate}>{formatDate(batch.createdAt)}</span>
                      <ArrowUpRight aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
