/**
 * Every read for the college-admin portal. Each exported getter resolves the session
 * first and then calls an unexported function that takes the campus id, so a caller can
 * never ask for another campus's rows by passing a different id.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { campusWhere, requireCollegeAdmin, type AdminScope } from "@/lib/session";
import { pagination } from "@/lib/content/dashboard";
import { generatedPeriods, type Structure } from "@/lib/academics/structure";
import { planningSemesters } from "@/lib/academics/planning";
import { syncProgression } from "@/lib/academics/progression-sync";

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

/* ------------------------------------------------------- college-wide (super admin) */

/** The month labels the super-admin trend is drawn over, oldest first. */
function monthBuckets(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return { label: start.toLocaleDateString("en-KE", { month: "short" }), start };
  });
}

/**
 * The college seen at once: every campus measured the same way, the same figures added up,
 * and where the applicants and enrolments actually sit. Nothing here takes a campus filter
 * — this screen is college-wide by definition, and only a super admin is shown it.
 */
export async function getCollegeOverview() {
  const scope = await requireCollegeAdmin();
  const buckets = monthBuckets();

  const campuses = await prisma.campus.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, place: true },
  });

  const [studentCounts, applicationCounts, enrollmentCounts, tutorCounts, feeRows, arrivals, programmeCounts, recentApplications] =
    await Promise.all([
      prisma.studentProfile.groupBy({ by: ["campusId"], _count: { _all: true } }),
      prisma.application.groupBy({
        by: ["campusId"],
        where: { status: { in: ["SUBMITTED", "REVIEWING"] } },
        _count: { _all: true },
      }),
      prisma.enrollment.groupBy({ by: ["campusId"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      prisma.tutorProfile.groupBy({ by: ["campusId"], _count: { _all: true } }),
      Promise.all(
        campuses.map(async (campus) => {
          const [lines, paid] = await Promise.all([
            prisma.invoiceLine.aggregate({ _sum: { amount: true }, where: { invoice: { campusId: campus.id } } }),
            prisma.payment.aggregate({ _sum: { amount: true }, where: { invoice: { campusId: campus.id } } }),
          ]);
          return { billed: money(lines._sum.amount), collected: money(paid._sum.amount) };
        }),
      ),
      prisma.application.findMany({
        where: { createdAt: { gte: buckets[0].start } },
        select: { createdAt: true },
      }),
      prisma.enrollment.groupBy({
        by: ["programId"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
        orderBy: { _count: { programId: "desc" } },
        take: 6,
      }),
      prisma.application.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          reference: true,
          fullName: true,
          status: true,
          createdAt: true,
          program: { select: { name: true, code: true } },
          campus: { select: { name: true } },
        },
      }),
    ]);

  const of = (rows: { campusId: number; _count: { _all: number } }[], campusId: number) =>
    rows.find((row) => row.campusId === campusId)?._count._all ?? 0;

  const byCampus = campuses.map((campus, index) => {
    const fees = feeRows[index];
    return {
      id: campus.id,
      name: campus.name,
      place: campus.place,
      students: of(studentCounts, campus.id),
      applicationsOpen: of(applicationCounts, campus.id),
      activeEnrollments: of(enrollmentCounts, campus.id),
      tutors: of(tutorCounts, campus.id),
      billed: fees.billed,
      collected: fees.collected,
      outstanding: fees.billed - fees.collected,
    };
  });

  const totals = byCampus.reduce(
    (sum, campus) => ({
      students: sum.students + campus.students,
      applicationsOpen: sum.applicationsOpen + campus.applicationsOpen,
      activeEnrollments: sum.activeEnrollments + campus.activeEnrollments,
      tutors: sum.tutors + campus.tutors,
      billed: sum.billed + campus.billed,
      collected: sum.collected + campus.collected,
    }),
    { students: 0, applicationsOpen: 0, activeEnrollments: 0, tutors: 0, billed: 0, collected: 0 },
  );

  const nextStart = (index: number) => buckets[index + 1]?.start ?? new Date(8_640_000_000_000_000);
  const applicationsByMonth = buckets.map((bucket, index) => ({
    label: bucket.label,
    value: arrivals.filter((row) => row.createdAt >= bucket.start && row.createdAt < nextStart(index)).length,
  }));

  const programmes = await prisma.program.findMany({
    where: { id: { in: programmeCounts.map((row) => row.programId) } },
    select: { id: true, name: true, code: true },
  });

  const enrollmentsByProgramme = programmeCounts.flatMap((row) => {
    const programme = programmes.find((item) => item.id === row.programId);
    if (!programme) return [];
    return [{ label: `${programme.name} (${programme.code})`, value: row._count._all }];
  });

  return { scope, byCampus, totals, applicationsByMonth, enrollmentsByProgramme, recentApplications };
}

