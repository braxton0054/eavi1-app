/**
 * Every read for the college-admin portal. Each exported getter resolves the session
 * first and then calls an unexported function that takes the campus id, so a caller can
 * never ask for another campus's rows by passing a different id.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { campusWhere, requireCollegeAdmin, type AdminScope } from "@/lib/session";
import { pagination } from "@/lib/content/dashboard";

export type ListQuery = { q?: string; status?: string; page?: number };

const money = (value: unknown) => Number(String(value ?? 0)) || 0;

const contains = (semester: string) => ({ contains: semester, mode: "insensitive" as const });

function trimmed(q?: string) {
  const semester = q?.trim();
  return semester ? semester : null;
}

function clampPage(page: number | undefined) {
  return Math.max(1, Math.floor(Number(page) || 1));
}

/** Scalar columns only — relation searches get their own matcher below. */
function searchWhere(q: string | undefined, fields: string[]) {
  const semester = trimmed(q);
  if (!semester) return {};
  return { OR: fields.map((field) => ({ [field]: contains(semester) })) };
}

function studentSearch(q: string | undefined) {
  const semester = trimmed(q);
  if (!semester) return {};
  return {
    OR: [
      { admissionNo: contains(semester) },
      { guardianName: contains(semester) },
      { user: { OR: [{ fullName: contains(semester) }, { email: contains(semester) }] } },
    ],
  };
}

function throughStudent(q: string | undefined) {
  const semester = trimmed(q);
  return semester ? { student: studentSearch(semester) } : {};
}

function tutorSearch(q: string | undefined) {
  const semester = trimmed(q);
  if (!semester) return {};
  return {
    OR: [
      { staffNo: contains(semester) },
      { department: contains(semester) },
      { user: { OR: [{ fullName: contains(semester) }, { email: contains(semester) }] } },
    ],
  };
}

/** Rejects anything that is not one of the enum keys, so a bad query string cannot throw. */
function pick<T extends Record<string, string>>(map: T, raw: string | undefined): keyof T | undefined {
  return raw && Object.prototype.hasOwnProperty.call(map, raw) ? (raw as keyof T) : undefined;
}

/** Throws the row away if it belongs to another campus. */
function assertCampus<T extends { campusId: number | null }>(
  row: T,
  campusId: number | null,
): T {
  if (campusId !== null && row.campusId !== campusId) {
    throw new Error("not_found");
  }
  return row;
}

export async function getOverview() {
  const scope = await requireCollegeAdmin();
  return { scope, ...(await overviewFor(scope.campusId)) };
}

async function overviewFor(campusId: number | null) {
  const where = campusWhere(campusId);
  const now = new Date();

  const [students, activeEnrollments, applicationsOpen, tutors, cardsPending, lineTotals, paymentTotals] =
    await Promise.all([
      prisma.studentProfile.count({ where }),
      prisma.enrollment.count({ where: { ...where, status: "ACTIVE" } }),
      prisma.application.count({ where: { ...where, status: { in: ["SUBMITTED", "REVIEWING"] } } }),
      prisma.tutorProfile.count({ where }),
      prisma.idCard.count({ where: { ...where, status: { in: ["PENDING", "PRINTING"] } } }),
      prisma.invoiceLine.aggregate({ _sum: { amount: true }, where: { invoice: where } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: where } }),
    ]);

  const billed = money(lineTotals._sum.amount);
  const collected = money(paymentTotals._sum.amount);

  const deadlines = await prisma.intake.findMany({
    where: { semester: { status: "ACTIVE" }, commenceAt: { gte: now } },
    orderBy: { applicationDeadline: "asc" },
    take: 4,
    include: { semester: { select: { name: true } } },
  });

  const events = await prisma.calendarEvent.findMany({
    where: { OR: [{ campusId: null }, campusId === null ? {} : { campusId }], startsAt: { gte: now } },
    orderBy: { startsAt: "asc" },
    take: 5,
    include: { semester: { select: { name: true } }, campus: { select: { name: true } } },
  });

  const exams = await prisma.exam.findMany({
    where: { ...where, date: { gte: now }, status: { in: ["DRAFT", "SCHEDULED"] } },
    orderBy: { date: "asc" },
    take: 5,
    include: { program: { select: { name: true, code: true } } },
  });

  const recentStudents = await prisma.studentProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      admissionNo: true,
      createdAt: true,
      user: { select: { fullName: true } },
      enrollments: { where: { status: "ACTIVE" }, take: 1, select: { program: { select: { name: true } } } },
    },
  });

  const announcements = await prisma.announcement.findMany({
    where: { OR: [{ campusId: null }, campusId === null ? {} : { campusId }] },
    orderBy: { publishedAt: "desc" },
    take: 4,
    select: { id: true, title: true, publishedAt: true, audience: true, campusId: true },
  });

  return {
    stats: { students, activeEnrollments, applicationsOpen, tutors, cardsPending, billed, collected, outstanding: billed - collected },
    deadlines,
    events,
    exams,
    recentStudents,
    announcements,
  };
}

