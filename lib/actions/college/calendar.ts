"use server";

import { AcademicPeriodStatus, CalendarEventType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertOpenYear,
  dateField,
  enumField,
  hiddenId,
  onSave,
  requiredDate,
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
 * Only one period in the college may be active. Windows need not overlap for this to go wrong:
 * a period that ran and finished keeps its ACTIVE status until somebody closes it, and the
 * calendar then has two current periods. The window that has already closed is the one to
 * ask about, so the message names it.
 */
async function assertOnlyActive(exceptId?: string) {
  const other = await prisma.academicPeriod.findFirst({
    where: { status: "ACTIVE", ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { endsAt: "asc" },
    select: { name: true },
  });
  if (other) throw new FieldError(fieldErrors.semesterAlreadyActive(other.name));
}

/**
 * Creates the college's next academic period — an intake and the teaching window that goes with
 * it. There is one row per year and month for the whole college; every campus reads the same one.
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
  await requireCollegeAdmin();

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
    // The database requires applications to close before teaching starts. Match it here so the
    // office gets a field error rather than a raw constraint failure.
    if (applicationDeadline.getTime() > startsAt.getTime()) {
      throw new FieldError(intakeCopy.deadlineAfterStart);
    }

    const year = startsAt.getUTCFullYear();
    assertOpenYear(year);

    const taken = await prisma.academicPeriod.findUnique({
      where: { year_month: { year, month } },
      select: { name: true },
    });
    if (taken) throw new FieldError(fieldErrors.windowOverlap(taken.name));

    await unique(fieldLabel("name"), () =>
      prisma.academicPeriod.create({
        data: {
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

/** Every admin edits the one shared period; only its id needs checking. */
async function ownPeriod(periodId: string) {
  const period = await prisma.academicPeriod.findUnique({
    where: { id: periodId },
    select: { id: true, year: true, startsAt: true, endsAt: true },
  });
  if (!period) throw new FieldError(fieldErrors.notFound);
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
  await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const period = await ownPeriod(hiddenId(formData, "periodId", copy.semesters.heading));

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

    if (status === "ACTIVE") await assertOnlyActive(period.id);

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
 * An entry on a shared period is college-wide, so every campus sees it. A standalone entry is
 * campus property for a campus admin and college-wide for an administrator with no campus scope.
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

    let campusId: number | null = scope.campusId;
    let linkedPeriodId: string | null = null;

    if (periodId) {
      const period = await ownPeriod(periodId);
      assertNotEnded(period.endsAt);
      // The period is shared, so an entry filed against it belongs to the whole college.
      campusId = null;
      linkedPeriodId = period.id;
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
        periodId: true,
        period: { select: { year: true, endsAt: true } },
      },
    });

    if (!event) throw new FieldError(fieldErrors.notFound);

    /*
     * Period-linked entries are college-wide, so every campus admin may remove them. A standalone
     * entry belongs to the campus that filed it; a college-wide one belongs only to a super admin.
     */
    if (scope.campusId !== null && event.periodId === null && event.campusId !== scope.campusId) {
      throw new FieldError(fieldErrors.notOnCampus);
    }
    if (event.period) {
      assertOpenYear(event.period.year);
      assertNotEnded(event.period.endsAt);
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });
  });
}
