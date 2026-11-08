"use server";

import { CalendarEventType, SemesterStatus } from "@/generated/prisma/enums";
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

import { startOfDay } from "@/lib/academics/progression";
import { intakeMeta, intakeValueForMonth, isOfficialIntakeMonth } from "@/lib/academics/classes";

const SEMESTER_STATUSES = Object.keys(SemesterStatus) as (keyof typeof SemesterStatus)[];
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

/** A semester window has to close after it opens, and one campus cannot run two at a time. */
function orderedDates(from: Date, to: Date) {
  if (to < from) throw new FieldError(fieldErrors.dateOrder);
}

/** Once a semester's window has closed, its schedule is history and stops accepting changes. */
function assertNotEnded(endDate: Date) {
  if (endDate < startOfToday()) throw new FieldError(fieldErrors.semesterEnded);
}

/**
 * The campus a semester is written to. A campus admin is pinned to their own and the form value
 * is ignored; a super admin has no campus of their own, so they name the one being configured.
 */
async function semesterCampusId(scope: AdminScope, formData: FormData): Promise<number> {
  if (scope.campusId !== null) return scope.campusId;

  const campusId = requiredNumber(formData, "campusId", fieldLabel("campusId"));
  const campus = await prisma.campus.findUnique({ where: { id: campusId }, select: { id: true } });
  if (!campus) throw new FieldError(fieldErrors.choice(fieldLabel("campusId")));

  return campus.id;
}

/** The label a campus admin reads for a slot, generated so nobody types a duplicate. */
const semesterName = (semesterNo: number, year: number) => `${copy.semesters.slot} ${semesterNo} · ${year}`;

async function assertNoOverlap(campusId: number, from: Date, to: Date, exceptId?: string) {
  const clash = await prisma.semester.findFirst({
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

/**
 * Only one semester per campus may be active. Windows need not overlap for this to go wrong:
 * a term that ran and finished keeps its ACTIVE status until somebody closes it, and the
 * calendar then has two current semesters. The window that has already closed is the one to
 * ask about, so the message names it.
 */
async function assertOnlyActive(campusId: number, exceptId?: string) {
  const other = await prisma.semester.findFirst({
    where: { campusId, status: "ACTIVE", ...(exceptId ? { id: { not: exceptId } } : {}) },
    orderBy: { endDate: "asc" },
    select: { name: true },
  });
  if (other) throw new FieldError(fieldErrors.semesterAlreadyActive(other.name));
}

export async function createSemester(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const campusId = await semesterCampusId(scope, formData);

    const year = Math.round(requiredNumber(formData, "year", fieldLabel("year")));
    assertOpenYear(year);

    const semesterNo = requiredNumber(formData, "semesterNo", fieldLabel("semesterNo"));
    if (!Number.isInteger(semesterNo) || semesterNo < 1 || semesterNo > 3) {
      throw new FieldError(fieldErrors.semesterSlot(fieldLabel("semesterNo")));
    }

    const startDate = requiredDate(formData, "startDate", fieldLabel("startDate"));
    const endDate = requiredDate(formData, "endDate", fieldLabel("endDate"));
    orderedDates(startDate, endDate);
    assertNotEnded(endDate);

    const name = semesterName(semesterNo, year);
    const taken = await prisma.semester.findUnique({
      where: { campusId_year_semesterNo: { campusId, year, semesterNo } },
      select: { id: true },
    });
    if (taken) throw new FieldError(fieldErrors.semesterExists(name, year));

    await assertNoOverlap(campusId, startDate, endDate);

    await unique(name, () =>
      prisma.semester.create({
        data: { campusId, year, semesterNo, name, startDate, endDate, status: "PLANNED" },
      }),
    );
  });
}

/** A semester is campus property, so its id is only honoured when it is the caller's own. */
async function ownSemester(semesterId: string, campusId: number | null) {
  const semester = await prisma.semester.findUnique({
    where: { id: semesterId },
    select: {
      id: true,
      campusId: true,
      year: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!semester || (campusId !== null && semester.campusId !== campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }
  assertOpenYear(semester.year);
  return semester;
}

export async function updateSemester(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const semester = await ownSemester(hiddenId(formData, "semesterId", copy.semesters.heading), scope.campusId);

    const startDate = requiredDate(formData, "startDate", fieldLabel("startDate"));
    const endDate = requiredDate(formData, "endDate", fieldLabel("endDate"));
    orderedDates(startDate, endDate);
    const status = enumField(formData, "status", SEMESTER_STATUSES, fieldLabel("status"));

    // Marking this one active has to leave the campus with exactly one active semester.
    if (status === "ACTIVE") await assertOnlyActive(semester.campusId, semester.id);

    // An ended semester keeps its dates; the office can still record how it finished.
    const sameWindow =
      startDate.getTime() === semester.startDate.getTime() &&
      endDate.getTime() === semester.endDate.getTime();
    if (!sameWindow) assertNotEnded(semester.endDate);

    await assertNoOverlap(semester.campusId, startDate, endDate, semester.id);

    await prisma.semester.update({
      where: { id: semester.id },
      data: { startDate, endDate, status },
    });
  });
}

/**
 * Creates an official intake from its start and end dates.
 *
 * The month comes from the START date, because that is what the cohort is: a January intake is
 * January however long it runs. Deriving it from the commence date — or from the semester the
 * entry happened to be filed under — is how an intake ended up with a month no class could
 * match, and the class layer refuses anything but January, May and September.
 *
 * The semester is optional now. An intake only ever used it as calendar decoration, and requiring
 * one meant the college could not record a May or September intake until somebody had first set up
 * a semester to hang it on.
 */
export async function createIntake(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const startRaw = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endRaw = requiredDate(formData, "endsAt", fieldLabel("endsAt"));
    const startsAt = startOfDay(startRaw);
    const endsAt = startOfDay(endRaw);

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new FieldError(intakeCopy.endBeforeStart);
    }

    // The three official months, checked from the start date before anything is written: a
    // December start would create a cohort the class picker can never place a student in.
    const month = startsAt.getMonth() + 1;
    if (!isOfficialIntakeMonth(month)) {
      throw new FieldError(intakeCopy.notAnOfficialMonth);
    }

    const name =
      text(formData, "name")?.trim() ||
      `${intakeMeta(intakeValueForMonth(month)).name} intake ${startsAt.getFullYear()}`;

    const applicationDeadline = requiredDate(
      formData,
      "applicationDeadline",
      fieldLabel("applicationDeadline"),
    );
    if (applicationDeadline.getTime() > startsAt.getTime()) {
      throw new FieldError(intakeCopy.deadlineAfterStart);
    }

    // Optional, and only kept when it really belongs to this admin's campus.
    const semesterId = text(formData, "semesterId") || null;
    const semester = semesterId ? await ownSemester(semesterId, scope.campusId) : null;
    /*
     * The campus this intake belongs to, in the order that always resolves: the semester it is
     * filed under, then the campus already in scope, then the field on the form.
     *
     * A super admin who has picked a campus in the header is already saying "this campus" for
     * every screen, so asking them again in this one form would be a second question with the
     * same answer — and the form does not even offer it in that case.
     */
    const campusId =
      semester?.campusId ?? scope.campusId ?? (await semesterCampusId(scope, formData));

    await unique(fieldLabel("name"), () =>
      prisma.intake.create({
        data: {
          semesterId: semester?.id ?? null,
          campusId,
          year: startsAt.getFullYear(),
          month,
          startsAt,
          endsAt,
          name,
          applicationDeadline,
          commenceAt: startsAt,
        },
      }),
    );
  });
}

