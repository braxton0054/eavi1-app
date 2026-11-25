/**
 * Detects a change to the shipped card artwork and refreshes every saved card.
 *
 * The artwork is code (`components/id-card-svg.tsx`), so a deploy can change what a card
 * should look like. The active template row remembers the last shipped version; when the
 * text differs, all saved card documents are marked stale and the worker re-renders them
 * from their snapshots. No one presses a "regenerate" button.
 */

import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { touchAllCards } from "@/lib/documents/service";
import { templates } from "@/lib/dal/cards";

const NAME = "eavi-card";

export async function syncCardTemplate() {
  const { front, back } = await templates();
  const current = await prisma.cardTemplate.findFirst({
    where: { name: NAME, campusId: null, isActive: true },
    orderBy: { version: "desc" },
    select: { id: true, frontSvg: true, backSvg: true },
  });
  if (current?.frontSvg === front && current?.backSvg === back) return;

  if (current) {
    await prisma.cardTemplate.update({
      where: { id: current.id },
      data: { frontSvg: front, backSvg: back, version: { increment: 1 } },
    });
  } else {
    await prisma.cardTemplate.create({
      data: { name: NAME, frontSvg: front, backSvg: back, version: 1, isActive: true },
    });
  }

  // The artwork changed, so every saved card's rendering is out of date.
  await touchAllCards();

  return createHash("sha256").update(front + back).digest("hex").slice(0, 16);
}
