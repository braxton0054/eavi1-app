"use server";

import { AcademicPeriodStatus, CalendarEventType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin, type AdminScope } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertOpenYear,
  dateField,
  enumField,
  hiddenId,
  numberField,
  onSave,
  requiredDate,
  requiredNumber,
  requiredText,
  startOfToday,
  text,
  unique,
} from "@/lib/actions/college/_shared";

import {
  intakeDefaultName,
  intakeSequenceForMonth,
  isOfficialIntakeMonth,
} from "@/lib/academics/classes";

const PERIOD_STATUSES = Object.keys(AcademicPeriodStatus) as (keyof typeof AcademicPeriodStatus)[];
const EVENT_TYPES = Object.keys(CalendarEventType) as (keyof typeof CalendarEventType)[];

const copy = pages.calendar;
const intakeCopy = copy.semesters.intake;

const fieldLabel = (name: string) =>
  copy.semesters.create.fields.find((field) => field.name === name)?.label ??
  copy.semesters.edit.fields.find((field) => field.name === name)?.label ??
  copy.semesters.intake.fields.find((field) => field.name === name)?.label ??
  copy.events.create.fields.find((field) => field.name === name)?.label ??
  name;

/** The calendar screen and the overview deadline/event strips all read this. */
const AFFECTED = ["/dashboard/calendar", "/dashboard"];

/** A period window has to close after it opens. */
function orderedDates(from: Date, to: Date) {
  if (to < from) throw new FieldError(fieldErrors.dateOrder);
}

/** Once a period's window has closed, its schedule is history and stops accepting changes. */
function assertNotEnded(endDate: Date) {
  if (endDate < startOfToday()) throw new FieldError(fieldErrors.semesterEnded);
}

/**
 * The campus a period is written to. A campus admin is pinned to their own and the form value
 * is ignored; a super admin has no campus of their own, so they name the one being configured.
 */
async function periodCampusId(scope: AdminScope, formData: FormData): Promise<number> {
  /*
   * A campus admin is pinned to their own campus and never shown the field, so scope is the
   * whole answer for them. A super admin has no scope campus and is shown a picker; reading the
   * posted value first is what makes that picker mean anything.
   */
  const posted = numberField(formData, "campusId", fieldLabel("campusId"));
  if (posted !== null) {
    const campus = await prisma.campus.findUnique({ where: { id: posted }, select: { id: true } });
    if (!campus) throw new FieldError(fieldErrors.choice(fieldLabel("campusId")));
    // A campus admin may only ever file against their own campus, whatever was posted.
    if (scope.campusId !== null && campus.id !== scope.campusId) {
      throw new FieldError(fieldErrors.choice(fieldLabel("campusId")));
    }
    return campus.id;
  }

  if (scope.campusId !== null) return scope.campusId;

  throw new FieldError(fieldErrors.required(fieldLabel("campusId")));
}

/**
 * Only one period per campus may be active. Windows need not overlap for this to go wrong:
 * a period that ran and finished keeps its ACTIVE status until somebody closes it, and the
 * calendar then has two current periods. The window that has already closed is the one to
 * ask about, so the message names it.
 */
async function assertOnlyActive(campusId: number, exceptId?: string) {
  const other = await prisma.academicPeriod.findFirst({
    where: { campusId, status: "ACTIVE", ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { endsAt: "asc" },
    select: { name: true },
  });
  if (other) throw new FieldError(fieldErrors.semesterAlreadyActive(other.name));
}

/**
 * Creates an academic period — an intake and the teaching window that goes with it.
 *
 * The month comes from the START date, because that is what the cohort is: a January intake is
 * January however long it runs. Only January, May and September are accepted; the database holds
 * the same rule as a CHECK constraint, so a December cohort cannot be introduced by a path that
 * skips this action.
 *
 * Everything else is derived. The year and month are read from the date, the sequence is which of
 * the three periods of that year this is, and the name is "May intake 2026". An admin never types
 * any of them, so one cohort cannot appear in the list under three different spellings.
 */
export async function createPeriod(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    /*
     * Already the exact day that was typed: `requiredDate` pins a date input to UTC midnight,
     * so passing these through `startOfDay` would shift them again into the server's zone and
     * store 21:00 the day before in a UTC+3 container.
     */
    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = requiredDate(formData, "endsAt", fieldLabel("endsAt"));

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new FieldError(intakeCopy.endBeforeStart);
    }

    // The three official months, checked from the start date before anything is written: a
    // December start would create a cohort nothing downstream can place a student in.
    const month = startsAt.getMonth() + 1;
    if (!isOfficialIntakeMonth(month)) {
      throw new FieldError(intakeCopy.notAnOfficialMonth);
    }

    const applicationDeadline = requiredDate(
      formData,
      "applicationDeadline",
      fieldLabel("applicationDeadline"),
    );
    if (applicationDeadline.getTime() > endsAt.getTime()) {
      throw new FieldError(intakeCopy.deadlineAfterStart);
    }

    /*
     * The campus this period belongs to, in the order that always resolves: an explicit choice on
     * the form, then the campus already in scope. A campus admin has no campus field, so nothing
     * is posted and their scope decides. A super admin is shown a picker, and preferring the scope
     * cookie would make picking a campus in this form do nothing.
     */
    const campusId = (await periodCampusId(scope, formData)) ?? scope.campusId;

    const year = startsAt.getUTCFullYear();
    assertOpenYear(year);

    const taken = await prisma.academicPeriod.findUnique({
      where: { campusId_year_month: { campusId, year, month } },
      select: { name: true },
    });
    if (taken) throw new FieldError(fieldErrors.windowOverlap(taken.name));

    await unique(fieldLabel("name"), () =>
      prisma.academicPeriod.create({
        data: {
          campusId,
          year,
          month,
          sequence: intakeSequenceForMonth(month),
          name: intakeDefaultName(startsAt),
          startsAt,
          endsAt,
          applicationDeadline,
          status: "PLANNED",
        },
      }),
    );
  });
}

