import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { getCardFace } from "@/lib/dal/cards";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** A clean, print-only view of one card, front and back, for the PDF route. */
export default async function CardPrintView({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireCollegeAdmin();
  const { id } = await params;
  const card = await prisma.idCard.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true },
  });
  if (!card) notFound();
  const face = await getCardFace(card.id, scope.campusId);
  if (!face) notFound();

  return (
    <div className={styles.cardPrintSheet}>
      <div dangerouslySetInnerHTML={{ __html: face.frontSvg }} />
      <div dangerouslySetInnerHTML={{ __html: face.backSvg }} />
    </div>
  );
}