/* ------------------------------------------------------------------ students */

export async function getStudents(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  return studentsFor(scope.campusId, query);
}

async function studentsFor(campusId: number | null, query: ListQuery) {
  const page = clampPage(query.page);
  const where = { AND: [campusWhere(campusId), studentSearch(query.q)] };

  const [rows, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where,
      orderBy: { admissionNo: "asc" },
      skip: (page - 1) * pagination.window,
      take: pagination.window,
      include: studentInclude(),
    }),
    prisma.studentProfile.count({ where }),
  ]);

  const balances = await feeBalances(rows.map((row) => row.id));

  return {
    page,
    total,
    rows: rows.map((row) => ({ ...row, balance: balances.get(row.id) ?? 0 })),
  };
}

function studentInclude() {
  return {
    user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
    campus: { select: { id: true, name: true } },
    enrollments: {
      where: { status: "ACTIVE" },
      take: 1,
      select: { program: { select: { name: true, code: true } } },
    },
    idCards: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, serial: true } },
  } as const;
}

/** Billed minus paid, per student. */
async function feeBalances(studentIds: string[]) {
  const invoices = await prisma.invoice.findMany({
    where: { studentId: { in: studentIds }, status: { not: "VOID" } },
    select: {
      studentId: true,
      lines: { select: { amount: true } },
      payments: { select: { amount: true } },
    },
  });

  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    const billed = invoice.lines.reduce((sum, line) => sum + money(line.amount), 0);
    const paid = invoice.payments.reduce((sum, payment) => sum + money(payment.amount), 0);
    totals.set(invoice.studentId, (totals.get(invoice.studentId) ?? 0) + billed - paid);
  }
  return totals;
}

export async function getStudent(id: string) {
  const scope = await requireCollegeAdmin();
  const row = await prisma.studentProfile.findFirst({
    where: { id, ...campusWhere(scope.campusId) },
    include: {
      ...studentInclude(),
      enrollments: {
        orderBy: { enrolledAt: "desc" },
        include: { program: { select: { name: true, code: true } }, intake: { select: { name: true } } },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: { lines: true, payments: { orderBy: { paidAt: "desc" } } },
      },
      idCards: { orderBy: { createdAt: "desc" }, include: { program: { select: { name: true } } } },
    },
  });

  if (!row) throw new Error("not_found");
  return row;
}

/* -------------------------------------------------------------- applications */

export async function getApplications(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const page = clampPage(query.page);
  const status = pick(APPLICABLE, query.status);

  const where = {
    AND: [
      campusWhere(scope.campusId),
      status ? { status } : {},
      searchWhere(query.q, ["reference", "fullName", "email", "phone"]),
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.application.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * pagination.window,
      take: pagination.window,
      include: { program: { select: { name: true, code: true } } },
    }),
    prisma.application.count({ where }),
  ]);

  return { page, total, rows };
}

const APPLICABLE = {
  SUBMITTED: "",
  REVIEWING: "",
  REJECTED: "",
  WITHDRAWN: "",
};