/**
 * With a semester on the form the entry belongs to that semester's campus. Without one it is a
 * college-wide entry, which only an administrator with no campus of their own may post.
 */
export async function createEvent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/calendar", AFFECTED, async () => {
    const semesterId = text(formData, "semesterId");
    const title = requiredText(formData, "title", fieldLabel("title"));
    const type = enumField(formData, "type", EVENT_TYPES, fieldLabel("type"));
    const startsAt = requiredDate(formData, "startsAt", fieldLabel("startsAt"));
    const endsAt = dateField(formData, "endsAt");
    const description = text(formData, "description");

    if (endsAt && endsAt < startsAt) throw new FieldError(fieldErrors.dateOrder);

    let campusId: number | null = null;
    let linkedSemesterId: string | null = null;

    if (semesterId) {
      const semester = await ownSemester(semesterId, scope.campusId);
      assertNotEnded(semester.endDate);
      campusId = semester.campusId;
      linkedSemesterId = semester.id;
    } else if (scope.campusId !== null) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.calendarEvent.create({
      data: { semesterId: linkedSemesterId, campusId, title, description, type, startsAt, endsAt },
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
        semester: { select: { campusId: true, year: true, endDate: true } },
      },
    });
    const owner = event?.campusId ?? event?.semester?.campusId ?? null;

    // A college-wide entry is the super admin's to remove; anything else goes to its campus.
    if (!event || (scope.campusId !== null && owner !== scope.campusId)) {
      throw new FieldError(fieldErrors.notOnCampus);
    }
    if (event.semester) {
      assertOpenYear(event.semester.year);
      assertNotEnded(event.semester.endDate);
    }

    await prisma.calendarEvent.delete({ where: { id: event.id } });
  });
}
