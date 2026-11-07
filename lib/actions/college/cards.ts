"use server";

import { randomUUID } from "node:crypto";

import { CardStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  nextCardSerial,
  onSave,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const STATUSES = Object.keys(CardStatus) as (keyof typeof CardStatus)[];

const fieldLabel = (name: string) =>
  pages.cards.create.fields.find((field) => field.name === name)?.label ?? name;

/** A card is identified to the administrator by its serial, so that is the label used. */
const serialLabel = pages.cards.print.serialLabel;

const statusLabel = pages.cards.move.statusField.label;

/** The card pipeline and the overview counter for pending cards both read this. */
const AFFECTED = ["/dashboard/cards", "/dashboard"];

export async function createCard(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/cards", AFFECTED, async () => {
    const studentId = requiredText(formData, "studentId", fieldLabel("studentId"));
    const programId = text(formData, "programId");
    const expiresAt = dateField(formData, "expiresAt");
    const remarks = text(formData, "remarks");

    const student = await prisma.studentProfile.findFirst({
      where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { campusId: true },
    });
    if (!student) throw new FieldError(fieldErrors.notOnCampus);

    if (programId) {
      const program = await prisma.program.findFirst({
        where: {
          id: programId,
          ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
        },
        select: { id: true },
      });
      if (!program) throw new FieldError(fieldErrors.notOnCampus);
    }

    // The card follows the student, so a super admin's request is filed under their campus.
    // The token is the unguessable half of the QR verification link; the serial stays sequential.
    const serial = await nextCardSerial();

    await unique(serialLabel, () =>
      prisma.idCard.create({
        data: {
          serial,
          verifyToken: randomUUID(),
          studentId,
          campusId: student.campusId,
          programId: programId ?? null,
          expiresAt,
          remarks,
          status: CardStatus.PENDING,
        },
      }),
    );
  });
}

export async function moveCard(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/cards", AFFECTED, async () => {
    const cardId = hiddenId(formData, "cardId", serialLabel);
    const status = enumField(formData, "status", STATUSES, statusLabel);

    const card = await prisma.idCard.findFirst({
      where: { id: cardId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, status: true, studentId: true },
    });
    if (!card) throw new FieldError(fieldErrors.notOnCampus);

    // Issuing stamps the day; every other move drops it. A card already issued may still be
    // reported lost, so an ISSUED -> LOST transition is deliberately allowed through.
    await prisma.idCard.update({
      where: { id: card.id },
      data: { status, issuedAt: status === CardStatus.ISSUED ? new Date() : null },
    });

    // Marking one card replaced retires any live card the student still holds, so two
    // issued cards can never exist for the same person at once.
    if (status === CardStatus.REPLACED) {
      await prisma.idCard.updateMany({
        where: {
          studentId: card.studentId,
          status: CardStatus.ISSUED,
          id: { not: card.id },
        },
        data: { status: CardStatus.REPLACED, issuedAt: null },
      });
    }
  });
}