export async function getApplication(id: string) {
  const scope = await requireCollegeAdmin();
  const row = await prisma.application.findFirst({
    where: { id, ...campusWhere(scope.campusId) },
    include: {
      program: { select: { name: true, code: true, id: true } },
      campus: { select: { name: true } },
      decidedBy: { select: { fullName: true } },
    },
  });
  if (!row) throw new Error("not_found");
  return assertCampus(row, scope.campusId);
}

/* ---------------------------------------------------------------- reporting */

/** Admission runs monthly, so a reporting year always reads as its twelve months. */
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export async function getReportingDates(yearParam?: string, campusParam?: string) {
  const scope = await requireCollegeAdmin();
  const context = await campusContext(scope, campusParam);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const requested = Number(yearParam);
  const year = Number.isInteger(requested) ? clampYear(requested, currentYear) : currentYear;
  const firstYear = currentYear - HISTORY_YEARS;
  const lastYear = currentYear + OPEN_YEARS;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);

  const rows = await prisma.reportingDate.findMany({
    where: { campusId: context.campusId, year },
  });

  const months = MONTHS.map((month) => {
    const row = rows.find((entry) => entry.month === month) ?? null;
    const reported = row !== null && row.date < startOfToday;

    return {
      month,
      row,
      reported,
      // A month closes for changes once its own reporting day has gone by.
      editable:
        !reported &&
        (year > currentYear || (year === currentYear && month >= currentMonth)),
    };
  });

  return {
    ...context,
    year,
    years,
    editable: year >= currentYear,
    canPrevious: year > firstYear,
    canNext: year < lastYear,
    months,
  };
}

/* --------------------------------------------------------------- enrollments */

export async function getEnrollments(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const page = clampPage(query.page);
  const status = pick(ENROLLABLE, query.status);
  const semester = trimmed(query.q);
  const where = {
    AND: [
      campusWhere(scope.campusId),
      status ? { status } : {},
      semester ? { OR: [{ cohort: contains(semester) }, { student: { admissionNo: contains(semester) } }] } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      orderBy: { enrolledAt: "desc" },
      skip: (page - 1) * pagination.window,
      take: pagination.window,
      include: {
        student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
        program: { select: { name: true, code: true } },
        intake: { select: { name: true, semester: { select: { name: true } } } },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { page, total, rows };
}

const ENROLLABLE = { ACTIVE: "", SUSPENDED: "", COMPLETED: "", WITHDRAWN: "" };

/* ------------------------------------------------------------------ programs */

export async function getPrograms(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const rows = await programsFor(scope.campusId, query.q);
  return rows;
}

async function programsFor(campusId: number | null, q?: string) {
  const where = {
    AND: [campusId === null ? {} : { campuses: { some: { id: campusId } } }, searchWhere(q, ["name", "code"])],
  };

  const programs = await prisma.program.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      campuses: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });

  return programs.map((program) => ({
    ...program,
    enrolledCount: program.enrollments.length,
  }));
}

/** Departments are college-wide, like semesters: one list every campus shares. */
export async function getDepartments() {
  await requireCollegeAdmin();
  return prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { programs: { select: { id: true } } },
  });
}

export async function getDepartmentOptions() {
  await requireCollegeAdmin();
  const rows = await prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return rows.map((row) => ({ value: row.id, label: row.name }));
}

/* -------------------------------------------------------------------- tutors */

export async function getTutors(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const where = { AND: [campusWhere(scope.campusId), tutorSearch(query.q)] };

  const rows = await prisma.tutorProfile.findMany({
    where,
    orderBy: { staffNo: "asc" },
    include: {
      user: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
      programs: { select: { name: true, code: true } },
      timetableSlots: { select: { startAt: true, endAt: true } },
    },
  });

  return rows.map((tutor) => ({
    ...tutor,
    weeklyHours: Number(
      tutor.timetableSlots
        .reduce((sum, slot) => sum + minutesBetween(slot.startAt, slot.endAt), 0)
        .toFixed(1),
    ),
  }));
}

