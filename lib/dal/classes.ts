/**
 * Reads for teaching classes. Kept beside the other college reads so the campus filter is
 * applied the same way everywhere.
 */

import { prisma } from "@/lib/prisma";
import { campusWhere, requireCollegeAdmin } from "@/lib/session";
import { placementLabel, type MergePreview, type ClassShape } from "@/lib/academics/classes";
import { describeMerge } from "@/lib/academics/classes";
import { generatedPeriods, type Structure } from "@/lib/academics/structure";

export type ClassRow = {
  id: string;
  name: string;
  note: string | null;
  status: string;
  year: number;
  intakeMonth: string;
  programId: string;
  programName: string;
  programCode: string;
  campusId: number;
  campusName: string;
  intakeId: string;
  intakeName: string;
  /** Students whose membership is open right now. */
  students: number;
  /** Every distinct academic stage present, so a mixed class is visible at a glance. */
  placements: string;
  mergedFrom: number;
};

/** The list on the classes screen, optionally narrowed to one programme or year. */
export async function getClasses(filters: {
  programId?: string;
  year?: number;
  includeArchived?: boolean;
} = {}): Promise<ClassRow[]> {
  const scope = await requireCollegeAdmin();

  const rows = await prisma.academicClass.findMany({
    where: {
      ...campusWhere(scope.campusId),
      ...(filters.includeArchived ? {} : { status: "ACTIVE" }),
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(filters.year ? { year: filters.year } : {}),
    },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      note: true,
      status: true,
      year: true,
      intakeMonth: true,
      programId: true,
      campusId: true,
      intakeId: true,
      program: { select: { name: true, code: true, structure: true } },
      campus: { select: { name: true } },
      intake: { select: { name: true, year: true, month: true } },
      memberships: {
        select: { leftAt: true, enrollment: { select: { yearIndex: true, semesterNo: true } } },
      },
    },
  });

  return rows.map((row) => {
    const open = row.memberships.filter((m) => m.leftAt === null);
    const stages = [
      ...new Set(
        open.map((m) => placementLabel({ yearIndex: m.enrollment.yearIndex, semesterNo: m.enrollment.semesterNo }, row.program.structure)),
      ),
    ].sort();

    return {
      id: row.id,
      name: row.name,
      note: row.note,
      status: row.status,
      year: row.year,
      intakeMonth: row.intakeMonth,
      programId: row.programId,
      programName: row.program.name,
      programCode: row.program.code,
      campusId: row.campusId,
      campusName: row.campus.name,
      intakeId: row.intakeId,
      intakeName: `${row.intake.name} · ${row.intake.year}`,
      students: open.length,
      placements: stages.length === 0 ? "No students yet" : stages.join(" · "),
      // Memberships that were moved into this class from another one, for the audit trail.
      mergedFrom: row.memberships.filter((m) => m.leftAt === null).length,
    };
  });
}

/** Options for the class picker, including the intake each class belongs to. */
export type ClassOption = {
  value: string;
  label: string;
  programId: string;
  /** The intake the class belongs to. The admission form needs it to narrow the list, because
   *  a class is only valid for the intake its students are joining. */
  intakeId: string;
  year: number;
};

export async function getClassOptions(campusId: number | null, programId?: string): Promise<ClassOption[]> {
  const rows = await prisma.academicClass.findMany({
    where: {
      ...campusWhere(campusId),
      status: "ACTIVE",
      ...(programId ? { programId } : {}),
    },
    orderBy: [{ year: "desc" }, { name: "asc" }],
    select: { id: true, name: true, year: true, programId: true, intakeId: true },
  });

  return rows.map((row) => ({
    value: row.id,
    label: row.name,
    // A class belongs to one programme; the admission form shows only its own programme's.
    programId: row.programId,
    intakeId: row.intakeId,
    year: row.year,
  }));
}

export type ClassMember = {
  enrollmentId: string;
  studentId: string;
  name: string;
  admissionNo: string;
  phone: string | null;
  admissionDate: Date | null;
  intakeName: string;
  intakeMonth: string;
  placement: string;
  status: string;
  joinedAt: Date;
  owes: number;
};

