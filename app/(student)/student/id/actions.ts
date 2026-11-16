"use server";

import { renderCardPng } from "@/lib/cards/render";
import { getCardFace } from "@/lib/dal/cards";
import { getStudentCard } from "@/lib/dal/student-portal";

/**
 * The student's own card rendered by the same print pipeline the office uses, so the
 * downloaded PNG is pixel-identical to the plastic: CR80 at 300 DPI, artwork merged
 * server-side from the record — never from anything the browser sends.
 */
export async function downloadCardPng(side: "front" | "back") {
  const { student, card } = await getStudentCard();
  if (!card) return { ok: false as const, error: "no-card" as const };

  const face = await getCardFace(card.id, student.campusId);
  if (!face) return { ok: false as const, error: "no-face" as const };

  const png = await renderCardPng(side === "back" ? face.backSvg : face.frontSvg);
  return { ok: true as const, data: png.toString("base64"), serial: card.serial };
}