function minutesBetween(start: string, end: string) {
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

/* ----------------------------------------------------------------- timetable */

export const timetableDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

export async function getTimetable() {
  const scope = await requireCollegeAdmin();
  const slots = await prisma.timetableSlot.findMany({
    where: campusWhere(scope.campusId),
    orderBy: [{ day: "asc" }, { startAt: "asc" }],
    include: {
      program: { select: { name: true, code: true } },
      tutor: { select: { user: { select: { fullName: true } } } },
    },
  });

  const byDay = new Map<string, typeof slots>();
  for (const day of timetableDays) byDay.set(day, []);
  for (const slot of slots) byDay.get(slot.day)?.push(slot);

  return { slots, byDay };
}

/* ------------------------------------------------------------------ calendar */

/** The three semester slots every campus is expected to run inside one calendar year. */
const SEMESTER_SLOTS = [1, 2, 3] as const;

/** How far back a closed year can still be read, and how far ahead one may be planned. */
const HISTORY_YEARS = 5;
const OPEN_YEARS = 1;

const clampYear = (value: number, current: number) =>
  Math.min(current + OPEN_YEARS, Math.max(current - HISTORY_YEARS, value));

/**
 * A semester belongs to exactly one campus, so a calendar read always resolves to a single
 * campus: a campus admin is pinned to their own, and a super admin chooses one, because
 * "all campuses" has no meaning for a window only one campus runs.
 */
async function campusContext(scope: AdminScope, requested?: string) {
  if (scope.campusId !== null) {
    return { campusId: scope.campusId, campusName: scope.campusName, campuses: [] };
  }

  const rows = await prisma.campus.findMany({
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (rows.length === 0) throw new Error("not_found");

  const wanted = rows.find((row) => row.id === Number(requested)) ?? rows[0];
  return {
    campusId: wanted.id,
    campusName: wanted.name,
    campuses: rows.map((row) => ({ value: String(row.id), label: row.name })),
  };
}

export async function getCalendar(yearParam?: string, campusParam?: string) {
  const scope = await requireCollegeAdmin();
  const context = await campusContext(scope, campusParam);

  const currentYear = new Date().getFullYear();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const requested = Number(yearParam);
  const year = Number.isInteger(requested) ? clampYear(requested, currentYear) : currentYear;
  const firstYear = currentYear - HISTORY_YEARS;
  const lastYear = currentYear + OPEN_YEARS;
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => firstYear + index);
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const [semesters, collegeEvents, cards] = await Promise.all([
    prisma.semester.findMany({
      where: { campusId: context.campusId, year },
      orderBy: { semesterNo: "asc" },
      include: {
        intakes: { orderBy: { applicationDeadline: "asc" } },
        exams: {
          orderBy: { date: "asc" },
          select: {
            id: true,
            title: true,
            date: true,
            startAt: true,
            room: true,
            status: true,
            type: true,
          },
        },
        calendarEvents: {
          where: { campusId: context.campusId },
          orderBy: { startsAt: "asc" },
        },
      },
    }),
    prisma.calendarEvent.findMany({
      where: { campusId: null, semesterId: null, startsAt: { gte: yearStart, lte: yearEnd } },
      orderBy: { startsAt: "asc" },
    }),
    prisma.idCard.findMany({
      where: { campusId: context.campusId, issuedAt: { not: null } },
      orderBy: { issuedAt: "asc" },
      select: {
        id: true,
        serial: true,
        issuedAt: true,
        status: true,
        student: { select: { admissionNo: true, user: { select: { fullName: true } } } },
      },
    }),
  ]);

  // A card belongs to the semester whose window covers the day it was issued.
  const cardsIn = (from: Date, to: Date) =>
    cards.filter((card) => card.issuedAt! >= from && card.issuedAt! <= to);

  const slots = SEMESTER_SLOTS.map((semesterNo) => {
    const semester = semesters.find((row) => row.semesterNo === semesterNo) ?? null;
    return {
      semesterNo,
      semester,
      // A semester stops taking changes the day its window closes.
      editable: year >= currentYear && (!semester || semester.endDate >= startOfToday),
      cards: semester ? cardsIn(semester.startDate, semester.endDate) : [],
    };
  });

  return {
    ...context,
    year,
    years,
    // A year stops accepting changes the moment it is history, but stays readable.
    editable: year >= currentYear,
    openYears: Array.from({ length: OPEN_YEARS + 1 }, (_, index) => currentYear + index),
    canPrevious: year > firstYear,
    canNext: year < lastYear,
    slots,
    collegeEvents,
  };
}

/* --------------------------------------------------------------------- exams */

export async function getExams(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const where = {
    AND: [campusWhere(scope.campusId), searchWhere(query.q, ["title", "room"])],
  };

  return prisma.exam.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      program: { select: { name: true, code: true } },
      invigilator: { select: { user: { select: { fullName: true } } } },
      _count: { select: { grades: true } },
    },
  });
}