/** The students in a class now, with the stages they are each at. */
export async function getClassMembers(classId: string): Promise<ClassMember[]> {
  const scope = await requireCollegeAdmin();

  const rows = await prisma.classMembership.findMany({
    where: { classId, leftAt: null, ...campusWhere(scope.campusId) },
    orderBy: { joinedAt: "asc" },
    select: {
      joinedAt: true,
      enrollment: {
        select: {
          id: true,
          studentId: true,
          yearIndex: true,
          semesterNo: true,
          status: true,
          intake: { select: { name: true, year: true, month: true } },
          program: { select: { structure: true } },
          student: {
            select: {
              admissionNo: true,
              admissionDate: true,
              user: { select: { fullName: true, phone: true } },
            },
          },
          invoices: {
            select: {
              status: true,
              lines: { select: { amount: true } },
              payments: { select: { amount: true } },
            },
          },
        },
      },
    },
  });

  return rows.map(({ joinedAt, enrollment }) => {
    // Outstanding is what was billed minus what was paid, counted only on bills still open.
    const owes = enrollment.invoices.reduce((total: number, invoice) => {
      if (invoice.status !== "OPEN" && invoice.status !== "PARTIAL") return total;
      const billed = invoice.lines.reduce((sum: number, line) => sum + Number(line.amount), 0);
      const paid = invoice.payments.reduce((sum: number, payment) => sum + Number(payment.amount), 0);
      return total + Math.max(0, billed - paid);
    }, 0);

    return {
      enrollmentId: enrollment.id,
      studentId: enrollment.studentId,
      name: enrollment.student.user.fullName,
      admissionNo: enrollment.student.admissionNo,
      phone: enrollment.student.user.phone,
      admissionDate: enrollment.student.admissionDate,
      intakeName: `${enrollment.intake.name} · ${enrollment.intake.year}`,
      intakeMonth: enrollment.intake.name,
      placement: placementLabel(
        { yearIndex: enrollment.yearIndex, semesterNo: enrollment.semesterNo },
        enrollment.program.structure,
      ),
      status: enrollment.status,
      joinedAt,
      owes,
    };
  });
}

/** Past membership of a class, kept so the register can be read as it stood on any date. */
export async function getClassHistory(classId: string) {
  const rows = await prisma.classMembership.findMany({
    where: { classId, leftAt: { not: null } },
    orderBy: { leftAt: "desc" },
    take: 50,
    select: {
      joinedAt: true,
      leftAt: true,
      reason: true,
      enrollment: {
        select: { student: { select: { admissionNo: true, user: { select: { fullName: true } } } } },
      },
    },
  });

  return rows.map((row) => ({
    student: `${row.enrollment.student.user.fullName} (${row.enrollment.student.admissionNo})`,
    joinedAt: row.joinedAt,
    leftAt: row.leftAt,
    reason: row.reason,
  }));
}

/**
 * Everything the merge screen needs: which classes can be targets, and what would happen.
 * Called both for the preview and immediately before the write, so the confirmation the
 * office saw is the same one that is carried out.
 */
export async function getMergePreview(sourceId: string, targetId: string): Promise<MergePreview | null> {
  const scope = await requireCollegeAdmin();

  const [source, target] = await Promise.all([
    loadClassShape(sourceId, scope.campusId),
    loadClassShape(targetId, scope.campusId),
  ]);
  if (!source || !target) return null;

  const [open, history, targetIds] = await Promise.all([
    prisma.classMembership.findMany({
      where: { classId: source.id, leftAt: null },
      select: { enrollmentId: true, enrollment: { select: { yearIndex: true, semesterNo: true } } },
    }),
    prisma.classMembership.count({ where: { classId: source.id, leftAt: { not: null } } }),
    prisma.classMembership.findMany({
      where: { classId: target.id, leftAt: null },
      select: { enrollmentId: true },
    }),
  ]);

  const inTarget = new Set(targetIds.map((row) => row.enrollmentId));
  const alreadyInTarget = open.filter((row) => inTarget.has(row.enrollmentId)).length;

  const { mergeBlockages, summarisePlacements } = await import("@/lib/academics/classes");

  return {
    source,
    target,
    blockers: mergeBlockages(source, target),
    students: open.length - alreadyInTarget,
    alreadyInTarget,
    activeMemberships: open.length,
    historicalMemberships: history,
    placements: summarisePlacements(
      open
        .filter((row) => !inTarget.has(row.enrollmentId))
        .map((row) => ({ yearIndex: row.enrollment.yearIndex, semesterNo: row.enrollment.semesterNo })),
    ),
    notices: [
      "Admission dates and official intakes stay as they are.",
      "Each student keeps their own academic stage — classes are not levelled by a merge.",
      "Unit registrations, marks, results, attachments, invoices and payments are untouched.",
      "Past class membership is retained for audit and reporting.",
    ],
  };
}

