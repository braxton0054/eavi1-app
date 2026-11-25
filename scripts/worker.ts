import "../load-env";

import { prisma } from "../lib/prisma";
import { startWorkers } from "../lib/queue/workers";

/**
 * The background-job worker: consumes the queues from `lib/queue` as its own process.
 *
 *   npm run worker
 *
 * In development `npm run dev` starts this automatically as a child of the portal server, so
 * a second terminal is never needed. In production it runs as its own container (the
 * `worker` service in docker-compose) or its own process on a host that does not use Docker.
 *
 * SIGTERM stops accepting new jobs, waits up to thirty seconds for the batch in flight, and
 * exits. A batch cut past that point is re-run from the top by another worker — the
 * processors are idempotent by design, so the office sees one finished run either way.
 */
async function main() {
  const workers = await startWorkers();

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`worker: ${signal} received, finishing the current job…`);
      workers
        .close()
        .then(() => prisma.$disconnect())
        .then(() => process.exit(0))
        .catch((error) => {
          console.error("worker: shutdown failed:", error);
          process.exit(1);
        });
    });
  }

  console.log("worker ready: cards, documents, maintenance (chat attachment sweep hourly)");
}

main().catch((error) => {
  console.error("worker failed to start:", error);
  process.exit(1);
});
