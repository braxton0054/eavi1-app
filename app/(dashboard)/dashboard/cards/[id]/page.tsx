import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DetailList, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { StatusChip, type ChipTone } from "@/components/dashboard/status-chip";
import { getCardFace } from "@/lib/dal/cards";
import { listAudit } from "@/lib/academics/audit";
import { formatDate } from "@/lib/format";

const copy = pages.cards.detail;

const tone: Record<string, ChipTone> = {
  PENDING: "warning",
  PRINTING: "warning",
  ISSUED: "success",
  LOST: "danger",
  REPLACED: "neutral",
};

/** One card, with the artwork as it will print and the history of what happened to it. */
export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCollegeAdmin();

  const card = await prisma.idCard.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: {
      id: true,
      serial: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      createdAt: true,
      remarks: true,
      student: {
        select: {
          id: true,
          admissionNo: true,
          user: { select: { fullName: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            select: { id: true },
          },
        },
      },
    },
  });

  if (!card) notFound();

  const face = await getCardFace(card.id, scope.campusId);
  const history = await listAudit("card", card.id);

  const facts = [
    { label: copy.student, value: `${card.student.admissionNo} · ${card.student.user.fullName}` },
    { label: copy.serial, value: card.serial },
    {
      label: copy.status,
      // The student's enrolment is the headline state; the card's own print lifecycle
      // stays as the small line under it. No enrolled student is told "PENDING".
      value: (
        <span className="flex flex-col items-start gap-1">
          <StatusChip tone={card.student.enrollments.length > 0 ? "success" : "neutral"}>
            {card.student.enrollments.length > 0 ? "Enrolled" : "Not enrolled"}
          </StatusChip>
          <span className="text-[11px] text-eavi-muted-text">
            Card: {labels.cardStatus[card.status] ?? card.status}
          </span>
        </span>
      ),
    },
    { label: copy.issued, value: card.issuedAt ? formatDate(card.issuedAt) : common.notSet },
    { label: copy.expires, value: card.expiresAt ? formatDate(card.expiresAt) : common.notSet },
    { label: copy.requested, value: formatDate(card.createdAt) },
    { label: copy.remarks, value: card.remarks ?? common.notSet },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={card.student.user.fullName}
        description={`${copy.title} · ${card.serial}`}
        action={
          <Link
            href={`/dashboard/students/${card.student.id}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {copy.openStudent}
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={copy.details}>
          <div className="p-4">
            <DetailList items={facts} />
          </div>
        </Panel>

        <Panel title={copy.face} description={copy.faceHint}>
          <div className="space-y-3 p-4">
            {face ? (
              <>
                <div
                  className="w-full overflow-hidden rounded-lg ring-1 ring-eavi-border [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: face.frontSvg }}
                />
                <div
                  className="w-full overflow-hidden rounded-lg ring-1 ring-eavi-border [&>svg]:h-auto [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: face.backSvg }}
                />
                {face.missing.length > 0 ? (
                  <Notice
                    tone="warning"
                    title={copy.missingTitle}
                    body={copy.missing(face.missing.join(", "))}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title={copy.history}>
        {history.length === 0 ? (
          <p className="p-4 text-sm text-eavi-muted-text">{copy.noHistory}</p>
        ) : (
          <ul className="divide-y divide-eavi-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 p-3 text-sm">
                <span className="font-medium">{entry.action}</span>
                <span className="text-eavi-muted-text">{entry.actorEmail ?? common.notSet}</span>
                <span className="ms-auto text-xs text-eavi-muted-text tabular-nums">
                  {formatDate(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