async function loadClassShape(id: string, campusId: number | null): Promise<ClassShape | null> {
  const row = await prisma.academicClass.findFirst({
    where: { id, ...campusWhere(campusId) },
    select: {
      id: true,
      name: true,
      programId: true,
      campusId: true,
      intakeId: true,
      intakeMonth: true,
      year: true,
      status: true,
    },
  });
  return row;
}

/** Human sentence for the confirmation button. */
export function mergeSummary(preview: MergePreview): string {
  return describeMerge(preview);
}

/** Intakes that a new class may be attached to, newest first. */
export async function getIntakeChoices(campusId: number | null) {
  const rows = await prisma.intake.findMany({
    where: campusWhere(campusId),
    orderBy: [{ year: "desc" }, { startsAt: "desc" }],
    select: { id: true, name: true, year: true, month: true, startsAt: true },
  });

  const { intakeValueForMonth, isOfficialIntakeMonth } = await import("@/lib/academics/classes");

  return rows
    .filter((row) => isOfficialIntakeMonth(row.month))
    .map((row) => ({
      id: row.id,
      name: row.name,
      year: row.year,
      month: row.month,
      startsAt: row.startsAt,
      officialMonth: intakeValueForMonth(row.month),
      label: `${row.name} · ${row.year}`,
    }));
}

/**
 * The academic stages a student may be placed at in a programme, taken from the same period
 * generator the unit planner uses so the picker cannot offer a stage the programme lacks.
 * A student with approved prior credit can be placed part-way in, not only at the first stage.
 */
export async function getPlacementOptions(programId: string) {
  const program = await prisma.program.findUnique({
    where: { id: programId },
    select: { structure: true, durationMonths: true },
  });

  const structure = (program?.structure ?? "SEMESTER") as Structure;
  const durationMonths = program?.durationMonths ?? 12;

  let periods = generatedPeriods(structure, durationMonths);

  // Modular and custom programmes get their periods from rows the office created, not from a
  // duration, so fall back to the programme's own units. Without this a module programme
  // offers no stage at all and a student cannot be placed in it.
  if (periods.length === 0) {
    const units = await prisma.programUnit.findMany({
      where: { programId },
      distinct: ["periodKey"],
      orderBy: [{ yearIndex: "asc" }, { semesterNo: "asc" }, { monthIndex: "asc" }, { sequence: "asc" }],
      select: { periodKey: true, periodLabel: true, yearIndex: true, semesterNo: true, monthIndex: true },
    });
    periods = units.map((unit) => ({
      key: unit.periodKey,
      label: unit.periodLabel,
      yearIndex: unit.yearIndex,
      semesterNo: unit.semesterNo,
      monthIndex: unit.monthIndex,
    }));
  }

  // Always offer the first stage, so a brand-new student found nothing at all cannot happen.
  if (periods.length === 0) {
    periods = [{ key: "Y1S1", label: "Year 1 · Semester 1", yearIndex: 1, semesterNo: 1, monthIndex: null }];
  }

  // Monthly programmes place by month index; semester ones by year and semester.
  return periods.map((period) => ({
    value:
      period.semesterNo !== null
        ? `${period.yearIndex ?? 1}:${period.semesterNo}`
        : `1:${period.monthIndex ?? 1}`,
    label: period.label,
  }));
}

/**
 * Stage choices for every programme the admission form offers, keyed by programme id.
 *
 * The student's placement depends on the programme they are joining, and the office may
 * switch programme mid-form, so the form needs all of them at once rather than whichever
 * programme happened to be listed first.
 */
export async function getPlacementOptionsByProgram(programIds: string[]) {
  const map: Record<string, { value: string; label: string }[]> = {};
  await Promise.all(
    programIds.map(async (programId) => {
      map[programId] = await getPlacementOptions(programId);
    }),
  );
  return map;
}