export async function getExam(id: string) {
  const scope = await requireCollegeAdmin();
  const exam = await prisma.exam.findFirst({
    where: { id, ...campusWhere(scope.campusId) },
    include: {
      program: { select: { id: true, name: true, code: true } },
      invigilator: { select: { user: { select: { fullName: true } } } },
      grades: {
        include: {
          enrollment: {
            select: { student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } } },
          },
        },
      },
    },
  });
  if (!exam) throw new Error("not_found");

  // Everyone active on the paper's programme is a row to mark.
  const enrollments = await prisma.enrollment.findMany({
    where: { programId: exam.programId, status: "ACTIVE", ...campusWhere(scope.campusId) },
    include: { student: { select: { admissionNo: true, user: { select: { fullName: true } } } } },
    orderBy: { enrolledAt: "asc" },
  });

  const marked = new Map(exam.grades.map((grade) => [grade.enrollmentId, grade]));
  return {
    exam,
    rows: enrollments.map((enrollment) => ({ enrollment, grade: marked.get(enrollment.id) ?? null })),
    unassigned: exam.grades.filter((grade) => !enrollments.some((e) => e.id === grade.enrollmentId)),
  };
}

/* ------------------------------------------------------------------ accounts */

export async function getAccounts(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const page = clampPage(query.page);
  const status = pick(INVOICEABLE, query.status);
  const semester = trimmed(query.q);

  const where: Prisma.InvoiceWhereInput = {
    AND: [
      campusWhere(scope.campusId),
      status ? { status } : { status: { not: "VOID" } },
      semester ? { OR: [{ number: contains(semester) }, throughStudent(semester ? query.q : undefined)] } : {},
    ],
  };

  const [rows, total, summaryLines, summaryPayments] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pagination.window,
      take: pagination.window,
      include: {
        student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
        semester: { select: { name: true } },
        lines: true,
        payments: { orderBy: { paidAt: "desc" } },
      },
    }),
    prisma.invoice.count({ where }),
    prisma.invoiceLine.aggregate({ _sum: { amount: true }, where: { invoice: campusWhere(scope.campusId) } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: campusWhere(scope.campusId) } }),
  ]);

  const decorated = rows.map((invoice) => {
    const billed = invoice.lines.reduce((sum, line) => sum + money(line.amount), 0);
    const paid = invoice.payments.reduce((sum, payment) => sum + money(payment.amount), 0);
    return { ...invoice, billed, paid, balance: billed - paid };
  });

  return {
    page,
    total,
    rows: decorated,
    summary: {
      billed: money(summaryLines._sum.amount),
      collected: money(summaryPayments._sum.amount),
      outstanding: money(summaryLines._sum.amount) - money(summaryPayments._sum.amount),
      paidCount: decorated.filter((invoice) => invoice.status === "PAID").length,
    },
  };
}

const INVOICEABLE = { OPEN: "", PARTIAL: "", PAID: "", VOID: "" };

/* --------------------------------------------------------------------- cards */

