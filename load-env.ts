import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads .env before anything else is imported.
 *
 * This has to be its own module and the very first import of the server entry: ESM evaluates
 * imports before the importing module's body, so a loop in server.ts ran after the Prisma
 * client had already been constructed without a connection string. Production passes real
 * environment variables from the container, so a missing file is not an error.
 */
for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) process.loadEnvFile(path);
}
