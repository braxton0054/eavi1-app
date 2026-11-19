"use server";

import { Weekday } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  enumField,
  hiddenId,
  onSave,
  orderedTimes,
  requiredText,
  text,
  timeField,
} from "@/lib/actions/college/_shared";

const DAYS = Object.keys(Weekday) as (keyof typeof Weekday)[];

const copy = pages.timetable;

const fieldLabel = (name: string) =>
  copy.create.fields.find((field) => field.name === name)?.label ?? name;

/** The week grid, the tutor loads and the teaching-load report all read this. */
const AFFECTED = ["/dashboard/timetable", "/dashboard", "/dashboard/reports"];

export async function createSlot(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/timetable", AFFECTED, async () => {
    // A class always sits in one campus, so a campus-less super admin cannot add a slot.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    const tutorId = text(formData, "tutorId");
    if (tutorId) {
      const tutor = await prisma.tutorProfile.findFirst({
        where: { id: tutorId, ...(campusId === null ? {} : { campuses: { some: { id: campusId } } }) },
        select: { id: true },
      });
      if (!tutor) throw new FieldError(fieldErrors.notOnCampus);
    }

    const day = enumField(formData, "day", DAYS, fieldLabel("day"));
    const startAt = timeField(formData, "startAt", fieldLabel("startAt"));
    const endAt = timeField(formData, "endAt", fieldLabel("endAt"));
    // The helpers throw when a required time is missing; the guards only narrow the type.
    if (!startAt) throw new FieldError(fieldErrors.required(fieldLabel("startAt")));
    if (!endAt) throw new FieldError(fieldErrors.required(fieldLabel("endAt")));
    orderedTimes(startAt, endAt);

    await prisma.timetableSlot.create({
      data: {
        campusId,
        programId,
        tutorId: tutorId ?? null,
        day,
        startAt,
        endAt,
        room: text(formData, "room"),
        weekOffsetLabel: text(formData, "weekOffsetLabel"),
      },
    });
  });
}

export async function deleteSlot(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/timetable", AFFECTED, async () => {
    const slotId = hiddenId(formData, "slotId", copy.title);

    const slot = await prisma.timetableSlot.findFirst({
      where: { id: slotId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true },
    });
    if (!slot) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.timetableSlot.delete({ where: { id: slot.id } });
  });
}
