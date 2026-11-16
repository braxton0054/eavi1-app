import IORedis, { type Redis, type RedisOptions } from "ioredis";

/**
 * Redis lives beside the app. Production overrides this from the container environment
 * (docker-compose points the app and the worker at the `redis` service); the default is
 * what a developer's machine and the CI service container both expose.
 */
export const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

const options: RedisOptions = {
  /*
   * BullMQ requirement, not a preference: workers block on long-running commands
   * (BRPOPLPUSH), so ioredis must never abandon an in-flight command while the connection
   * is coming back. With the default cap of one retry, a batch that outlives a Redis
   * blip would be dropped mid-render.
   */
  maxRetriesPerRequest: null,
};

/**
 * One connection factory for every producer, worker and admin read.
 *
 * The factory is only ever called when a queue or worker is actually constructed — never at
 * module import — because the production build (`next build`) runs with no Redis at all and
 * CI proves that with a dead DATABASE_URL and no Redis service. Importing this module, or
 * any module that re-exports it, must therefore open nothing.
 */
export function createConnection(): Redis {
  return new IORedis(redisUrl, options);
}
