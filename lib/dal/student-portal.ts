/**
 * Every read for the student portal.
 *
 * Each getter resolves the signed-in student's own record first and scopes every query to it,
 * so a student can only ever read their own enrolment, units, fees and cards. Nothing here
 * takes an id from the caller: the student is the scope.
 */

import { prisma } from "@/lib/prisma";
import { requireStudent } from "@/lib/session";

/** Money as a plain number, so totals add up without decimal drift in the view. */
const money = (value: { toString(): string } | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value.toString());

/**
 * The student's one enrolment, or null when they have been admitted but not yet placed on a
 * programme. Every other getter builds on this, because a student without an enrolment has no
 * semester, no units and no class — only their own details.
 */
export async function getStudentEnrolment() {
  const student = await requireStudent();

  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.studentId },
    orderBy: { enrolledAt: "desc" },
    include: {
      program: { select: { name: true, code: true, durationMonths: true } },
      period: { select: { name: true, year: true, month: true, startsAt: true } },
      campus: { select: { name: true } },
      memberships: {
        where: { leftAt: null },
        take: 1,
        include: {
          class: {
            select: {
              id: true,
              name: true,
              note: true,
              status: true,
              tutors: {
                select: { tutor: { select: { user: { select: { fullName: true } } } } },
              },
              _count: { select: { memberships: { where: { leftAt: null } } } },
            },
          },
        },
      },
    },
  });

  return { student, enrollment };
}

export async function getStudentOverview() {
  const { student, enrollment } = await getStudentEnrolment();
  if (!enrollment) return { student, enrollment: null, units: [], fees: null, place: null };

  const place = { yearIndex: enrollment.yearIndex, semesterNo: enrollment.semesterNo };

  const [units, invoices, paid] = await Promise.all([
    /*
     * Read from the programme's own units, not from the student's registrations.
     *
     * A StudentUnit row is created when the office registers the student for a unit, and it
     * carries their marks. Showing only those would mean a student sees an empty list for
     * units they are plainly taking this semester, simply because registration has not been
     * keyed in yet. The programme says what they study; the registration only says how far
     * along they are, so it is joined in when present rather than used as the filter.
     */
    prisma.programUnit.findMany({
      where: {
        programId: enrollment.programId,
        yearIndex: place.yearIndex,
        semesterNo: place.semesterNo,
      },
      orderBy: { sequence: "asc" },
      include: {
        unit: { select: { code: true, name: true } },
        studentUnits: {
          where: { enrollmentId: enrollment.id },
          select: { status: true, grade: true },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { studentId: student.studentId, status: { not: "VOID" } },
      select: { status: true, dueAt: true, lines: { select: { amount: true } } },
      orderBy: { dueAt: "asc" },
    }),
    prisma.payment.aggregate({
      where: { studentId: student.studentId },
      _sum: { amount: true },
    }),
  ]);

  const totalOf = (row: { lines: { amount: { toString(): string } }[] }) =>
    row.lines.reduce((sum, line) => sum + money(line.amount), 0);

  const billed = invoices.reduce((sum, row) => sum + totalOf(row), 0);
  const settled = money(paid._sum.amount);
  const open = invoices.filter((row) => row.status !== "PAID");
  const nextDue = open.find((row) => row.dueAt !== null) ?? null;

  const current = enrollment.memberships[0]?.class ?? null;

  return {
    student,
    enrollment,
    place,
    units: units.map((row) => ({
      id: row.id,
      code: row.unit.code,
      title: row.unit.name,
      status: row.studentUnits[0]?.status ?? "NOT_STARTED",
      grade: row.studentUnits[0]?.grade ?? null,
    })),
    fees: {
      billed,
      paid: settled,
      balance: Math.max(0, billed - settled),
      nextDueAt: nextDue?.dueAt ?? null,
      nextDueAmount: nextDue ? totalOf(nextDue) : null,
      hasInvoices: invoices.length > 0,
    },
    classroom: current
      ? {
          id: current.id,
          name: current.name,
          note: current.note,
          tutors: current.tutors.map((row) => row.tutor.user.fullName),
          classmates: current._count.memberships,
        }
      : null,
  };
}

/** Every unit of the student's programme, marked with where the student stands on it. */
export async function getStudentUnits() {
  const { enrollment } = await getStudentEnrolment();
  if (!enrollment) return { enrollment: null, place: null, years: [] };

  const place = { yearIndex: enrollment.yearIndex, semesterNo: enrollment.semesterNo };

  const units = await prisma.programUnit.findMany({
    where: { programId: enrollment.programId },
    orderBy: [{ yearIndex: "asc" }, { semesterNo: "asc" }, { sequence: "asc" }],
    include: {
      unit: { select: { code: true, name: true } },
      studentUnits: {
        where: { enrollmentId: enrollment.id },
        select: { status: true, score: true, maxScore: true, grade: true },
      },
    },
  });

  /*
   * Grouped the way a student reads a programme: year, then semester inside it.
   *
   * A monthly programme's units carry no year or semester — they are laid out by month — so
   * those units sit under a single unnumbered group rather than being dropped or invented into
   * a semester they do not belong to.
   */
  const years = new Map<number, Map<number, typeof units>>();
  for (const unit of units) {
    const yearKey = unit.yearIndex ?? 0;
    const semesterKey = unit.semesterNo ?? 0;
    const bySemester = years.get(yearKey) ?? new Map<number, typeof units>();
    bySemester.set(semesterKey, [...(bySemester.get(semesterKey) ?? []), unit]);
    years.set(yearKey, bySemester);
  }

  return {
    enrollment,
    place,
    years: [...years.entries()]
      .sort(([a], [b]) => a - b)
      .map(([yearIndex, bySemester]) => ({
        yearIndex,
        semesters: [...bySemester.entries()]
          .sort(([a], [b]) => a - b)
          .map(([semesterNo, rows]) => ({
            semesterNo,
            current:
              yearIndex !== 0 && yearIndex === place.yearIndex && semesterNo === place.semesterNo,
            units: rows.map((unit) => {
              const mine = unit.studentUnits[0] ?? null;
              return {
                id: unit.id,
                code: unit.unit.code,
                title: unit.unit.name,
                status: mine?.status ?? "NOT_STARTED",
                grade: mine?.grade ?? null,
                score: mine?.score !== null && mine !== null ? money(mine.score) : null,
                maxScore: mine?.maxScore !== null && mine !== null ? money(mine.maxScore) : null,
              };
            }),
          })),
      })),
  };
}

/** The student's current class and the ones they belonged to before it. */
export async function getStudentClass() {
  const { enrollment } = await getStudentEnrolment();
  if (!enrollment) return { enrollment: null, current: null, previous: [] };

  const memberships = await prisma.classMembership.findMany({
    where: { enrollmentId: enrollment.id },
    orderBy: { joinedAt: "desc" },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          note: true,
          status: true,
          tutors: {
            select: { tutor: { select: { user: { select: { fullName: true } } } } },
          },
          _count: { select: { memberships: { where: { leftAt: null } } } },
        },
      },
    },
  });

  const shape = (row: (typeof memberships)[number]) => ({
    id: row.class.id,
    name: row.class.name,
    note: row.class.note,
    status: row.class.status,
    tutors: row.class.tutors.map((tutor) => tutor.tutor.user.fullName),
    classmates: row.class._count.memberships,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    reason: row.reason,
  });

  const current = memberships.find((row) => row.leftAt === null) ?? null;

  return {
    enrollment,
    current: current ? shape(current) : null,
    previous: memberships.filter((row) => row.leftAt !== null).map(shape),
  };
}

