import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { ensureDocument } from "@/lib/documents/service";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** A print-only view of the saved card artwork — front and back on one A4 sheet. */
export default async function CardPrintView({ params }: { params: Promise<{ id: string }> }) {
  const scope = await requireCollegeAdmin();
  const { id } = await params;
  const card = await prisma.idCard.findFirst({
    where: { id, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true },
  });
  if (!card) notFound();
  const document = await ensureDocument("ID_CARD", card.id);
  if (!document) notFound();

  return (
    <div className={styles.cardPrintSheet}>
      <div dangerouslySetInnerHTML={{ __html: document.svgText }} />
    </div>
  );
}