export async function getCards(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  const page = clampPage(query.page);
  const status = pick(CARDABLE, query.status);
  const semester = trimmed(query.q);
  const where = {
    AND: [
      campusWhere(scope.campusId),
      status ? { status } : {},
      semester ? { OR: [{ serial: contains(semester) }, { student: { admissionNo: contains(semester) } }] } : {},
    ],
  };

  const [rows, total] = await Promise.all([
    prisma.idCard.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pagination.window,
      take: pagination.window,
      include: {
        student: {
          select: {
            admissionNo: true,
            user: { select: { fullName: true } },
            enrollments: { where: { status: "ACTIVE" }, take: 1, select: { program: { select: { name: true } } } },
          },
        },
        program: { select: { name: true } },
      },
    }),
    prisma.idCard.count({ where }),
  ]);

  return { page, total, rows };
}

const CARDABLE = { PENDING: "", PRINTING: "", ISSUED: "", LOST: "", REPLACED: "" };

/* ------------------------------------------------------------------- reports */

export async function getReports() {
  const scope = await requireCollegeAdmin();
  const where = campusWhere(scope.campusId);

  const [applicationGroups, programGroups, lineTotals, paymentTotals, debts, exams, cardGroups] =
    await Promise.all([
      prisma.application.groupBy({ by: ["status"], _count: { _all: true }, where }),
      prisma.enrollment.groupBy({ by: ["programId"], _count: { _all: true }, where: { ...where, status: "ACTIVE" } }),
      prisma.invoiceLine.aggregate({ _sum: { amount: true }, where: { invoice: where } }),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: where } }),
      prisma.invoice.findMany({
        where: { ...where, status: { not: "PAID" } },
        include: {
          student: { select: { id: true, admissionNo: true, user: { select: { fullName: true } } } },
          lines: { select: { amount: true } },
          payments: { select: { amount: true } },
        },
      }),
      prisma.exam.findMany({
        where,
        include: { program: { select: { name: true } }, grades: true },
        orderBy: { date: "desc" },
      }),
      prisma.idCard.groupBy({ by: ["status"], _count: { _all: true }, where }),
    ]);

  const programs = await prisma.program.findMany({ select: { id: true, name: true, code: true, level: true } });
  const tutors = await prisma.tutorProfile.findMany({
    where,
    include: { user: { select: { fullName: true } }, timetableSlots: { select: { startAt: true, endAt: true } } },
  });

  const billed = money(lineTotals._sum.amount);
  const collected = money(paymentTotals._sum.amount);

  return {
    scope,
    applications: applicationGroups.map((group) => ({ status: group.status, count: group._count._all })),
    enrollments: programGroups
      .map((group) => {
        const program = programs.find((candidate) => candidate.id === group.programId);
        return { name: program?.name ?? "Unknown programme", level: program?.level ?? null, count: group._count._all };
      })
      .sort((a, b) => b.count - a.count),
    fees: { billed, collected, outstanding: billed - collected },
    debts: debtRows(debts).filter((row) => row.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 8),
    results: exams.map((exam) => {
      const scored = exam.grades.filter((grade) => grade.score !== null);
      const totalScore = scored.reduce(
        (sum, grade) => sum + (money(grade.score) / (money(grade.maxScore) || 100)) * 100,
        0,
      );
      return {
        title: exam.title,
        program: exam.program.name,
        entered: scored.length,
        enrolled: exam.grades.length,
        average: scored.length ? Math.round(totalScore / scored.length) : null,
        published: exam.grades.filter((grade) => grade.published).length,
      };
    }),
    tutors: tutors
      .map((tutor) => ({
        name: tutor.user.fullName,
        slots: tutor.timetableSlots.length,
        hours: Number(
          tutor.timetableSlots
            .reduce((sum, slot) => sum + minutesBetween(slot.startAt, slot.endAt), 0)
            .toFixed(1),
        ),
      }))
      .sort((a, b) => b.hours - a.hours),
    cards: cardGroups.map((group) => ({ status: group.status, count: group._count._all })),
  };
}

/* ------------------------------------------------------------- communication */

