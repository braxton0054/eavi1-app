import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { common, labels, pages } from "@/lib/content/dashboard";
import { DetailList } from "@/components/dashboard/panel";
import { EmptyState, Notice, PageHeader, Panel } from "@/components/dashboard/panel";
import { formatDate } from "@/lib/format";

const copy = pages.cards.batch;

/**
 * One print run, viewed inside the portal.
 *
 * The PDF is shown in the page rather than opened in a new tab: the office stays in the
 * portal, can check the sheets before printing, and downloads the same file from here.
 */
export default async function CardBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireCollegeAdmin();

  const batch = await prisma.cardBatch.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: {
      id: true,
      targetLabel: true,
      cardCount: true,
      sheetCount: true,
      fileUrl: true,
      status: true,
      actorEmail: true,
      createdAt: true,
    },
  });

  if (!batch) notFound();

  const facts = [
    { label: copy.target, value: batch.targetLabel },
    { label: copy.cards, value: String(batch.cardCount) },
    { label: copy.sheets, value: String(batch.sheetCount) },
    { label: copy.created, value: formatDate(batch.createdAt) },
    { label: copy.generatedBy, value: batch.actorEmail ?? common.notSet },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={batch.targetLabel}
        action={
          <Link
            href="/dashboard/cards"
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
          >
            {copy.back}
          </Link>
        }
      />

      <Panel title={copy.summary}>
        <div className="p-4">
          <DetailList items={facts} />
        </div>
      </Panel>

      {batch.status === "PENDING" ? (
        <Notice tone="neutral" title={copy.pendingTitle} body={copy.pendingBody} />
      ) : batch.status === "FAILED" ? (
        <Notice tone="warning" title={copy.failedTitle} body={copy.failedBody} />
      ) : batch.fileUrl === null ? (
        <Notice tone="warning" title={copy.noFileTitle} body={copy.noFileBody} />
      ) : (
        <Panel
          title={copy.preview}
          description={copy.previewHint(batch.sheetCount)}
          aside={
            <a
              href={`/dashboard/cards/batches/${batch.id}/file`}
              download={`${copy.fileName(batch.createdAt)}`}
              className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-4 text-sm font-medium text-eavi-primary-text hover:bg-eavi-muted"
            >
              {copy.download}
            </a>
          }
        >
          <div className="p-4">
            {/* The object is embedded by the portal's own route, so the storage host and the
                file name never have to leave the system to be seen. */}
            <object
              data={`/dashboard/cards/batches/${batch.id}/file`}
              type="application/pdf"
              title={labels.cardStatus.PENDING ? copy.previewTitle : copy.previewTitle}
              className="h-[70vh] w-full rounded-xl border border-eavi-border bg-eavi-card"
            >
              <p className="p-4 text-sm text-eavi-muted-text">
                {copy.noViewer}{" "}
                <a className="underline" href={`/dashboard/cards/batches/${batch.id}/file`}>
                  {copy.download}
                </a>
              </p>
            </object>
          </div>
        </Panel>
      )}

      {batch.status === "COMPLETE" && batch.cardCount === 0 ? (
        <EmptyState title={copy.emptyTitle} body={copy.emptyBody} icon="cards" />
      ) : null}
    </div>
  );
}
