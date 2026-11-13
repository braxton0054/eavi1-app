"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { storageConfigured, uploadFile } from "@/lib/storage";
import { pages } from "@/lib/content/dashboard";
import { buildPrintableCards, getCardCandidates, type CardTarget } from "@/lib/dal/cards";
import { paginateSheets } from "@/lib/cards/sheet";
import { renderSheetPng } from "@/lib/cards/render";
import { buildCardsPdf } from "@/lib/cards/pdf";
import { recordAudit } from "@/lib/academics/audit";

const copy = pages.cards.generate;

/** A run larger than this is refused rather than left to spin until the request times out. */
const MAX_CARDS = 400;

/** Reads the picker into a target, so the action never guesses who is included. */
function readTarget(formData: FormData): CardTarget | null {
  const kind = String(formData.get("targetKind") ?? "");

  if (kind === "student") {
    const studentId = String(formData.get("studentId") ?? "").trim();
    return studentId ? { kind, studentId } : null;
  }
  if (kind === "class") {
    const classId = String(formData.get("classId") ?? "").trim();
    return classId ? { kind, classId } : null;
  }
  if (kind === "intake") {
    const intakeId = String(formData.get("intakeId") ?? "").trim();
    return intakeId ? { kind, intakeId } : null;
  }
  return null;
}

/** A readable name for the run, taken from the chosen target rather than typed. */
async function targetLabel(target: CardTarget) {
  if (target.kind === "student") {
    const row = await prisma.studentProfile.findUnique({
      where: { id: target.studentId },
      select: { admissionNo: true },
    });
    return `${copy.kinds.student} · ${row?.admissionNo ?? ""}`.trim();
  }
  if (target.kind === "class") {
    const row = await prisma.academicClass.findUnique({
      where: { id: target.classId },
      select: { name: true },
    });
    return `${copy.kinds.class} · ${row?.name ?? ""}`.trim();
  }
  const row = await prisma.academicPeriod.findUnique({
    where: { id: target.intakeId },
    select: { name: true },
  });
  return `${copy.kinds.intake} · ${row?.name ?? ""}`.trim();
}

/**
 * Renders the chosen students onto print sheets and stores the PDF.
 *
 * The run is saved as a batch and the browser is sent to that batch inside the portal, so
 * the file is viewed and downloaded on the system rather than thrown at a separate tab or a
 * raw storage URL that leaves the portal behind.
 */
export async function generateCards(formData: FormData) {
  const scope = await requireCollegeAdmin();

  const target = readTarget(formData);
  if (!target) redirect("/dashboard/cards?invalid=1");

  const candidates = await getCardCandidates(target, scope.campusId);
  if (candidates.length === 0) redirect("/dashboard/cards?empty=1");
  if (candidates.length > MAX_CARDS) redirect("/dashboard/cards?tooMany=1");

  const { cards } = await buildPrintableCards(target, scope.campusId);
  if (cards.length === 0) redirect("/dashboard/cards?empty=1");

  const { sheets } = paginateSheets(cards);

  // Fronts and backs are separate pages, in sheet order, so a duplex print flips cleanly.
  const images = [];
  for (const sheet of sheets) {
    const bind = copy.sheetCaption(sheet.page, sheets.length);
    images.push({ png: await renderSheetPng(sheet, "fronts", `${bind} · ${copy.frontLabel}`), label: "front" });
    images.push({ png: await renderSheetPng(sheet, "backs", `${bind} · ${copy.backLabel}`), label: "back" });
  }

  const pdf = await buildCardsPdf(images);

  // Without storage the batch is still recorded so the run can be seen, just not reopened.
  const fileUrl = storageConfigured()
    ? await uploadFile(`id-cards/${Date.now()}-${cards.length}-cards.pdf`, pdf, "application/pdf")
    : null;

  const batch = await prisma.cardBatch.create({
    data: {
      campusId: scope.campusId,
      targetLabel: await targetLabel(target),
      cardCount: cards.length,
      sheetCount: sheets.length,
      fileUrl,
      actorId: scope.userId,
      actorEmail: scope.email,
    },
    select: { id: true },
  });

  await recordAudit({
    campusId: scope.campusId,
    actorId: scope.userId,
    actorEmail: scope.email,
    action: "card.generate",
    entityType: "card",
    entityId: batch.id,
    detail: { cards: cards.length, sheets: sheets.length },
  });

  redirect(`/dashboard/cards/batches/${batch.id}`);
}
