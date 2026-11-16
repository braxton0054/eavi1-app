/**
 * End-to-end check of the background-job layer, run against a real Redis:
 *
 *   npm run verify:queue
 *
 * It proves the pieces the queues depend on actually work together: the connection factory,
 * the queue definitions and their retry defaults, a worker consuming a job, and the
 * repeatable chat-attachment sweep being registered. The job it runs is the real sweep,
 * which is idempotent and safe against live data (see lib/chat/attachments.ts).
 */

import "dotenv/config";

import { QueueEvents } from "bullmq";

import { prisma } from "../lib/prisma";
import { createConnection } from "../lib/queue/connection";
import {
  QUEUES,
  SWEEP_JOB_NAME,
  closeQueues,
  getCardsQueue,
  getMaintenanceQueue,
} from "../lib/queue/queues";
import { startWorkers } from "../lib/queue/workers";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const probeId = `verify-queue-${Date.now()}`;

async function main() {
  console.log("\nconnection");
  {
    const redis = createConnection();
    const pong = await redis.ping().catch(() => null);
    check("redis answers PING", pong === "PONG", `got ${String(pong)}`);
    await redis.quit();
  }

  console.log("\nqueues");
  {
    const cards = getCardsQueue();
    const maintenance = getMaintenanceQueue();
    await cards.waitUntilReady();
    await maintenance.waitUntilReady();
    check("cards queue is ready", true);
    check("maintenance queue is ready", true);

    const schedulers = await maintenance.getJobSchedulers();
    check(
      "the chat attachment sweep is registered as a job scheduler",
      schedulers.some((scheduler) => scheduler.name === SWEEP_JOB_NAME),
      schedulers.map((scheduler) => scheduler.name).join(", ") || "none",
    );
  }

  console.log("\nworker");
  {
    const workers = await startWorkers();

    // One-off run of the real sweep. The in-process worker picks it up, processes it and
    // the summary stays on the job as its return value.
    const events = new QueueEvents(QUEUES.maintenance, { connection: createConnection() });

    const maintenance = getMaintenanceQueue();
    const job = await maintenance.add(`${SWEEP_JOB_NAME}-verify`, {}, { jobId: probeId });

    const result = await Promise.race([
      job.waitUntilFinished(events),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("the sweep job did not finish in 60s")), 60_000),
      ),
    ]);

    check(
      "the sweep ran and reported its summary",
      typeof result.filesDeleted === "number" &&
        typeof result.messagesDeleted === "number" &&
        typeof result.failures === "number",
      JSON.stringify(result),
    );

    const counts = await maintenance.getJobCounts();
    check("completed jobs are counted", counts.completed >= 1, JSON.stringify(counts));

    await job.remove().catch(() => {});
    await events.close();
    await workers.close();
  }

  console.log("\nretry defaults");
  {
    const cards = getCardsQueue();
    check(
      "a card job gets three attempts with exponential backoff",
      cards.defaultJobOptions.attempts === 3 &&
        (cards.defaultJobOptions.backoff as { type: string } | undefined)?.type === "exponential",
      JSON.stringify(cards.defaultJobOptions),
    );
  }

  console.log(`\n${failed === 0 ? "All checks passed." : `${failed} check(s) failed.`} ${passed} passed.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(async () => {
    await closeQueues();
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("queue verification failed:", error);
    await closeQueues().catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  });
