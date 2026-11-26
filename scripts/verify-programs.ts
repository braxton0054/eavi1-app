/**
 * End-to-end check of the programme structure workflow, on a disposable database:
 *
 *   DATABASE_URL="postgresql://…/eavi_progtest?schema=public" npx tsx scripts/verify-programs.ts
 *
 * Covers the twelve scenarios: editing, deletion rules, archiving, attachment stages, unit
 * plans for semesters/months/modules, reusable units, student registration, progression and
 * the link to the fee schedule. Every row it creates is removed at the end.
 */

import "dotenv/config";

import { prisma } from "@/lib/prisma";
import {
  recordUnitResult,
  registerEnrolmentUnits,
  registerPeriod,
} from "@/lib/academics/registration";
import { archiveRefusal, deletionRefusal, lifecycleCounts } from "@/lib/academics/lifecycle";
import { generateFeeSchedule } from "@/lib/fees/schedule";

const tag = `progflow-${Date.now()}`;
let failures = 0;
/** The intake is college-wide, so cleanup must target the exact period this run created. */
let periodIdForCleanup: string | null = null;

function check(label: string, condition: boolean, detail?: string | null) {
  if (condition) console.log(`  ok   ${label}`);
  else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const day = (value: string) => new Date(`${value}T00:00:00`);

async function main() {
  console.log(`Programme structure verification · ${tag}\n`);

  const campus = await prisma.campus.create({
    data: { code: `TP${Date.now() % 100000}`, name: `${tag} campus`, place: "Test", takesApplicants: false },
    select: { id: true },
  });

  // The cohort the test student joins; their Semester 1 begins on this date. The intake is one
  // college-wide period, so an existing row for the year and month is reused rather than copied
  // for every campus. A period that already exists is college data and is left untouched.
  const intakeForYear = await prisma.academicPeriod.findUnique({
    where: { year_month: { year: 2027, month: 1 } },
    select: { id: true },
  });
  const intake = intakeForYear ?? (await prisma.academicPeriod.create({
    data: {
      name: "January intake 2027",
      year: 2027,
      month: 1,
      sequence: 1,
      startsAt: day("2027-01-12"),
      endsAt: day("2027-04-20"),
      applicationDeadline: day("2026-12-20"),
    },
    select: { id: true },
  }));
  if (!intakeForYear) periodIdForCleanup = intake.id;

  const department = await prisma.department.create({ data: { name: `${tag} dept` }, select: { id: true } });
  const body = await prisma.programBody.create({ data: { name: `${tag} body`, code: `PB${Date.now() % 10000}` }, select: { id: true } });
  const type = await prisma.programType.create({ data: { name: `${tag} type`, code: `PT${Date.now() % 10000}` }, select: { id: true } });
  const cadence = await prisma.feeCadence.findFirst({ where: { kind: "SEMESTER" }, select: { id: true } });
  if (!cadence) throw new Error("Seed a per-semester payment type first.");

  const base = {
    departmentId: department.id,
    bodyId: body.id,
    typeId: type.id,
    cadenceId: cadence.id,
    minKcseGrade: "C" as const,
    campuses: { connect: { id: campus.id } },
  };

  const semesterProgram = await prisma.program.create({
    data: { ...base, code: `SP${Date.now() % 10000}`, name: `${tag} semester`, durationMonths: 12, structure: "SEMESTER" },
    select: { id: true },
  });

  async function unit(code: string, name: string) {
    return prisma.unit.create({ data: { code: `${tag}-${code}`, name }, select: { id: true } });
  }

  const math = await unit("MAT", "Mathematics");
  const apps = await unit("CAP", "Computer Applications");
  const comm = await unit("COM", "Communication Skills");
  const db = await unit("DBS", "Database Systems");
  const net = await unit("NET", "Networking");

  async function place(programId: string, unitId: string, periodKey: string, label: string, year: number | null, semester: number | null, sequence: number) {
    return prisma.programUnit.create({
      data: {
        programId,
        unitId,
        periodKey,
        periodLabel: label,
        yearIndex: year,
        semesterNo: semester,
        sequence,
      },
      select: { id: true },
    });
  }

  console.log("1. Editing an existing programme");
  await prisma.program.update({
    where: { id: semesterProgram.id },
    data: { name: `${tag} semester (revised)`, durationMonths: 12, structure: "SEMESTER" },
  });
  const edited = await prisma.program.findUnique({ where: { id: semesterProgram.id }, select: { name: true } });
  check("the corrected name is stored", edited?.name === `${tag} semester (revised)`, edited?.name);

  console.log("\n2. Semester plan: different units per semester, with one unit reused");
  await place(semesterProgram.id, math.id, "Y1S1", "Year 1 · Semester 1", 1, 1, 1);
  await place(semesterProgram.id, apps.id, "Y1S1", "Year 1 · Semester 1", 1, 1, 2);
  await place(semesterProgram.id, comm.id, "Y1S1", "Year 1 · Semester 1", 1, 1, 3);
  await place(semesterProgram.id, db.id, "Y1S2", "Year 1 · Semester 2", 1, 2, 1);
  // Communication Skills is offered again, without defining the unit twice.
  await place(semesterProgram.id, comm.id, "Y1S2", "Year 1 · Semester 2", 1, 2, 2);
  await place(semesterProgram.id, net.id, "Y1S3", "Year 1 · Semester 3", 1, 3, 1);

  const placements = await prisma.programUnit.count({ where: { programId: semesterProgram.id } });
  check("six placements across three semesters", placements === 6, String(placements));
  check(
    "the reused unit has one definition and two placements",
    (await prisma.unit.count({ where: { id: comm.id } })) === 1 &&
      (await prisma.programUnit.count({ where: { programId: semesterProgram.id, unitId: comm.id } })) === 2,
  );

  console.log("\n3. Industrial attachment configured after Semester 3");
  const requirement = await prisma.attachmentRequirement.create({
    data: {
      programId: semesterProgram.id,
      sequence: 1,
      label: "Attachment 1",
      afterYearIndex: 1,
      afterSemesterNo: 3,
      durationWeeks: 12,
      assessmentNote: "Logbook and host report",
    },
    select: { id: true, afterYearIndex: true, afterSemesterNo: true, durationWeeks: true },
  });
  check(
    "the stage is stored after semester 3",
    requirement.afterYearIndex === 1 && requirement.afterSemesterNo === 3 && requirement.durationWeeks === 12,
  );

  console.log("\n4. Enrolling a student registers the unit plan");
  const user = await prisma.user.create({
    data: {
      email: `${tag}@example.test`,
      fullName: `${tag} student`,
      passwordHash: "x",
      role: "STUDENT",
      status: "ACTIVE",
      campusId: campus.id,
    },
    select: { id: true },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, admissionNo: `PF/${tag}`, campusId: campus.id },
    select: { id: true },
  });
  const enrollment = await prisma.enrollment.create({
    data: { studentId: student.id, programId: semesterProgram.id, campusId: campus.id, periodId: intake.id, status: "ACTIVE" },
    select: { id: true },
  });

  await prisma.$transaction((tx) =>
    registerEnrolmentUnits(tx, {
      enrollmentId: enrollment.id,
      studentId: student.id,
      programId: semesterProgram.id,
    }),
  );

  const registered = await prisma.studentUnit.findMany({
    where: { enrollmentId: enrollment.id },
    include: { programUnit: true },
  });
  check("every placed unit has a student record", registered.length === 6, String(registered.length));
  check(
    "only the first semester is registered",
    registered.filter((row) => row.status === "REGISTERED").length === 3,
    String(registered.filter((row) => row.status === "REGISTERED").length),
  );
  check(
    "an attachment record was opened",
    (await prisma.studentAttachment.count({ where: { enrollmentId: enrollment.id } })) === 1,
  );

  console.log("\n5. Progression needs the earlier semester completed");
  const blocked = await prisma.$transaction((tx) =>
    registerPeriod(tx, { enrollmentId: enrollment.id, periodKey: "Y1S2", override: false }),
  );
  check("semester 2 is refused while semester 1 is open", !blocked.ok && blocked.reason === "outstanding", JSON.stringify(blocked));

  const firstSemester = registered.filter((row) => row.programUnit.periodKey === "Y1S1");
  for (const row of firstSemester) {
    await prisma.$transaction((tx) =>
      recordUnitResult(tx, {
        studentUnitId: row.id,
        status: "COMPLETED",
        score: 70,
        maxScore: 100,
        grade: "B",
        remark: null,
      }),
    );
  }

  const opened = await prisma.$transaction((tx) =>
    registerPeriod(tx, { enrollmentId: enrollment.id, periodKey: "Y1S2", override: false }),
  );
  check("semester 2 opens once semester 1 is complete", opened.ok && opened.registered === 2, JSON.stringify(opened));

  console.log("\n6. Attachment eligibility follows completed units");
  const secondSemester = registered.filter((row) => row.programUnit.periodKey === "Y1S2");
  const thirdSemester = registered.filter((row) => row.programUnit.periodKey === "Y1S3");

  for (const row of secondSemester) {
    await prisma.$transaction((tx) =>
      recordUnitResult(tx, { studentUnitId: row.id, status: "COMPLETED", score: 65, maxScore: 100, grade: "C", remark: null }),
    );
  }

  let attachment = await prisma.studentAttachment.findFirst({ where: { enrollmentId: enrollment.id } });
  check("not eligible while semester 3 is unfinished", attachment?.status === "NOT_ELIGIBLE", attachment?.status);

  for (const row of thirdSemester) {
    await prisma.$transaction((tx) =>
      recordUnitResult(tx, { studentUnitId: row.id, status: "COMPLETED", score: 80, maxScore: 100, grade: "A", remark: null }),
    );
  }

  attachment = await prisma.studentAttachment.findFirst({ where: { enrollmentId: enrollment.id } });
  check("eligible once semester 3 is complete", attachment?.status === "ELIGIBLE", attachment?.status);

  console.log("\n7. Fees and academic progress move independently");
  const plan = await prisma.programFeePlan.create({
    data: {
      programId: semesterProgram.id,
      version: 1,
      cadenceId: cadence.id,
      durationMonths: 12,
      totalAmount: 15000,
      isActive: true,
    },
    select: { id: true },
  });
  for (const [index, label] of ["Year 1 · Semester 1", "Year 1 · Semester 2", "Year 1 · Semester 3"].entries()) {
    await prisma.feeItem.create({
      data: {
        programId: semesterProgram.id,
        planId: plan.id,
        sequence: index + 1,
        label,
        amount: 5000,
        yearIndex: 1,
        semesterNo: index + 1,
        dueOffsetDays: index * 120,
      },
    });
  }

  const fees = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: student.id,
      enrollmentId: enrollment.id,
      campusId: campus.id,
      programId: semesterProgram.id,
      startDate: day("2027-01-10"),
      numbers: [`PF/${tag}/1`, `PF/${tag}/2`, `PF/${tag}/3`],
    }),
  );
  check("three semester bills are raised", fees.created === 3, String(fees.created));
  check(
    "the bills are unaffected by unit progress",
    (await prisma.invoice.count({ where: { enrollmentId: enrollment.id } })) === 3,
  );

  console.log("\n8. Deletion rules");
  let counts = await lifecycleCounts(prisma, semesterProgram.id);
  check("an active student blocks deletion", deletionRefusal(counts) === "active", deletionRefusal(counts));
  check("and blocks archiving", archiveRefusal(counts) === "active", archiveRefusal(counts));

  await prisma.enrollment.update({ where: { id: enrollment.id }, data: { status: "COMPLETED" } });

  counts = await lifecycleCounts(prisma, semesterProgram.id);
  check("a completed cohort no longer blocks archiving", archiveRefusal(counts) === null, archiveRefusal(counts));
  check("but the history still blocks deletion", deletionRefusal(counts) === "history", deletionRefusal(counts));

  await prisma.program.update({ where: { id: semesterProgram.id }, data: { archivedAt: new Date(), archivedReason: "Cohort completed" } });
  const archived = await prisma.program.findUnique({
    where: { id: semesterProgram.id },
    select: { archivedAt: true, _count: { select: { units: true } } },
  });
  check("archiving keeps the unit plan", archived?.archivedAt !== null && archived?._count.units === 6);
  check(
    "and keeps the student's results and bills",
    (await prisma.studentUnit.count({ where: { enrollmentId: enrollment.id } })) === 6 &&
      (await prisma.invoice.count({ where: { enrollmentId: enrollment.id } })) === 3,
  );

  console.log("\n9. A monthly programme groups units by month");
  const monthly = await prisma.program.create({
    data: { ...base, code: `MP${Date.now() % 10000}`, name: `${tag} monthly`, durationMonths: 3, structure: "MONTHLY" },
    select: { id: true },
  });
  await prisma.programUnit.createMany({
    data: [
      { programId: monthly.id, unitId: math.id, periodKey: "M1", periodLabel: "Month 1", monthIndex: 1, sequence: 1 },
      { programId: monthly.id, unitId: apps.id, periodKey: "M2", periodLabel: "Month 2", monthIndex: 2, sequence: 1 },
      { programId: monthly.id, unitId: db.id, periodKey: "M3", periodLabel: "Month 3", monthIndex: 3, sequence: 1 },
    ],
  });
  check(
    "three month placements exist",
    (await prisma.programUnit.count({ where: { programId: monthly.id } })) === 3,
  );
  check(
    "and they are grouped by month, not semester",
    (await prisma.programUnit.count({ where: { programId: monthly.id, monthIndex: { not: null } } })) === 3,
  );

  console.log("\n10. A module-based programme groups units by module");
  const modular = await prisma.program.create({
    data: { ...base, code: `MD${Date.now() % 10000}`, name: `${tag} modular`, durationMonths: 6, structure: "MODULE" },
    select: { id: true },
  });
  const moduleOne = await prisma.programModule.create({
    data: { programId: modular.id, code: "M01", name: "Foundations", sequence: 1, durationMonths: 3 },
    select: { id: true },
  });
  const moduleTwo = await prisma.programModule.create({
    data: { programId: modular.id, code: "M02", name: "Applications", sequence: 2, durationMonths: 3 },
    select: { id: true },
  });
  await prisma.programUnit.createMany({
    data: [
      { programId: modular.id, unitId: math.id, moduleId: moduleOne.id, periodKey: `MOD:${moduleOne.id}`, periodLabel: "Foundations", sequence: 1 },
      { programId: modular.id, unitId: comm.id, moduleId: moduleOne.id, periodKey: `MOD:${moduleOne.id}`, periodLabel: "Foundations", sequence: 2 },
      { programId: modular.id, unitId: net.id, moduleId: moduleTwo.id, periodKey: `MOD:${moduleTwo.id}`, periodLabel: "Applications", sequence: 1 },
    ],
  });
  check(
    "two modules hold three units between them",
    (await prisma.programModule.count({ where: { programId: modular.id } })) === 2 &&
      (await prisma.programUnit.count({ where: { programId: modular.id } })) === 3,
  );
  check(
    "every module unit points at its module",
    (await prisma.programUnit.count({ where: { programId: modular.id, moduleId: { not: null } } })) === 3,
  );

  console.log("\n11. A programme with no dependents can be deleted");
  const empty = await prisma.program.create({
    data: { ...base, code: `EM${Date.now() % 10000}`, name: `${tag} empty`, durationMonths: 6, structure: "SEMESTER" },
    select: { id: true },
  });
  const emptyCounts = await lifecycleCounts(prisma, empty.id);
  check("nothing blocks it", deletionRefusal(emptyCounts) === null, deletionRefusal(emptyCounts));
  await prisma.program.delete({ where: { id: empty.id } });
  check("the programme is gone", (await prisma.program.count({ where: { id: empty.id } })) === 0);

  console.log("\n12. Results are preserved when a programme is archived, never cascaded");
  check(
    "completed results are still readable",
    (await prisma.studentUnit.count({ where: { enrollmentId: enrollment.id, status: "COMPLETED" } })) === 6,
  );

  // --- cleanup -------------------------------------------------------------------
  // Remove only rows owned by this fixture. Posted money and invoice lines restrict their
  // headers, so financial children must go first.
  const fixtureInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: enrollment.id },
    select: { id: true },
  });
  const invoiceIds = fixtureInvoices.map((invoice) => invoice.id);
  const fixtureReceipts = await prisma.receipt.findMany({
    where: { OR: [{ campusId: campus.id }, { studentId: student.id }] },
    select: { id: true },
  });
  const receiptIds = fixtureReceipts.map((receipt) => receipt.id);
  await prisma.payment.deleteMany({
    where: { OR: [{ invoiceId: { in: invoiceIds } }, { studentId: student.id }, { receiptId: { in: receiptIds } }] },
  });
  await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.studentUnit.deleteMany({ where: { enrollmentId: enrollment.id } });
  await prisma.studentAttachment.deleteMany({ where: { enrollmentId: enrollment.id } });
  await prisma.enrollment.delete({ where: { id: enrollment.id } });
  await prisma.attachmentRequirement.deleteMany({ where: { programId: semesterProgram.id } });
  await prisma.feeItem.deleteMany({ where: { programId: semesterProgram.id } });
  await prisma.programFeePlan.deleteMany({ where: { programId: semesterProgram.id } });
  await prisma.program.deleteMany({
    where: { id: { in: [semesterProgram.id, monthly.id, modular.id] } },
  });
  await prisma.unit.deleteMany({ where: { code: { startsWith: tag } } });
  await prisma.studentProfile.delete({ where: { id: student.id } });
  await prisma.user.delete({ where: { id: user.id } });
  if (periodIdForCleanup) {
    await prisma.academicPeriod.delete({ where: { id: periodIdForCleanup } });
  }
  await prisma.campus.delete({ where: { id: campus.id } });
  await prisma.department.delete({ where: { id: department.id } });
  await prisma.programBody.delete({ where: { id: body.id } });
  await prisma.programType.delete({ where: { id: type.id } });

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
