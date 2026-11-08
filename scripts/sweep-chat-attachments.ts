import "../load-env";

import { prisma } from "../lib/prisma";
import { RETENTION_DAYS, sweepExpiredAttachments } from "../lib/chat/attachments";

/**
 * Deletes chat documents older than the retention window.
 *
 * Run on a schedule — hourly is plenty for a seven-day rule:
 *
 *   npm run chat:sweep
 *
 * The work is idempotent and safe to run twice at once: each attachment is deleted by key, and a
 * second runner finds the object already absent and treats that as success.
 */
async function main() {
  const started = Date.now();
  const result = await sweepExpiredAttachments();

  console.log(
    `chat attachments: ${result.filesDeleted} file(s) and ${result.messagesDeleted} empty message(s) removed` +
      (result.failures ? `, ${result.failures} failure(s) to retry` : "") +
      ` in ${Date.now() - started}ms (retention ${RETENTION_DAYS} days)`,
  );

  // A non-zero exit on failure so a cron job or CI reports it rather than looking healthy.
  if (result.failures > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("chat attachment sweep failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
