"use server";

import { CalendarEventType, TermStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  enumField,
  hiddenId,
  onSave,
  requiredDate,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const TERM_STATUSES = Object.keys(TermStatus) as (keyof typeof TermStatus)[];
const EVENT_TYPES = Object.keys(CalendarEventType) as (keyof typeof CalendarEventType)[];

/** The "Applies to" select is static copy; only these two values are accepted. */
const SCOPES = ["campus", "college"] as const;

const copy = pages.calendar;

const fieldLabel = (name: string) =>
  copy.terms.create.fields.find((field) => field.name === name)?.label ??
  copy.terms.intake.fields.find((field) => field.name === name)?.label ??
  copy.events.create.fields.find((field) => field.name === name)?.label ??
  name;

/** The calendar screen and the overview deadline/event strips all read this. */
const AFFECTED = ["/dashboard/calendar", "/dashboard"];

/**
 * Dates need the same proof the time helper gives a class slot; `fieldErrors.timeOrder`
 * is the closest wording the copy layer offers for a reversed range.
 */
function orderedDates(earlier: Date, later: Date) {
  if (later < earlier) throw new FieldError(fieldErrors.timeOrder);
}

export async function createTerm(formData: FormData) {
  // Terms belong to the college as a whole, so the session only has to prove attendance.
  await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const name = requiredText(formData, "name", fieldLabel("name"));
    const startDate = requiredDate(formData, "startDate", fieldLabel("startDate"));
    const endDate = requiredDate(formData, "endDate", fieldLabel("endDate"));
    orderedDates(startDate, endDate);
    const status = enumField(formData, "status", TERM_STATUSES, fieldLabel("status"));

    await unique(fieldLabel("name"), () =>
      prisma.term.create({ data: { name, startDate, endDate, status } }),
    );
  });
}

export async function createIntake(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const termId = requiredText(formData, "termId", fieldLabel("termId"));
    const term = await prisma.term.findUnique({ where: { id: termId }, select: { id: true } });
    if (!term) throw new FieldError(fieldErrors.choice(fieldLabel("termId")));

    const name = requiredText(formData, "name", fieldLabel("name"));
    const applicationDeadline = requiredDate(
      formData,
      "applicationDeadline",
      fieldLabel("applicationDeadline"),
    );
    const commenceAt = requiredDate(formData, "commenceAt", fieldLabel("commenceAt"));
    orderedDates(applicationDeadline, commenceAt);

    await unique(fieldLabel("name"), () =>
      prisma.intake.create({ data: { termId, name, applicationDeadline, commenceAt } }),
    );
  });
}

export async function createEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const termId = requiredText(formData, "termId", fieldLabel("termId"));
    const term = await prisma.term.findUnique({ where: { id: termId }, select: { id: true } });
    if (!term) throw new FieldError(fieldErrors.choice(fieldLabel("termId")));

    const title = requiredText(formData, "title", fieldLabel("title"));
    const type = enumField(formData, "type", EVENT_TYPES, fieldLabel("type"));
    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = dateField(formData, "endsAt");
    const description = text(formData, "description");

    // "college" writes a null campusId, which only a super admin may do; "campus" needs
    // an administrator actually sitting on one, so a campus-less super admin is refused.
    const eventScope = enumField(formData, "scope", SCOPES, fieldLabel("scope"), "campus");
    let campusId: number | null = null;
    if (eventScope === "college") {
      if (scope.campusId !== null) throw new FieldError(fieldErrors.notOnCampus);
    } else {
      if (scope.campusId === null) throw new FieldError(fieldErrors.notOnCampus);
      campusId = scope.campusId;
    }

    await prisma.calendarEvent.create({
      data: { termId, campusId, title, description, type, startsAt, endsAt },
    });
  });
}

export async function deleteEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const eventId = hiddenId(formData, "eventId", copy.events.heading);

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { id: true, campusId: true },
    });
    // Deletable when the entry is college-wide or belongs to this admin's campus.
    if (
      !event ||
      (event.campusId !== null && scope.campusId !== null && event.campusId !== scope.campusId)
    ) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });
  });
}