export async function getAnnouncements() {
  const scope = await requireCollegeAdmin();
  return prisma.announcement.findMany({
    where: { OR: [{ campusId: null }, campusWhere(scope.campusId)] },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    include: {
      campus: { select: { name: true } },
      author: { select: { fullName: true } },
    },
  });
}

/* -------------------------------------------------------------- option lists */

type AmountRow = { amount: unknown };

function sumAmounts(rows: AmountRow[]) {
  return rows.reduce((total, row) => total + money(row.amount), 0);
}

type DebtInvoice = {
  student: { id: string; admissionNo: string; user: { fullName: string } };
  lines: AmountRow[];
  payments: AmountRow[];
};

/** One row per student, merging all their unpaid invoices. */
function debtRows(invoices: DebtInvoice[]) {
  const map = new Map<string, { student: string; admissionNo: string; balance: number; invoices: number }>();

  for (const invoice of invoices) {
    const balance = sumAmounts(invoice.lines) - sumAmounts(invoice.payments);
    const existing = map.get(invoice.student.id);
    map.set(
      invoice.student.id,
      existing
        ? { ...existing, balance: existing.balance + balance, invoices: existing.invoices + 1 }
        : {
            student: invoice.student.user.fullName,
            admissionNo: invoice.student.admissionNo,
            balance,
            invoices: 1,
          },
    );
  }

  return Array.from(map.values());
}

export async function getProgramOptions(campusId: number | null) {
  const rows = await prisma.program.findMany({
    where: campusId === null ? {} : { campuses: { some: { id: campusId } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.name} (${row.code})` }));
}

export async function getStudentOptions(campusId: number | null) {
  const rows = await prisma.studentProfile.findMany({
    where: campusWhere(campusId),
    orderBy: { admissionNo: "asc" },
    select: { id: true, admissionNo: true, user: { select: { fullName: true } } },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.admissionNo} · ${row.user.fullName}` }));
}

export async function getTutorOptions(campusId: number | null) {
  const rows = await prisma.tutorProfile.findMany({
    where: campusWhere(campusId),
    orderBy: { staffNo: "asc" },
    select: { id: true, staffNo: true, user: { select: { fullName: true } } },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.user.fullName} (${row.staffNo})` }));
}

/**
 * A semester is one campus's, so this select never offers another campus's window. A super
 * admin is not pinned to a campus and sees every semester, labelled with the campus it runs on.
 */
export async function getSemesterOptions() {
  const scope = await requireCollegeAdmin();
  const rows = await prisma.semester.findMany({
    where: campusWhere(scope.campusId),
    orderBy: [{ year: "desc" }, { semesterNo: "desc" }],
    select: { id: true, name: true, campus: { select: { name: true } } },
  });

  return rows.map((row) => ({
    value: row.id,
    label: scope.campusId === null ? `${row.name} · ${row.campus.name}` : row.name,
  }));
}

export async function getIntakeOptions() {
  const scope = await requireCollegeAdmin();
  const rows = await prisma.intake.findMany({
    where: { semester: { status: { in: ["ACTIVE", "PLANNED"] }, ...campusWhere(scope.campusId) } },
    orderBy: { applicationDeadline: "desc" },
    include: { semester: { select: { name: true } } },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.name} · ${row.semester.name}` }));
}

export async function getInvoiceOptions(campusId: number | null) {
  const rows = await prisma.invoice.findMany({
    where: { ...campusWhere(campusId), status: { in: ["OPEN", "PARTIAL"] } },
    orderBy: { createdAt: "desc" },
    include: { student: { select: { admissionNo: true, user: { select: { fullName: true } } } } },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.number} · ${row.student.user.fullName}` }));
}

export async function getEnrollmentOptions(programId: string, campusId: number | null) {
  const rows = await prisma.enrollment.findMany({
    where: { programId, status: "ACTIVE", ...campusWhere(campusId) },
    include: { student: { select: { admissionNo: true, user: { select: { fullName: true } } } } },
    orderBy: { enrolledAt: "asc" },
  });
  return rows.map((row) => ({ value: row.id, label: `${row.student.admissionNo} · ${row.student.user.fullName}` }));
}
