import { prisma } from "@/lib/prisma";
import { labels } from "@/lib/content/dashboard";
import { site } from "@/lib/content/home";
import { formatDate } from "@/lib/format";
import { getCardFace } from "@/lib/dal/cards";
import { getStudentCard, getStudentProfile } from "@/lib/dal/student-portal";
import type { IdCardStudent } from "@/components/id-card-svg";
import IdCardsClient from "./id-cards-client";

export default async function StudentCardPage() {
  const { student, card } = await getStudentCard();
  const { profile, enrollment } = await getStudentProfile();

  // Compared on the server, once: reading the clock during render is not deterministic.
  const now = Date.now();
  const expired = card?.expiresAt ? card.expiresAt.getTime() < now : false;

  // The same intake label the print merge uses, so the proof matches the card.
  const intake = enrollment?.period
    ? `${labels.months[enrollment.period.month - 1] ?? ""} ${enrollment.period.year}`.trim()
    : null;

  const initial: IdCardStudent = {
    name: profile?.user.fullName ?? "",
    adm: profile?.admissionNo ?? "",
    course: enrollment?.program.name ?? "—",
    campus: profile?.campus.name ?? "—",
    validUntil: card?.expiresAt ? formatDate(card.expiresAt) : "—",
    photoUrl: profile?.profilePhotoUrl ?? undefined,
    status: expired ? "Expired" : "Active",
    intake,
    issueDate: card?.issuedAt ? formatDate(card.issuedAt) : null,
    email: profile?.user.email ?? null,
    website: site.url ?? null,
    serial: card?.serial ?? null,
    verifyToken: card?.verifyToken ?? null,
  };

  // The card is read through the same scope-checked getter the office uses, so artwork and
  // the QR link are identical to what is printed on the plastic.
  const face = card ? await getCardFace(card.id, student.campusId) : null;

  // Every card this student has ever held: the newest first, replaced and lost ones included.
  const rows = await prisma.idCard.findMany({
    where: { studentId: student.studentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, serial: true, status: true, issuedAt: true, expiresAt: true },
  });

  return (
    <IdCardsClient
      initial={initial}
      hasCard={Boolean(card && face)}
      faceFront={face?.frontSvg ?? null}
      faceBack={face?.backSvg ?? null}
      verifyUrl={card ? face?.where ?? null : null}
      cards={rows.map((row) => ({
        id: row.id,
        serial: row.serial,
        status: row.status,
        issuedAt: row.issuedAt ? formatDate(row.issuedAt) : null,
        expiresAt: row.expiresAt ? formatDate(row.expiresAt) : null,
        expired: row.expiresAt ? row.expiresAt.getTime() < now : false,
      }))}
    />
  );
}