/* ------------------------------------------------------------------ students */

export async function getStudents(query: ListQuery) {
  const scope = await requireCollegeAdmin();
  return studentsFor(scope.campusId, query);
}

async function studentsFor(campusId: number | null, query: ListQuery) {
  const page = clampPage(query.page);

  // Only students who are actually enrolled on a programme are listed. A profile that has
  // no enrolment is an unfinished admission, not a student of the college, and showing it
  // here makes the register say something that is not true.
  const where: Prisma.StudentProfileWhereInput = {
    AND: [
      campusWhere(campusId),
      { enrollments: { some: { status: "ACTIVE" } } },
      studentSearch(query.q),
    ],
  };

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
        include: {
          program: {
            select: { name: true, code: true, structure: true, durationMonths: true },
          },
          intake: { select: { name: true } },
          // The whole unit plan with the student's standing, and any attachment stages.
          units: {
            orderBy: [
              { programUnit: { yearIndex: "asc" } },
              { programUnit: { semesterNo: "asc" } },
              { programUnit: { monthIndex: "asc" } },
              { programUnit: { sequence: "asc" } },
            ],
            include: {
              programUnit: {
                select: {
                  id: true,
                  periodKey: true,
                  periodLabel: true,
                  yearIndex: true,
                  semesterNo: true,
                  monthIndex: true,
                  unit: { select: { code: true, name: true } },
                  module: { select: { name: true } },
                },
              },
            },
          },
          attachments: {
            orderBy: { requirement: { sequence: "asc" } },
            include: {
              requirement: {
                select: {
                  label: true,
                  afterAllPeriods: true,
                  afterYearIndex: true,
                  afterSemesterNo: true,
                  afterMonthIndex: true,
                },
              },
            },
          },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        include: {
          lines: true,
          payments: { orderBy: { paidAt: "desc" } },
          // A generated bill carries the period it came from and, where the plan was tied
          // to the calendar, the actual semester it falls in.
          // The plan row a bill came from, including where it sits in the programme, so a
          // record can leave out periods the student has not reached.
          feePeriod: { select: { sequence: true, label: true, yearIndex: true, semesterNo: true } },
          feePlan: { select: { version: true } },
          semester: { select: { name: true, startDate: true, endDate: true } },
        },
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
      program: {
        select: {
          name: true,
          code: true,
          id: true,
          body: { select: { name: true } },
          type: { select: { name: true } },
        },
      },
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

  // A student's period follows their intake, so time alone can move it. Reconciling before
  // the read means the list never shows a stale semester; it writes nothing when nothing
  // has changed.
  await syncProgression(scope.campusId);

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
        intake: { select: { id: true, name: true, startsAt: true } },
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
      body: { select: { id: true, name: true, code: true } },
      type: { select: { id: true, name: true, code: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { id: true } },
      // The fee column reads the published version, not a draft the administrator abandoned.
      feePlans: {
        where: { isActive: true },
        select: { id: true, version: true, totalAmount: true },
        take: 1,
      },
      _count: { select: { units: true } },
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

/**
 * The three lists a programme is picked from. College-wide like departments: the same
 * bodies, types and payment types across every campus, so codes stay comparable.
 */
export async function getProgramBodies() {
  await requireCollegeAdmin();
  return prisma.programBody.findMany({
    orderBy: { name: "asc" },
    include: { programs: { select: { id: true } } },
  });
}

export async function getProgramTypes() {
  await requireCollegeAdmin();
  return prisma.programType.findMany({
    orderBy: { name: "asc" },
    include: { programs: { select: { id: true } } },
  });
}

export async function getFeeCadences() {
  await requireCollegeAdmin();
  return prisma.feeCadence.findMany({
    orderBy: { name: "asc" },
    include: { programs: { select: { id: true } } },
  });
}

export async function getProgramRegistryOptions() {
  await requireCollegeAdmin();
  const [bodies, types, cadences, departments] = await Promise.all([
    prisma.programBody.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.programType.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.feeCadence.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    bodies: bodies.map((row) => ({ value: row.id, label: row.name })),
    programTypes: types.map((row) => ({ value: row.id, label: row.name })),
    feeCadences: cadences.map((row) => ({ value: row.id, label: row.name })),
    departments: departments.map((row) => ({ value: row.id, label: row.name })),
  };
}

/**
 * Everything the fee editor needs: the programme, the version currently live, the payment
 * methods, and the campus calendar the semester periods will be dated against.
 */
export async function getProgramFees(programId: string) {
  const scope = await requireCollegeAdmin();

  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
    },
    include: {
      campuses: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      feePlans: {
        where: { isActive: true },
        include: {
          cadence: { select: { id: true, name: true, kind: true } },
          periods: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  if (!program) throw new Error("not_found");

  // The preview calendar belongs to the campus being worked in; a college-wide admin sees
  // the first campus that offers the programme.
  const campusId = scope.campusId ?? program.campuses[0]?.id ?? null;

  const [calendar, cadences] = await Promise.all([
    campusId === null
      ? Promise.resolve([])
      : prisma.semester.findMany({
          where: { campusId },
          orderBy: { startDate: "asc" },
          select: { id: true, year: true, semesterNo: true, name: true, startDate: true, endDate: true, status: true },
        }),
    prisma.feeCadence.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true },
    }),
  ]);

  return {
    scope,
    program,
    campusId,
    plan: program.feePlans[0] ?? null,
    calendar,
    cadences,
  };
}

/* -------------------------------------------------------------------- units */

/** Every unit definition, shared by all programmes that teach it. */
export async function getUnitCatalogue() {
  await requireCollegeAdmin();
  return prisma.unit.findMany({
    orderBy: { code: "asc" },
    include: { _count: { select: { programUnits: true } } },
  });
}

export async function getUnitOptions() {
  await requireCollegeAdmin();
  const rows = await prisma.unit.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  return rows.map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` }));
}

/** A programme the caller can see, with its periods worked out from its own structure. */
async function programForPlanning(programId: string) {
  const scope = await requireCollegeAdmin();

  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
    },
    select: {
      id: true,
      code: true,
      name: true,
      structure: true,
      durationMonths: true,
      archivedAt: true,
      campuses: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
  if (!program) throw new Error("not_found");

  const campusId = scope.campusId ?? program.campuses[0]?.id ?? null;
  const perYear = await planningSemesters(campusId);
  const periods = generatedPeriods(program.structure as Structure, program.durationMonths, perYear);

  return { scope, program, campusId, perYear, periods };
}

export async function getProgramUnitsPlan(programId: string) {
  const { scope, program, periods, perYear } = await programForPlanning(programId);

  const [placed, modules, units] = await Promise.all([
    prisma.programUnit.findMany({
      where: { programId: program.id },
      orderBy: [{ yearIndex: "asc" }, { semesterNo: "asc" }, { monthIndex: "asc" }, { sequence: "asc" }],
      include: {
        unit: { select: { id: true, code: true, name: true } },
        module: { select: { id: true, name: true } },
        _count: { select: { studentUnits: true } },
      },
    }),
    prisma.programModule.findMany({
      where: { programId: program.id },
      orderBy: [{ sequence: "asc" }, { code: "asc" }],
      include: { _count: { select: { units: true } } },
    }),
    prisma.unit.findMany({
      orderBy: { code: "asc" },
      include: { _count: { select: { programUnits: true } } },
    }),
  ]);

  return { scope, program, periods, perYear, placed, modules, units };
}

export async function getProgramAttachmentPlan(programId: string) {
  const { scope, program, periods } = await programForPlanning(programId);

  const [requirements, enrolled] = await Promise.all([
    prisma.attachmentRequirement.findMany({
      where: { programId: program.id },
      orderBy: { sequence: "asc" },
      include: { _count: { select: { studentAttachments: true } } },
    }),
    prisma.enrollment.count({ where: { programId: program.id, status: "ACTIVE" } }),
  ]);

  return { scope, program, periods, requirements, enrolled };
}

/** The programme overview: what it contains, who is on it, and the lifecycle actions. */
export async function getProgramDetail(programId: string) {
  const scope = await requireCollegeAdmin();

  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
    },
    include: {
      department: { select: { name: true } },
      body: { select: { name: true, code: true } },
      type: { select: { name: true, code: true } },
      cadence: { select: { name: true } },
      campuses: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      feePlans: { where: { isActive: true }, select: { version: true, totalAmount: true }, take: 1 },
      modules: { orderBy: { sequence: "asc" }, select: { id: true, code: true, name: true, _count: { select: { units: true } } } },
      attachmentRequirements: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          label: true,
          afterAllPeriods: true,
          afterYearIndex: true,
          afterSemesterNo: true,
          afterMonthIndex: true,
          durationWeeks: true,
          durationMonths: true,
          _count: { select: { studentAttachments: true } },
        },
      },
      _count: {
        select: { units: true, modules: true, attachmentRequirements: true, applications: true },
      },
    },
  });
  if (!program) throw new Error("not_found");

  const [activeEnrollments, completedEnrollments] = await Promise.all([
    prisma.enrollment.count({ where: { programId: program.id, status: "ACTIVE" } }),
    prisma.enrollment.count({ where: { programId: program.id, status: "COMPLETED" } }),
  ]);

  return { scope, program, activeEnrollments, completedEnrollments };
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

  const [semesters, collegeEvents, standaloneIntakes, cards] = await Promise.all([
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
    /*
     * Intakes are listed in their own right, not only through a semester. An intake is the thing
     * a student joins and the office now records it straight from this page, so one that belongs
     * to no semester — which is the normal case — would otherwise be saved and never seen again.
     */
    prisma.intake.findMany({
      where: { campusId: context.campusId, year },
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
    standaloneIntakes,
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

/**
 * The finance desk's view of the generated fee schedules: what they expect, what has been
 * collected, what is late, and the same figures split by programme and by academic period.
 * Only invoices produced by a fee plan are counted, so a one-off bill raised by hand does
 * not distort the revenue picture.
 */
export async function getFinanceOverview() {
  const scope = await requireCollegeAdmin();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [invoices, programs] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        AND: [
          campusWhere(scope.campusId),
          { enrollmentId: { not: null } },
          { status: { not: "VOID" } },
        ],
      },
      select: {
        programId: true,
        periodYear: true,
        periodSemester: true,
        dueAt: true,
        lines: { select: { amount: true } },
        payments: { select: { amount: true } },
      },
    }),
    prisma.program.findMany({ select: { id: true, name: true, code: true } }),
  ]);

  const programById = new Map(programs.map((program) => [program.id, program]));

  const rows = invoices.map((invoice) => {
    const expected = invoice.lines.reduce((sum, line) => sum + money(line.amount), 0);
    const collected = invoice.payments.reduce((sum, payment) => sum + money(payment.amount), 0);
    return {
      programId: invoice.programId,
      program: invoice.programId ? programById.get(invoice.programId) ?? null : null,
      year: invoice.periodYear,
      semester: invoice.periodSemester,
      dueAt: invoice.dueAt,
      expected,
      collected,
      balance: expected - collected,
    };
  });

  const total = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((sum, row) => sum + pick(row), 0);

  const overdue = rows.filter((row) => row.balance > 0.005 && row.dueAt !== null && row.dueAt < today);

  const byProgram = new Map<string, { name: string; expected: number; collected: number; outstanding: number }>();
  for (const row of rows) {
    const key = row.programId ?? "unknown";
    const entry = byProgram.get(key) ?? {
      name: row.program ? `${row.program.name} (${row.program.code})` : "Unassigned",
      expected: 0,
      collected: 0,
      outstanding: 0,
    };
    entry.expected += row.expected;
    entry.collected += row.collected;
    entry.outstanding += Math.max(0, row.balance);
    byProgram.set(key, entry);
  }

  const byPeriod = new Map<string, { name: string; expected: number; collected: number; outstanding: number }>();
  for (const row of rows) {
    const name =
      row.year === null
        ? "Period not linked to a calendar year"
        : row.semester === null
          ? `Year ${row.year}`
          : `Year ${row.year} · Semester ${row.semester}`;
    const entry = byPeriod.get(name) ?? { name, expected: 0, collected: 0, outstanding: 0 };
    entry.expected += row.expected;
    entry.collected += row.collected;
    entry.outstanding += Math.max(0, row.balance);
    byPeriod.set(name, entry);
  }

  return {
    totals: {
      expected: total((row) => row.expected),
      collected: total((row) => row.collected),
      outstanding: total((row) => Math.max(0, row.balance)),
      overdue: overdue.reduce((sum, row) => sum + row.balance, 0),
      overdueCount: overdue.length,
    },
    byProgram: [...byProgram.values()].sort((a, b) => b.expected - a.expected),
    byPeriod: [...byPeriod.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

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

  const programs = await prisma.program.findMany({
    select: { id: true, name: true, code: true, type: { select: { name: true } } },
  });
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
        return {
          name: program?.name ?? "Unknown programme",
          type: program?.type.name ?? null,
          count: group._count._all,
        };
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
    // An archived programme keeps its history but no longer takes new students, so it is
    // absent from every picker that would admit or enrol someone.
    where: { archivedAt: null, ...(campusId === null ? {} : { campuses: { some: { id: campusId } } }) },
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

  /*
   * Every intake on the campus, including ones whose application deadline has passed.
   *
   * The deadline governs new applications, not whether an existing cohort can still be joined.
   * Filtering on it hid every earlier intake from the admission form, which broke the two kinds of
   * student who legitimately join an intake that is already running or already over: a transfer
   * from another college who is placed into the cohort that matches what they have already
   * studied, and a returning student who left and is resuming with the group they began with.
   * For both, the correct intake is behind them, and refusing to list it leaves the clerk unable
   * to record the truth — the student then gets filed against the current intake and their
   * progression, fees and class all start in the wrong place.
   */
  const rows = await prisma.intake.findMany({
    where: campusWhere(scope.campusId),
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  return rows.map((row) => ({
    value: row.id,
    // Say the month and year, which is how staff refer to a cohort.
    label: `${row.name} · ${monthName(row.month)} ${row.year}`,
  }));
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? `Month ${month}`;
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
