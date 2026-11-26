import { prisma } from "@/lib/prisma";
import { labels, studentPortal } from "@/lib/content/dashboard";
import { site } from "@/lib/content/home";
import { formatDate } from "@/lib/format";
import { ensureDocument } from "@/lib/documents/service";
import { savedCardFaces } from "@/lib/documents/renderers";
import { getStudentCard, getStudentProfile } from "@/lib/dal/student-portal";
import { cardLifecycle } from "@/lib/cards/status";
import { verifyUrl } from "@/lib/cards/qr";
import IdCardsClient, { type CardDetails, type CardHistoryItem } from "./id-cards-client";

export default async function StudentCardPage() {
  const { student, card } = await getStudentCard();
  const { profile, enrollment } = await getStudentProfile();

  const now = new Date();
  const activelyEnrolled = enrollment?.status === "ACTIVE";
  const lifecycle = card ? cardLifecycle(card, activelyEnrolled, now) : null;
  const intake = enrollment?.period
    ? `${labels.months[enrollment.period.month - 1] ?? ""} ${enrollment.period.year}`.trim()
    : null;

  const details: CardDetails = {
    name: profile?.user.fullName ?? "",
    admissionNo: profile?.admissionNo ?? "—",
    program: enrollment?.program.name ?? "—",
    campus: profile?.campus.name ?? "—",
    className: enrollment?.memberships[0]?.class.name ?? "—",
    intake: intake ?? "—",
    validUntil: card?.expiresAt ? formatDate(card.expiresAt) : "—",
    issuedAt: card?.issuedAt ? formatDate(card.issuedAt) : null,
    serial: card?.serial ?? null,
    email: profile?.user.email ?? null,
  };

  // Pending, lost, and replaced cards never create or expose downloadable artwork.
  const saved = card && lifecycle?.canDownload ? await ensureDocument("ID_CARD", card.id) : null;
  const faces = saved ? savedCardFaces(saved.svgText) : null;
  const previewUnavailable = Boolean(card && lifecycle?.canDownload && !faces?.frontSvg);
  const verificationLink = card ? verifyUrl(site.url, card.verifyToken) : null;

  const rows = await prisma.idCard.findMany({
    where: { studentId: student.studentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, serial: true, status: true, issuedAt: true, expiresAt: true },
  });

  const history: CardHistoryItem[] = rows.map((row) => ({
    id: row.id,
    serial: row.serial,
    issuedAt: row.issuedAt ? formatDate(row.issuedAt) : null,
    expiresAt: row.expiresAt ? formatDate(row.expiresAt) : null,
    state: cardLifecycle(row, activelyEnrolled, now),
  }));

  return (
    <IdCardsClient
      details={details}
      lifecycle={lifecycle}
      faceFront={faces?.frontSvg ?? null}
      faceBack={faces?.backSvg ?? null}
      previewUnavailable={previewUnavailable}
      verificationLink={verificationLink}
      cards={history}
      title={studentPortal.id.title}
      description={studentPortal.id.description}
    />
  );
}
