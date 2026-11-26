import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ensureDocument, regenerateDocument, touchDocument } from "@/lib/documents/service";
import { closeQueues } from "@/lib/queue/queues";

let failed = false;

function check(label: string, pass: boolean) {
  console.log(`${label}: ${pass}`);
  if (!pass) failed = true;
}

async function main() {
  const card = await prisma.idCard.findFirst({ select: { id: true } });
  if (!card) throw new Error("no card");
  const first = await ensureDocument("ID_CARD", card.id);
  const again = await ensureDocument("ID_CARD", card.id);
  check(
    "open is stable",
    Boolean(first && again && first.id === again.id && first.version === again.version && first.sourceHash === again.sourceHash),
  );
  const rows = await prisma.generatedDocument.count({ where: { kind: "ID_CARD", scopeKey: card.id } });
  check("one row per document", rows === 1);
  await touchDocument("ID_CARD", card.id);
  const stale = await prisma.generatedDocument.findUnique({ where: { kind_scopeKey: { kind: "ID_CARD", scopeKey: card.id } } });
  check("source change marks stale", stale?.status === "STALE");
  const rebuilt = await regenerateDocument("ID_CARD", card.id);
  const after = await prisma.generatedDocument.count({ where: { kind: "ID_CARD", scopeKey: card.id } });
  check("regeneration overwrites, no duplicate", rebuilt?.status === "CURRENT" && after === 1);
  const second = await regenerateDocument("ID_CARD", card.id);
  check("unchanged hash is a no-op", Boolean(rebuilt && second && second.version === rebuilt.version));
  if (failed) process.exitCode = 1;
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeQueues();
    await prisma.$disconnect();
    // Storage and queue clients can leave sockets open after a one-off verification run.
    process.exit(process.exitCode ?? 0);
  });