/** A period is campus property, so its id is only honoured when it is the caller's own. */
async function ownPeriod(periodId: string, campusId: number | null) {
  const period = await prisma.academicPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, campusId: true, year: true, startsAt: true, endsAt: true },
  });
  if (!period || (campusId !== null && period.campusId !== campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }
  assertOpenYear(period.year);
  return period;
}

/**
 * Edits a period's teaching window and status.
 *
 * The month and year are not editable: they are the period's identity, and every class, invoice
 * and enrolment points at it. A window that moved to a different month would leave students
 * attached to a cohort that no longer matches the date they started. To change the month, create
 * the right period and move the students.
 */
export async function updatePeriod(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const period = await ownPeriod(hiddenId(formData, "periodId", copy.semesters.heading), scope.campusId);

    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = requiredDate(formData, "endsAt", fieldLabel("endsAt"));
    orderedDates(startsAt, endsAt);
    const status = enumField(formData, "status", PERIOD_STATUSES, fieldLabel("status"));

    // A period's start date IS its intake month, so it may only move within that month.
    if (startsAt.getUTCMonth() + 1 !== period.startsAt.getUTCMonth() + 1) {
      throw new FieldError(intakeCopy.monthIsFixed);
    }

    const applicationDeadline = requiredDate(
      formData,
      "applicationDeadline",
      fieldLabel("applicationDeadline"),
    );
    if (applicationDeadline.getTime() > startsAt.getTime()) {
      throw new FieldError(intakeCopy.deadlineAfterStart);
    }

    if (status === "ACTIVE") await assertOnlyActive(period.campusId, period.id);

    // An ended period keeps its dates; the office can still record how it finished.
    const sameWindow =
      startsAt.getTime() === period.startsAt.getTime() && endsAt.getTime() === period.endsAt.getTime();
    if (!sameWindow) assertNotEnded(period.endsAt);

    await prisma.academicPeriod.update({
      where: { id: period.id },
      data: { startsAt, endsAt, applicationDeadline, status },
    });
  });
}

/**
 * With a semester on the form the entry belongs to that semester's campus. Without one it is a
 * college-wide entry, which only an administrator with no campus of their own may post.
 */
export async function createEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const periodId = text(formData, "periodId");
    const title = requiredText(formData, "title", fieldLabel("title"));
    const type = enumField(formData, "type", EVENT_TYPES, fieldLabel("type"));
    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = dateField(formData, "endsAt");
    const description = text(formData, "description");

    if (endsAt && endsAt < startsAt) throw new FieldError(fieldErrors.dateOrder);

    let campusId: number | null = null;
    let linkedPeriodId: string | null = null;

    if (periodId) {
      const period = await ownPeriod(periodId, scope.campusId);
      assertNotEnded(period.endsAt);
      campusId = period.campusId;
      linkedPeriodId = period.id;
    } else if (scope.campusId !== null) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.calendarEvent.create({
      data: { periodId: linkedPeriodId, campusId, title, description, type, startsAt, endsAt },
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
        period: { select: { campusId: true, year: true, endsAt: true } },
      },
    });
    const owner = event?.campusId ?? event?.period?.campusId ?? null;

    // A college-wide entry is the super admin's to remove; anything else goes to its campus.
    if (!event || (scope.campusId !== null && owner !== scope.campusId)) {
      throw new FieldError(fieldErrors.notOnCampus);
    }
    if (event.period) {
      assertOpenYear(event.period.year);
      assertNotEnded(event.period.endsAt);
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });
  });
}
