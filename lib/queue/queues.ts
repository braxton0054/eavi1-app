import { Queue, type QueueOptions } from "bullmq";

import type { CardTarget } from "@/lib/dal/cards";

import { createConnection } from "./connection";

/**
 * The queues, each named for real work that used to run inside an HTTP request or by hand
 * on someone's terminal. Every queue here has a processor registered in `workers.ts`; a
 * queue with no consumer would silently hold jobs forever.
 */
export const QUEUES = {
  /** One job per card print run: render every sheet to PNG and build the batch's PDF. */
  cards: "cards",
  /** Scheduled housekeeping. Today that is one job: the chat attachment retention sweep. */
  maintenance: "maintenance",
  /** One job per saved document whose source changed: re-render and overwrite its row. */
  documents: "documents",
} as const;

/** The source document a refresh job must re-render. */
export type DocumentRefreshJobData = { kind: string; scopeKey: string };

/** Everything a card worker needs to finish a run without re-reading the session. */
export type CardBatchJobData = {
  batchId: string;
  target: CardTarget;
  /** The campus the run belongs to; null is college-wide (a super admin's scope). */
  campusId: number | null;
  actorId: string;
  actorEmail: string;
};

/** The one repeatable maintenance job today: deletes chat files past their retention. */
export const SWEEP_JOB_NAME = "chat-attachment-sweep";

/**
 * Hourly at :17 — the script's own comment says hourly is plenty for a seven-day rule, and
 * the off-the-hour minute keeps the sweep away from the top-of-hour cron herd.
 */
export const SWEEP_CRON = "17 * * * *";

/*
 * Completed jobs are kept briefly so the jobs screen can show recent runs; failed jobs are
 * kept for a week so a failure on Friday evening is still diagnosable on Monday. Nothing is
 * removed on failure by count: a failed job is the record that something needs a human.
 */
const RETAIN_COMPLETED = { age: 24 * 60 * 60, count: 200 };
const RETAIN_FAILED = { age: 7 * 24 * 60 * 60 };

const defaultJobOptions = {
  cards: {
    /*
     * A render fails on the things a retry can fix (storage timeouts, a busy image
     * pipeline), so three tries with exponential backoff — roughly 30s, then 60s — before
     * the batch is marked failed and left for a person.
     */
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: RETAIN_COMPLETED,
    removeOnFail: RETAIN_FAILED,
  },
  maintenance: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    removeOnComplete: RETAIN_COMPLETED,
    removeOnFail: RETAIN_FAILED,
  },
  documents: {
    attempts: 3,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: RETAIN_COMPLETED,
    removeOnFail: RETAIN_FAILED,
  },
} as const;

/*
 * One queue instance per process, created on first use. Constructing a queue opens its
 * Redis connection, so these getters exist precisely so nothing connects at import time.
 */
const instances = new Map<string, Queue>();

function getQueue(name: string, defaultJobOptions: QueueOptions["defaultJobOptions"]): Queue {
  let queue = instances.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: createConnection(), defaultJobOptions });
    instances.set(name, queue);
  }
  return queue;
}

export function getCardsQueue(): Queue<CardBatchJobData> {
  return getQueue(QUEUES.cards, defaultJobOptions.cards) as Queue<CardBatchJobData>;
}

export function getMaintenanceQueue(): Queue {
  return getQueue(QUEUES.maintenance, defaultJobOptions.maintenance);
}

export function getDocumentsQueue(): Queue<DocumentRefreshJobData> {
  return getQueue(QUEUES.documents, defaultJobOptions.documents) as Queue<DocumentRefreshJobData>;
}

/**
 * Enqueues one card run. The batch row's id is the BullMQ job id, so a double submit can
 * never put the same run in the queue twice.
 */
export async function enqueueCardBatch(data: CardBatchJobData) {
  await getCardsQueue().add("card-batch", data, { jobId: data.batchId });
}

/**
 * Repeated edits to the same document collapse into one queued refresh.
 *
 * Redis clients here deliberately never give up on a command (`maxRetriesPerRequest: null`),
 * which is right for a worker and wrong for a write: a queue outage must never hold the
 * HTTP request that recorded a payment. The row is marked STALE first, so a missed enqueue
 * is repaired later; only the enqueue waits, and only briefly.
 */
export async function enqueueDocumentRefresh(data: DocumentRefreshJobData) {
  /*
   * No fixed job id: a completed job with that id would make every later edit a no-op.
   * Every touch queues a job instead, and the processor's hash check makes the extras
   * harmless — the second job sees the new hash already saved and renders nothing.
   */
  const add = getDocumentsQueue().add("document-refresh", data);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
  await Promise.race([add, timeout]);
}

/**
 * Queue depths for the jobs screen, in one call.
 *
 * A Redis outage must not take the dashboard down with it: each read is raced against a
 * short timeout and an unreachable queue reports as unavailable instead of hanging the
 * page (with `maxRetriesPerRequest: null`, a command issued while offline waits forever —
 * exactly right for a worker, exactly wrong for a page).
 */
export type QueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  unavailable: boolean;
};

const COUNT_TIMEOUT_MS = 2_000;

async function countsWithinTimeout(queue: Queue): Promise<QueueCounts> {
  const counts = await Promise.race([
    queue.getJobCounts(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), COUNT_TIMEOUT_MS)),
  ]);

  return counts
    ? {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
        unavailable: false,
      }
    : { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, unavailable: true };
}

export async function queueCounts(): Promise<Record<string, QueueCounts>> {
  const [cards, maintenance, documents] = await Promise.allSettled([
    countsWithinTimeout(getCardsQueue()),
    countsWithinTimeout(getMaintenanceQueue()),
    countsWithinTimeout(getDocumentsQueue()),
  ]);
  const unavailable: QueueCounts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, unavailable: true };

  return {
    [QUEUES.cards]: cards.status === "fulfilled" ? cards.value : unavailable,
    [QUEUES.maintenance]: maintenance.status === "fulfilled" ? maintenance.value : unavailable,
    [QUEUES.documents]: documents.status === "fulfilled" ? documents.value : unavailable,
  };
}

/** Closes every queue this process opened, so `tsx watch` and tests exit cleanly. */
export async function closeQueues() {
  const closing = [...instances.values()].map((queue) => queue.close());
  instances.clear();
  await Promise.all(closing);
}
