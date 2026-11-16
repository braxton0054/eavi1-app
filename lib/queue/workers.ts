import { Worker } from "bullmq";

import { prisma } from "@/lib/prisma";

import { createConnection } from "./connection";
import { processCardBatch, processAttachmentSweep } from "./processors";
import {
  QUEUES,
  SWEEP_CRON,
  SWEEP_JOB_NAME,
  getMaintenanceQueue,
  closeQueues,
  type CardBatchJobData,
} from "./queues";

export type RunningWorkers = {
  close: () => Promise<void>;
};

/**
 * Starts every worker this process should run and registers the repeatable jobs.
 *
 * Registration happens here rather than in the web process so a deployment that only ever
 * starts web servers still cannot lose the schedule: the first worker that comes up puts
 * the repeatable sweep back, and `add` is idempotent for an unchanged repeat config.
 */
export async function startWorkers(): Promise<RunningWorkers> {
  const maintenanceQueue = getMaintenanceQueue();
  /*
   * The schedule is a job scheduler (BullMQ 6's replacement for repeatable jobs). Upserting
   * on every worker start is idempotent and self-healing: a fresh Redis or a changed cron
   * pattern converges here, and no web process ever needs to know about scheduling.
   */
  await maintenanceQueue.upsertJobScheduler(SWEEP_JOB_NAME, { pattern: SWEEP_CRON });

  /*
   * Concurrency 1 on purpose: a card batch renders every sheet through the image pipeline
   * and PDF encoder, which is memory-hungry. One batch at a time keeps the worker inside
   * a small container's budget; more parallelism belongs to more worker containers, not
   * more concurrency in one.
   */
  const cardWorker = new Worker<CardBatchJobData>(QUEUES.cards, processCardBatch, {
    connection: createConnection(),
    concurrency: 1,
  });

  const maintenanceWorker = new Worker(QUEUES.maintenance, processAttachmentSweep, {
    connection: createConnection(),
    concurrency: 1,
  });

  /*
   * The `failed` event fires for every attempt. The job has truly run out of tries only
   * when BullMQ has moved it to the failed state — a retryable failure sits in `delayed`
   * while its backoff runs, and the batch must stay visible as running until then.
   */
  cardWorker.on("failed", async (job) => {
    if (!job) return;
    if ((await job.getState()) !== "failed") return;

    // A completed batch is never downgraded, whatever a late duplicate job reports.
    await prisma.cardBatch.updateMany({
      where: { id: job.data.batchId, status: { not: "COMPLETE" } },
      data: { status: "FAILED" },
    });
  });

  // Without this, an unhandled worker error is an unhandled exception that kills the process.
  for (const worker of [cardWorker, maintenanceWorker]) {
    worker.on("error", (error) => console.error(`queue worker error (${worker.name}):`, error));
  }

  return {
    async close() {
      /*
       * A graceful stop waits for the active job — but only for a moment. Past the grace
       * period the worker is cut and BullMQ's stalled-job check hands the batch to the
       * next worker; the processors are written to survive exactly that.
       */
      const gracePeriod = new Promise((resolve) => setTimeout(resolve, 30_000));
      await Promise.race([
        Promise.allSettled([cardWorker.close(), maintenanceWorker.close()]),
        gracePeriod,
      ]);
      await closeQueues();
    },
  };
}
