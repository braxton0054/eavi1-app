"use server";

import { CalendarEventType, TermStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin, type AdminScope } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertOpenYear,
  dateField,
  enumField,
  hiddenId,
  onSave,
  requiredDate,
  requiredNumber,
  requiredText,
  startOfToday,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const TERM_STATUSES = Object.keys(TermStatus) as (keyof typeof TermStatus)[];
const EVENT_TYPES = Object.keys(CalendarEventType) as (keyof typeof CalendarEventType)[];

const copy = pages.calendar;

const fieldLabel = (name: string) =>
  copy.terms.create.fields.find((field) => field.name === name)?.label ??
  copy.terms.edit.fields.find((field) => field.name === name)?.label ??
  copy.terms.intake.fields.find((field) => field.name === name)?.label ??
  copy.events.create.fields.find((field) => field.name === name)?.label ??
  name;

/** The calendar screen and the overview deadline/event strips all read this. */
const AFFECTED = ["/dashboard/calendar", "/dashboard"];

/** A term window has to close after it opens, and one campus cannot run two at a time. */
function orderedDates(from: Date, to: Date) {
  if (to < from) throw new FieldError(fieldErrors.dateOrder);
}

/** Once a term's window has closed, its schedule is history and stops accepting changes. */
function assertNotEnded(endDate: Date) {
  if (endDate < startOfToday()) throw new FieldError(fieldErrors.termEnded);
}

/**
 * The campus a term is written to. A campus admin is pinned to their own and the form value
 * is ignored; a super admin has no campus of their own, so they name the one being configured.
 */
async function termCampusId(scope: AdminScope, formData: FormData): Promise<number> {
  if (scope.campusId !== null) return scope.campusId;

  const campusId = requiredNumber(formData, "campusId", fieldLabel("campusId"));
  const campus = await prisma.campus.findUnique({ where: { id: campusId }, select: { id: true } });
  if (!campus) throw new FieldError(fieldErrors.choice(fieldLabel("campusId")));

  return campus.id;
}

/** The label a campus admin reads for a slot, generated so nobody types a duplicate. */
const termName = (termNo: number, year: number) => `${copy.terms.slot} ${termNo} · ${year}`;

async function assertNoOverlap(campusId: number, from: Date, to: Date, exceptId?: string) {
  const clash = await prisma.term.findFirst({
    where: {
      campusId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
      startDate: { lte: to },
      endDate: { gte: from },
    },
    select: { name: true },
  });
  if (clash) throw new FieldError(fieldErrors.windowOverlap(clash.name));
}

export async function createTerm(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const campusId = await termCampusId(scope, formData);

    const year = Math.round(requiredNumber(formData, "year", fieldLabel("year")));
    assertOpenYear(year);

    const termNo = requiredNumber(formData, "termNo", fieldLabel("termNo"));
    if (!Number.isInteger(termNo) || termNo < 1 || termNo > 3) {
      throw new FieldError(fieldErrors.termSlot(fieldLabel("termNo")));
    }

    const startDate = requiredDate(formData, "startDate", fieldLabel("startDate"));
    const endDate = requiredDate(formData, "endDate", fieldLabel("endDate"));
    orderedDates(startDate, endDate);
    assertNotEnded(endDate);

    const name = termName(termNo, year);
    const taken = await prisma.term.findUnique({
      where: { campusId_year_termNo: { campusId, year, termNo } },
      select: { id: true },
    });
    if (taken) throw new FieldError(fieldErrors.termExists(name, year));

    await assertNoOverlap(campusId, startDate, endDate);

    await unique(name, () =>
      prisma.term.create({
        data: { campusId, year, termNo, name, startDate, endDate, status: "PLANNED" },
      }),
    );
  });
}

/** A term is campus property, so its id is only honoured when it is the caller's own. */
async function ownTerm(termId: string, campusId: number | null) {
  const term = await prisma.term.findUnique({
    where: { id: termId },
    select: {
      id: true,
      campusId: true,
      year: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!term || (campusId !== null && term.campusId !== campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }
  assertOpenYear(term.year);
  return term;
}

export async function updateTerm(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const term = await ownTerm(hiddenId(formData, "termId", copy.terms.heading), scope.campusId);

    const startDate = requiredDate(formData, "startDate", fieldLabel("startDate"));
    const endDate = requiredDate(formData, "endDate", fieldLabel("endDate"));
    orderedDates(startDate, endDate);
    const status = enumField(formData, "status", TERM_STATUSES, fieldLabel("status"));

    // An ended term keeps its dates; the office can still record how it finished.
    const sameWindow =
      startDate.getTime() === term.startDate.getTime() &&
      endDate.getTime() === term.endDate.getTime();
    if (!sameWindow) assertNotEnded(term.endDate);

    await assertNoOverlap(term.campusId, startDate, endDate, term.id);

    await prisma.term.update({
      where: { id: term.id },
      data: { startDate, endDate, status },
    });
  });
}

export async function createIntake(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const termId = hiddenId(formData, "termId", copy.terms.heading);
    const term = await ownTerm(termId, scope.campusId);
    assertNotEnded(term.endDate);

    const name = requiredText(formData, "name", fieldLabel("name"));
    const applicationDeadline = requiredDate(
      formData,
      "applicationDeadline",
      fieldLabel("applicationDeadline"),
    );
    const commenceAt = requiredDate(formData, "commenceAt", fieldLabel("commenceAt"));
    orderedDates(applicationDeadline, commenceAt);

    await unique(fieldLabel("name"), () =>
      prisma.intake.create({
        data: { termId: term.id, name, applicationDeadline, commenceAt },
      }),
    );
  });
}

/**
 * With a term on the form the entry belongs to that term's campus. Without one it is a
 * college-wide entry, which only an administrator with no campus of their own may post.
 */
export async function createEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const termId = text(formData, "termId");
    const title = requiredText(formData, "title", fieldLabel("title"));
    const type = enumField(formData, "type", EVENT_TYPES, fieldLabel("type"));
    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = dateField(formData, "endsAt");
    const description = text(formData, "description");

    if (endsAt && endsAt < startsAt) throw new FieldError(fieldErrors.dateOrder);

    let campusId: number | null = null;
    let linkedTermId: string | null = null;

    if (termId) {
      const term = await ownTerm(termId, scope.campusId);
      assertNotEnded(term.endDate);
      campusId = term.campusId;
      linkedTermId = term.id;
    } else if (scope.campusId !== null) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.calendarEvent.create({
      data: { termId: linkedTermId, campusId, title, description, type, startsAt, endsAt },
    });
  });
}

export async function deleteEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const eventId = hiddenId(formData, "eventId", copy.events.heading);

    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        campusId: true,
        term: { select: { campusId: true, year: true, endDate: true } },
      },
    });
    const owner = event?.campusId ?? event?.term?.campusId ?? null;

    // A college-wide entry is the super admin's to remove; anything else goes to its campus.
    if (!event || (scope.campusId !== null && owner !== scope.campusId)) {
      throw new FieldError(fieldErrors.notOnCampus);
    }
    if (event.term) {
      assertOpenYear(event.term.year);
      assertNotEnded(event.term.endDate);
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });
  });
}
