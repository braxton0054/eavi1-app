import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { ensureDocument, regenerateDocument, touchDocument } from "@/lib/documents/service";

async function main() {
  const card = await prisma.idCard.findFirst({ select: { id: true } });
  if (!card) throw new Error("no card");
  const first = await ensureDocument("ID_CARD", card.id);
  const again = await ensureDocument("ID_CARD", card.id);
  console.log("open is stable:", first?.id === again?.id, first?.version === again?.version, first?.sourceHash === again?.sourceHash);
  const rows = await prisma.generatedDocument.count({ where: { kind: "ID_CARD", scopeKey: card.id } });
  console.log("one row per document:", rows === 1);
  await touchDocument("ID_CARD", card.id);
  const stale = await prisma.generatedDocument.findUnique({ where: { kind_scopeKey: { kind: "ID_CARD", scopeKey: card.id } } });
  console.log("source change marks stale:", stale?.status === "STALE");
  const rebuilt = await regenerateDocument("ID_CARD", card.id);
  const after = await prisma.generatedDocument.count({ where: { kind: "ID_CARD", scopeKey: card.id } });
  console.log("regeneration overwrites, no duplicate:", rebuilt?.status === "CURRENT", after === 1);
  const second = await regenerateDocument("ID_CARD", card.id);
  console.log("unchanged hash is a no-op:", second?.version === rebuilt?.version);
}
main().catch((error) => { console.error(error); process.exit(1); });
