/**
 * End-to-end check of the programme fee workflow, run against a disposable database:
 *
 *   DATABASE_URL="postgresql://…/eavi_feetest?schema=public" npx tsx scripts/verify-fees.ts
 *
 * It builds a monthly programme and a calendar-linked semester programme, enrols a student
 * in each, records a split payment, reprices a programme and proves the enrolled student's
 * bills did not move. Every row it creates is removed at the end.
 */

import "dotenv/config";

import { PaymentMethod, Role, Status } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { addMonths, generatePeriods, type FeeKind } from "@/lib/fees/periods";
import { generateFeeSchedule } from "@/lib/fees/schedule";
import { allocateStudentPayment } from "@/lib/fees/payment";
import { sumAmounts } from "@/lib/fees/ledger";

const tag = `feeflow-${Date.now()}`;
let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const day = (value: string) => new Date(`${value}T00:00:00`);

type PeriodSeed = {
  label: string;
  amount: number;
  yearIndex: number | null;
  semesterNo: number | null;
  dueOffsetDays: number;
};

/** Mirrors the save action: retire the live version, write the next one, then its periods. */
async function publishPlan(
  programId: string,
  cadenceId: string,
  durationMonths: number,
  periods: PeriodSeed[],
) {
  const total = periods.reduce((sum, period) => sum + period.amount, 0);

  return prisma.$transaction(async (tx) => {
    const last = await tx.programFeePlan.findFirst({
      where: { programId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await tx.programFeePlan.updateMany({ where: { programId, isActive: true }, data: { isActive: false } });
    const plan = await tx.programFeePlan.create({
      data: {
        programId,
        version: (last?.version ?? 0) + 1,
        cadenceId,
        durationMonths,
        totalAmount: total,
        isActive: true,
      },
      select: { id: true, version: true },
    });
    await tx.feeItem.createMany({
      data: periods.map((period, index) => ({
        programId,
        planId: plan.id,
        sequence: index + 1,
        label: period.label,
        amount: period.amount,
        yearIndex: period.yearIndex,
        semesterNo: period.semesterNo,
        dueOffsetDays: period.dueOffsetDays,
      })),
    });
    return plan;
  });
}

function draft(kind: FeeKind, durationMonths: number, amount: number): PeriodSeed[] {
  return generatePeriods(kind, durationMonths, 3).map((period) => ({
    label: period.label,
    amount,
    yearIndex: period.yearIndex,
    semesterNo: period.semesterNo,
    dueOffsetDays: period.dueOffsetDays,
  }));
}

async function main() {
  console.log(`Fees verification · ${tag}\n`);

  const campus = await prisma.campus.create({
    data: { code: `T${Date.now() % 100000}`, name: `${tag} campus`, place: "Test", takesApplicants: true },
    select: { id: true },
  });

  const calendarSeeds = [
    { year: 2027, semesterNo: 1, start: "2027-01-12", end: "2027-04-20" },
    { year: 2027, semesterNo: 2, start: "2027-05-10", end: "2027-08-18" },
    { year: 2027, semesterNo: 3, start: "2027-09-07", end: "2027-12-15" },
    { year: 2028, semesterNo: 1, start: "2028-01-10", end: "2028-04-18" },
    { year: 2028, semesterNo: 2, start: "2028-05-08", end: "2028-08-16" },
    { year: 2028, semesterNo: 3, start: "2028-09-05", end: "2028-12-13" },
  ];

  for (const seed of calendarSeeds) {
    await prisma.semester.create({
      data: {
        campusId: campus.id,
        year: seed.year,
        semesterNo: seed.semesterNo,
        name: `Year ${seed.year} · Semester ${seed.semesterNo}`,
        startDate: day(seed.start),
        endDate: day(seed.end),
      },
    });
  }

  const department = await prisma.department.create({ data: { name: `${tag} dept` }, select: { id: true } });
  const body = await prisma.programBody.create({
    data: { name: `${tag} body`, code: `B${Date.now() % 10000}` },
    select: { id: true },
  });
  const type = await prisma.programType.create({
    data: { name: `${tag} type`, code: `T${Date.now() % 10000}` },
    select: { id: true },
  });

  const monthlyCadence = await prisma.feeCadence.findFirst({ where: { kind: "MONTHLY" }, select: { id: true } });
  const semesterCadence = await prisma.feeCadence.findFirst({ where: { kind: "SEMESTER" }, select: { id: true } });
  if (!monthlyCadence || !semesterCadence) throw new Error("Monthly and per-semester cadences are missing.");

  const baseProgram = {
    departmentId: department.id,
    bodyId: body.id,
    typeId: type.id,
    minKcseGrade: "C" as const,
    campuses: { connect: { id: campus.id } },
  };

  const monthlyProgram = await prisma.program.create({
    data: {
      ...baseProgram,
      code: `M${Date.now() % 10000}`,
      name: `${tag} monthly`,
      cadenceId: monthlyCadence.id,
      durationMonths: 6,
    },
    select: { id: true },
  });

  const semesterProgram = await prisma.program.create({
    data: {
      ...baseProgram,
      code: `S${Date.now() % 10000}`,
      name: `${tag} semester`,
      cadenceId: semesterCadence.id,
      durationMonths: 24,
    },
    select: { id: true },
  });

  console.log("1. Monthly programme: six periods for six months");
  const monthlyPeriods = draft("MONTHLY", 6, 2500);
  check("six month rows generated", monthlyPeriods.length === 6, `got ${monthlyPeriods.length}`);
  check("labels run Month 1..6", monthlyPeriods[0]?.label === "Month 1" && monthlyPeriods[5]?.label === "Month 6");
  await publishPlan(monthlyProgram.id, monthlyCadence.id, 6, monthlyPeriods);

  console.log("\n2. Semester programme: periods follow the calendar's three semesters a year");
  const semesterPeriods = draft("SEMESTER", 24, 10000);
  check("two years of three semesters gives six rows", semesterPeriods.length === 6, `got ${semesterPeriods.length}`);
  check(
    "last row is year 2 semester 3",
    semesterPeriods[5]?.yearIndex === 2 && semesterPeriods[5]?.semesterNo === 3,
  );
  await publishPlan(semesterProgram.id, semesterCadence.id, 24, semesterPeriods);

  // --- Students ------------------------------------------------------------------
  async function enrol(name: string, programId: string, admissionNo: string) {
    const user = await prisma.user.create({
      data: {
        email: `${tag}-${name}@example.test`,
        fullName: `${tag} ${name}`,
        passwordHash: "not-a-real-hash",
        role: Role.STUDENT,
        status: Status.ACTIVE,
        campusId: campus.id,
      },
      select: { id: true },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, admissionNo, campusId: campus.id },
      select: { id: true },
    });
    const enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, programId, campusId: campus.id, status: "ACTIVE" },
      select: { id: true },
    });
    return { studentId: student.id, enrollmentId: enrollment.id };
  }

  const numbersFor = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `FT/${prefix}/${tag}/${index + 1}`);

  console.log("\n3. Enrolment generates the student's schedule");
  const a = await enrol("a", monthlyProgram.id, `FA/${tag}`);
  const start = day("2027-01-05");
  const generated = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: a.studentId,
      enrollmentId: a.enrollmentId,
      campusId: campus.id,
      programId: monthlyProgram.id,
      startDate: start,
      numbers: numbersFor("A", 6),
    }),
  );
  check("six invoices created", generated.created === 6, `created ${generated.created}`);

  const aInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    orderBy: { feePeriod: { sequence: "asc" } },
    include: { lines: true, payments: true },
  });
  check("six invoices on file", aInvoices.length === 6);
  check("every invoice bills 2,500", aInvoices.every((invoice) => sumAmounts(invoice.lines) === 2500));
  check(
    "each month is due a month after the last",
    aInvoices.every((invoice, index) => {
      const expected = addMonths(start, index);
      return invoice.dueAt !== null && invoice.dueAt.getTime() === expected.getTime();
    }),
  );
  check("all start unpaid", aInvoices.every((invoice) => invoice.status === "OPEN"));

  console.log("\n4. A partial payment spreads across the oldest periods");
  const receipt = `RCP/TEST/${tag}`;
  const partial = await prisma.$transaction((tx) =>
    allocateStudentPayment(tx, {
      studentId: a.studentId,
      amount: 3000,
      method: PaymentMethod.MPESA,
      reference: "QK123",
      paidAt: new Date(),
      receiptNo: receipt,
    }),
  );
  check("allocation accepted", partial.ok && partial.applied === 3000, JSON.stringify(partial));

  const afterPartial = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    orderBy: { feePeriod: { sequence: "asc" } },
    include: { lines: true, payments: true },
  });
  check("first period is settled", afterPartial[0]?.status === "PAID", afterPartial[0]?.status);
  check("second period is part paid", afterPartial[1]?.status === "PARTIAL", afterPartial[1]?.status);
  check(
    "the 500 remainder landed on the second period",
    sumAmounts(afterPartial[1]?.payments ?? []) === 500,
    String(sumAmounts(afterPartial[1]?.payments ?? [])),
  );

  console.log("\n5. The balance clears the rest of the schedule");
  const rest = await prisma.$transaction((tx) =>
    allocateStudentPayment(tx, {
      studentId: a.studentId,
      amount: 12000,
      method: PaymentMethod.BANK,
      reference: "TRX-9",
      paidAt: new Date(),
      receiptNo: receipt,
    }),
  );
  check("second receipt accepted", rest.ok && rest.applied === 12000, JSON.stringify(rest));

  const settled = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    include: { payments: true },
  });
  check("every period is paid", settled.every((invoice) => invoice.status === "PAID"));
  check(
    "the two receipts total the programme fee",
    settled.reduce((sum, invoice) => sum + sumAmounts(invoice.payments), 0) === 15000,
  );
  check(
    "every allocation row carries the receipt number",
    settled.every((invoice) => invoice.payments.every((payment) => payment.receiptNo === receipt)),
  );

  console.log("\n6. Re-running enrolment cannot bill a period twice");
  const replay = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: a.studentId,
      enrollmentId: a.enrollmentId,
      campusId: campus.id,
      programId: monthlyProgram.id,
      startDate: start,
      numbers: numbersFor("A", 6),
    }),
  );
  check("nothing new was created", replay.created === 0, `created ${replay.created}`);
  check("all six periods were recognised", replay.skipped === 6, `skipped ${replay.skipped}`);
  check(
    "invoice count is unchanged",
    (await prisma.invoice.count({ where: { enrollmentId: a.enrollmentId } })) === 6,
  );

  console.log("\n7. Semester bills take their dates from the academic calendar");
  const b = await enrol("b", semesterProgram.id, `FB/${tag}`);
  const bStart = day("2027-01-10");
  const bGenerated = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: b.studentId,
      enrollmentId: b.enrollmentId,
      campusId: campus.id,
      programId: semesterProgram.id,
      startDate: bStart,
      numbers: numbersFor("B", 6),
    }),
  );
  check("six semester invoices created", bGenerated.created === 6, `created ${bGenerated.created}`);

  const bInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: b.enrollmentId },
    orderBy: { feePeriod: { sequence: "asc" } },
    include: { semester: true, lines: true },
  });
  check("every bill points at a calendar semester", bInvoices.every((invoice) => invoice.semesterId !== null));
  check(
    "the first bill opens with the January semester",
    bInvoices[0]?.semester?.year === 2027 && bInvoices[0]?.semester?.semesterNo === 1,
  );
  check(
    "the fourth bill moves into the next academic year",
    bInvoices[3]?.semester?.year === 2028 && bInvoices[3]?.semester?.semesterNo === 1,
  );
  check(
    "the due date is the semester's own start date",
    bInvoices.every((invoice) => invoice.dueAt?.getTime() === invoice.semester?.startDate.getTime()),
  );
  check(
    "the academic period is recorded on the bill",
    bInvoices[5]?.periodYear === 2028 && bInvoices[5]?.periodSemester === 3,
  );

  console.log("\n8. Repricing leaves enrolled students' agreed fees alone");
  await publishPlan(monthlyProgram.id, monthlyCadence.id, 6, draft("MONTHLY", 6, 4000));
  const active = await prisma.programFeePlan.findFirst({
    where: { programId: monthlyProgram.id, isActive: true },
    select: { version: true, totalAmount: true },
  });
  check("version 2 is now live", active?.version === 2, String(active?.version));

  const untouched = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    include: { lines: true },
  });
  check(
    "the enrolled student's bills still total 15,000",
    untouched.reduce((sum, invoice) => sum + sumAmounts(invoice.lines), 0) === 15000,
  );

  const c = await enrol("c", monthlyProgram.id, `FC/${tag}`);
  const cGenerated = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: c.studentId,
      enrollmentId: c.enrollmentId,
      campusId: campus.id,
      programId: monthlyProgram.id,
      startDate: day("2027-02-01"),
      numbers: numbersFor("C", 6),
    }),
  );
  const cInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: c.enrollmentId },
    include: { lines: true },
  });
  check("a later student gets the new price", cGenerated.total === 24000, String(cGenerated.total));
  check(
    "each of their periods bills 4,000",
    cInvoices.length === 6 && cInvoices.every((invoice) => sumAmounts(invoice.lines) === 4000),
  );

  console.log("\n9. The accounts figures reconcile");
  const finance = await prisma.invoice.findMany({
    where: { campusId: campus.id, enrollmentId: { not: null }, status: { not: "VOID" } },
    include: { lines: true, payments: true },
  });
  const expected = finance.reduce((sum, invoice) => sum + sumAmounts(invoice.lines), 0);
  const collected = finance.reduce((sum, invoice) => sum + sumAmounts(invoice.payments), 0);
  check("expected fees are 99,000", expected === 99000, String(expected));
  check("collected fees are 15,000", collected === 15000, String(collected));
  check("outstanding is 84,000", expected - collected === 84000, String(expected - collected));

  // --- cleanup -------------------------------------------------------------------
  await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });
  await prisma.feeItem.deleteMany({ where: { programId: { in: [monthlyProgram.id, semesterProgram.id] } } });
  await prisma.programFeePlan.deleteMany({
    where: { programId: { in: [monthlyProgram.id, semesterProgram.id] } },
  });
  await prisma.program.deleteMany({ where: { id: { in: [monthlyProgram.id, semesterProgram.id] } } });
  await prisma.semester.deleteMany({ where: { campusId: campus.id } });
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
