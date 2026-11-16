import { formatDate } from "@/lib/format";
import { pages } from "@/lib/content/dashboard";
import { DataTable, type Row } from "@/components/dashboard/data-table";
import { EmptyState, PageHeader, Panel } from "@/components/dashboard/panel";
import { requireSuperAdmin } from "@/lib/session";
import { getCardsQueue, getMaintenanceQueue, QUEUES, queueCounts } from "@/lib/queue/queues";

const copy = pages.jobs;

export const dynamic = "force-dynamic";

/**
 * Read-only view of the background queues, for the person who has to answer why a card run
 * never produced a file. Depths first, then the failed jobs with the reason each one gave.
 *
 * Every card failure is also visible where the office works, on the print run itself; this
 * screen is the operator's side of the same story. Nothing here can be retried or deleted
 * from the portal on purpose — a failed job is a diagnosis, and changing one belongs to the
 * person running the system, not a button.
 */
export default async function JobsPage() {
  await requireSuperAdmin();

  const [counts, failedCards, failedMaintenance] = await Promise.all([
    queueCounts(),
    getCardsQueue().getFailed(0, 9),
    getMaintenanceQueue().getFailed(0, 9),
  ]);

  const failed = [
    ...failedCards.map((job) => ({ job, queue: QUEUES.cards })),
    ...failedMaintenance.map((job) => ({ job, queue: QUEUES.maintenance })),
  ]
    .sort((a, b) => (b.job.timestamp ?? 0) - (a.job.timestamp ?? 0))
    .slice(0, 10)
    .map(({ job, queue }): Row => ({
      id: job.id ?? String(job.timestamp),
      cells: {
        job: job.name,
        queue: copy.queueLabels[queue as keyof typeof copy.queueLabels] ?? queue,
        attempts: String(job.attemptsMade),
        when: job.timestamp ? formatDate(new Date(job.timestamp)) : "—",
        reason: job.failedReason || "—",
      },
    }));

  const depths = Object.entries(counts);

  return (
    <div className="space-y-6">
      <PageHeader title={copy.title} description={copy.description} />

      <Panel title={copy.summary}>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {depths.map(([queue, depth]) => (
            <div key={queue} className="rounded-xl border border-eavi-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-eavi-primary-text">
                  {copy.queueLabels[queue as keyof typeof copy.queueLabels] ?? queue}
                </span>
                {depth.unavailable ? (
                  <span className="text-xs text-eavi-warn-text">{copy.unavailable}</span>
                ) : null}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                {Object.entries(copy.counts).map(([key, label]) => (
                  <div key={key}>
                    <dt className="text-xs text-eavi-muted-text">{label}</dt>
                    <dd className="tabular-nums text-eavi-primary-text">
                      {depth[key as keyof typeof depth] ?? 0}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title={copy.failedJobs}>
        {failed.length === 0 ? (
          <EmptyState title={copy.noFailedTitle} body={copy.noFailedBody} icon="cards" />
        ) : (
          <DataTable columns={copy.columns} rows={failed} caption={copy.failedJobs} />
        )}
      </Panel>
    </div>
  );
}
