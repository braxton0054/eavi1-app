import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as { prisma?: PrismaClient };

/*
 * The pool is sized on purpose rather than left on pg's default of 10: the web process and
 * the queue worker each get one pool of ten, migrations use their own one-off connection,
 * and Postgres's 100 max_connections keeps headroom for operations. Ten is enough because
 * the app's queries are short and indexed — pool exhaustion here would mean a queue of
 * brief waits, not held-open transactions.
 *
 * Next loads DATABASE_URL from .env, so the adapter reads it straight from the environment.
 * Reused across hot reloads so dev does not exhaust the pool.
 */
const pool = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg(pool),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