/** What the student has been billed, what they have paid, and every payment on record. */
export async function getStudentFees() {
  const { student, enrollment } = await getStudentEnrolment();

  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId: student.studentId, status: { not: "VOID" } },
      orderBy: [{ periodYear: "asc" }, { periodSemester: "asc" }, { dueAt: "asc" }],
      select: {
        id: true,
        number: true,
        status: true,
        dueAt: true,
        createdAt: true,
        periodYear: true,
        periodSemester: true,
        lines: { select: { label: true, amount: true } },
      },
    }),
    prisma.payment.findMany({
      where: { studentId: student.studentId },
      orderBy: { paidAt: "desc" },
      select: { id: true, invoiceId: true, amount: true, paidAt: true, reference: true, method: true, receiptNo: true },
    }),
  ]);

  const rows = invoices.map((row) => ({
    ...row,
    amount: row.lines.reduce((sum, line) => sum + money(line.amount), 0),
  }));

  const billed = rows.reduce((sum, row) => sum + row.amount, 0);
  const settled = payments.reduce((sum, row) => sum + money(row.amount), 0);

  return {
    student,
    enrollment,
    invoices: rows,
    payments,
    totals: { billed, paid: settled, balance: Math.max(0, billed - settled) },
  };
}

/** The student's own identity card, if one has been issued. */
export async function getStudentCard() {
  const { student } = await getStudentEnrolment();

  const card = await prisma.idCard.findFirst({
    where: { studentId: student.studentId },
    orderBy: { issuedAt: "desc" },
    select: {
      id: true,
      serial: true,
      status: true,
      issuedAt: true,
      expiresAt: true,
      verifyToken: true,
    },
  });

  return { student, card };
}

/** The details the college holds for the student. Read-only; the office changes them. */
export async function getStudentProfile() {
  const { student, enrollment } = await getStudentEnrolment();

  const profile = await prisma.studentProfile.findUnique({
    where: { id: student.studentId },
    include: {
      campus: { select: { name: true } },
      user: { select: { fullName: true, email: true, phone: true } },
    },
  });

  return { student, enrollment, profile };
}
