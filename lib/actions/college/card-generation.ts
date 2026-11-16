"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { pages } from "@/lib/content/dashboard";
import { getCardCandidates, type CardTarget } from "@/lib/dal/cards";
import { enqueueCardBatch } from "@/lib/queue/queues";

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
 * Records the chosen students as a print run and hands the rendering to the queue.
 *
 * The request answers in the time it takes to count the candidates: the batch row is
 * created in state PENDING, the job carries everything the worker needs, and the browser
 * lands on the batch page where the run's own progress is shown. Rendering used to happen
 * right here — a batch of four hundred cards held the request for the better part of a
 * minute and died with it.
 *
 * The validation that guards what a run may cover (an empty or oversized target) stays
 * synchronous: those answers are the office's to fix now, not the worker's to discover.
 */
export async function generateCards(formData: FormData) {
  const scope = await requireCollegeAdmin();

  const target = readTarget(formData);
  if (!target) redirect("/dashboard/cards?invalid=1");

  const candidates = await getCardCandidates(target, scope.campusId);
  if (candidates.length === 0) redirect("/dashboard/cards?empty=1");
  if (candidates.length > MAX_CARDS) redirect("/dashboard/cards?tooMany=1");

  const batch = await prisma.cardBatch.create({
    data: {
      campusId: scope.campusId,
      targetLabel: await targetLabel(target),
      cardCount: 0,
      sheetCount: 0,
      fileUrl: null,
      status: "PENDING",
      actorId: scope.userId,
      actorEmail: scope.email,
    },
    select: { id: true },
  });

  try {
    // The batch row's id is the job's id, so a double submit cannot queue a run twice.
    await enqueueCardBatch({
      batchId: batch.id,
      target,
      campusId: scope.campusId,
      actorId: scope.userId,
      actorEmail: scope.email,
    });
  } catch (error) {
    // Redis unreachable: the run must not sit pending forever pretending to be coming.
    console.error("card batch could not be queued:", error);
    await prisma.cardBatch.update({ where: { id: batch.id }, data: { status: "FAILED" } });
  }

  redirect(`/dashboard/cards/batches/${batch.id}`);
}
