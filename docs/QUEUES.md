# Background jobs

The portal runs a small BullMQ layer on Redis for work that must not happen inside an HTTP
request. Producers live next to the server actions that used to do the work; consumers live
in one worker process.

```
lib/queue/
  connection.ts   the single ioredis factory (lazy: nothing connects at import time)
  queues.ts       queue names, job payloads, retry defaults, queue counts
  processors.ts   what each job actually does
  workers.ts      worker registration, failure handling, graceful shutdown
scripts/worker.ts the worker entry point
```

## The queues

### `cards`

One job per card print run. The action (`lib/actions/college/card-generation.ts`) validates
the target, creates the `CardBatch` row in state `PENDING`, and enqueues; the worker renders
every sheet to PNG, builds the PDF, uploads it to object storage, and flips the batch to
`COMPLETE`. This used to run inside the HTTP request — a batch of four hundred cards held
the request for the better part of a minute and died with it.

Failure semantics:

- A failed attempt is retried with exponential backoff (3 attempts, ~30s, ~60s). While
  retries remain, the batch shows as generating.
- Once attempts are exhausted, the worker marks the batch `FAILED` and the print-run page
  says so. The job is kept in Redis for a week for diagnosis (`/dashboard/jobs`).
- If Redis itself is unreachable at enqueue time, the action records the batch as `FAILED`
  immediately rather than pretending the run is coming.
- The work is idempotent: cards are reused by student, so a re-run after a worker crash
  (BullMQ's stalled-job recovery re-assigns the job) overwrites the same batch row.

### `maintenance`

Housekeeping jobs. Today there is one, `chat-attachment-sweep`, repeated hourly at :17: it
deletes chat documents past their seven-day retention, exactly what `scripts/sweep-chat-attachments.ts`
does by hand (that script still exists for manual runs). The repeatable job is registered by
the worker at startup, so the first worker that comes up restores the schedule. The work is
idempotent, so an hourly job and a manual run cannot double-delete.

## Retry policy

| Queue | Attempts | Backoff | Keep completed | Keep failed |
| --- | --- | --- | --- | --- |
| `cards` | 3 | exponential, 30s base | 24h (max 200) | 7 days |
| `maintenance` | 3 | exponential, 60s base | 24h (max 200) | 7 days |

Failed jobs are never removed by count: a failed job is the record that something needs a
human. They are visible on `/dashboard/jobs` (super admin, read-only) and each card failure
is also on the print-run page itself.

## Running a worker

**Development** — `npm run dev` starts the worker automatically as a child of the portal
server. To run it on its own terminal instead:

```bash
npm run worker
```

**Production (Docker)** — the `worker` service in `docker-compose.yml` runs the same image
as the app with `node worker.mjs` as its entry point. It must be running: without it, queued
card runs sit pending forever. Scale by adding replicas of that one service.

**Production (no Docker)** — run `npm run server:build && node worker.mjs` under your
process supervisor (systemd unit, etc.), with `REDIS_URL` and `DATABASE_URL` set.

## Configuration

- `REDIS_URL` — where Redis lives. Default `redis://127.0.0.1:6379`; docker-compose points
  both the app and the worker at its `redis` service (AOF on, so queued jobs survive a
  restart).

## Rules the layer lives by

- **Nothing connects at import time.** `next build` runs with no Redis and a dead
  `DATABASE_URL`; queues and connections are constructed on first use only. CI proves this
  by building with port 1 as the database.
- **Worker connections set `maxRetriesPerRequest: null`.** BullMQ workers block on
  long-running commands; capping retries drops in-flight jobs on a Redis blip.
- **Producers never import the workers.** The web process enqueues; only the worker process
  (and `scripts/verify-queue.ts`) registers processors.
