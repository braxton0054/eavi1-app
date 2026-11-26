/**
 * Proves that a student's semester is counted from their own intake, and that the sync
 * advances cohorts without undoing a deliberate hold-back.
 *
 * Run with: npx tsx scripts/verify-progression.ts
 */
import "dotenv/config";

let failures = 0;

function check(name: string, pass: boolean, detail = "") {
  if (pass) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main() {
  const { currentPeriod, periodLabel } = await import("@/lib/academics/progression");
  const { expectedPeriod } = await import("@/lib/academics/progression-sync");

  const opts = { totalPeriods: 9, semestersPerYear: 3 };
  const january = new Date(Date.UTC(2026, 0, 5));
  const may = new Date(Date.UTC(2026, 4, 4));
  const september = new Date(Date.UTC(2026, 8, 7));

  const at = (intake: Date, when: Date) => periodLabel(currentPeriod({ startsAt: intake }, when, opts));

  console.log("\n1. Every cohort's Semester 1 begins at its own intake");
  check("January starts in Year 1 · Semester 1", at(january, new Date(Date.UTC(2026, 0, 20))) === "Year 1 · Semester 1");
  check("May starts in Year 1 · Semester 1", at(may, new Date(Date.UTC(2026, 4, 20))) === "Year 1 · Semester 1");
  check("September starts in Year 1 · Semester 1", at(september, new Date(Date.UTC(2026, 8, 20))) === "Year 1 · Semester 1");

  console.log("\n2. A May joiner is not placed in Semester 2 because January has moved on");
  const sameDay = new Date(Date.UTC(2026, 4, 20));
  check("January is in its Semester 2", at(january, sameDay) === "Year 1 · Semester 2");
  check("May is in its Semester 1", at(may, sameDay) === "Year 1 · Semester 1");

  console.log("\n3. The progression table from the requirement");
  const table: [string, Date, string, string, string][] = [
    ["January", new Date(Date.UTC(2026, 0, 20)), "Year 1 · Semester 1", "not enrolled", "not enrolled"],
    ["May", new Date(Date.UTC(2026, 4, 20)), "Year 1 · Semester 2", "Year 1 · Semester 1", "not enrolled"],
    ["September", new Date(Date.UTC(2026, 8, 20)), "Year 1 · Semester 3", "Year 1 · Semester 2", "Year 1 · Semester 1"],
  ];
  for (const [month, when, jan, mayCell, sep] of table) {
    const state = (start: Date) => (when < start ? "not enrolled" : at(start, when));
    check(`${month}: ${jan} / ${mayCell} / ${sep}`,
      state(january) === jan && state(may) === mayCell && state(september) === sep,
      `${state(january)} / ${state(may)} / ${state(september)}`);
  }

  console.log("\n4. The sync moves forward but never undoes a hold-back");
  const stored = { period: { startsAt: may } };
  // Four-month periods from 4 May: Y1S2 from 4 Sep, Y1S3 from 4 Jan 2027.
  const ahead = expectedPeriod({ ...stored, yearIndex: 1, semesterNo: 1 }, 9, { ...opts, asOf: new Date(Date.UTC(2027, 0, 10)) });
  check("a stale period is advanced", ahead.yearIndex === 1 && ahead.semesterNo === 3, `${ahead.yearIndex}/${ahead.semesterNo}`);

  const oneTermOn = expectedPeriod({ ...stored, yearIndex: 1, semesterNo: 1 }, 9, { ...opts, asOf: new Date(Date.UTC(2026, 8, 10)) });
  check("one period later it has moved once", oneTermOn.yearIndex === 1 && oneTermOn.semesterNo === 2, `${oneTermOn.yearIndex}/${oneTermOn.semesterNo}`);

  // A student the office deliberately pushed AHEAD stays there; time never pulls them back.
  const heldAhead = expectedPeriod({ ...stored, yearIndex: 2, semesterNo: 1 }, 9, { ...opts, asOf: new Date(Date.UTC(2026, 5, 1)) });
  check("a student ahead of their intake is never pulled back",
    heldAhead.yearIndex === 2 && heldAhead.semesterNo === 1,
    `${heldAhead.yearIndex}/${heldAhead.semesterNo}`);

  const aheadOfTime = expectedPeriod({ ...stored, yearIndex: 2, semesterNo: 1 }, 9, { ...opts, asOf: new Date(Date.UTC(2026, 5, 1)) });
  check("a student moved ahead by the office is left alone", aheadOfTime.yearIndex === 2 && aheadOfTime.semesterNo === 1);

  console.log("\n5. Progression stops at the end of the programme");
  const past = at(january, new Date(Date.UTC(2035, 0, 1)));
  check("a finished programme holds its last period", past === "Year 3 · Semester 3", past);

  console.log("\n6. Advancing raises the bill for the newly reached period, and only that one");
  await checkBilling();

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  if (failures > 0) process.exitCode = 1;
}

/**
 * A dedicated fixture proves that advancing a student raises only the newly reached bills.
 * The sync is scoped to a campus created here, so it can never advance a real enrolment.
 */
async function checkBilling() {
  const { prisma } = await import("@/lib/prisma");
  const { generateFeeSchedule } = await import("@/lib/fees/schedule");
  const { nextInvoiceNumbers } = await import("@/lib/actions/college/_shared");
  const { syncProgression } = await import("@/lib/academics/progression-sync");

  const tag = `progbill-${Date.now()}`;
  const campus = await prisma.campus.create({
    data: { code: tag, name: `${tag} campus`, place: "Test", takesApplicants: false },
    select: { id: true },
  });
  const createdPeriodIds: string[] = [];
  let createdCadenceId: string | null = null;
  let programId: string | null = null;

  try {
    const department = await prisma.department.create({ data: { name: `${tag} dept` }, select: { id: true } });
    const body = await prisma.programBody.create({ data: { name: `${tag} body`, code: tag }, select: { id: true } });
    const type = await prisma.programType.create({ data: { name: `${tag} type`, code: tag }, select: { id: true } });
    const existingCadence = await prisma.feeCadence.findFirst({ where: { kind: "SEMESTER" }, select: { id: true } });
    const cadence = existingCadence ?? await prisma.feeCadence.create({
      data: { name: `${tag} cadence`, kind: "SEMESTER" },
      select: { id: true },
    });
    if (!existingCadence) createdCadenceId = cadence.id;

    const program = await prisma.program.create({
      data: {
        code: tag,
        name: `${tag} programme`,
        departmentId: department.id,
        bodyId: body.id,
        typeId: type.id,
        cadenceId: cadence.id,
        durationMonths: 12,
        structure: "SEMESTER",
        minKcseGrade: "C",
        campuses: { connect: { id: campus.id } },
      },
      select: { id: true },
    });
    programId = program.id;
    const plan = await prisma.programFeePlan.create({
      data: {
        programId: program.id,
        version: 1,
        cadenceId: cadence.id,
        durationMonths: 12,
        totalAmount: "15000.00",
        isActive: true,
      },
      select: { id: true },
    });
    await prisma.feeItem.createMany({
      data: [1, 2, 3].map((semesterNo) => ({
        programId: program.id,
        planId: plan.id,
        sequence: semesterNo,
        label: `Year 1 · Semester ${semesterNo}`,
        amount: "5000.00",
        yearIndex: 1,
        semesterNo,
        dueOffsetDays: (semesterNo - 1) * 120,
      })),
    });

    // An ancient, official three-period calendar guarantees forward progression. Existing rows
    // are read-only; only periods actually created by this run are eligible for cleanup.
    const periods: { id: string; startsAt: Date }[] = [];
    for (const [month, sequence] of [[1, 1], [5, 2], [9, 3]] as const) {
      const existing = await prisma.academicPeriod.findUnique({
        where: { year_month: { year: 1900, month } },
        select: { id: true, startsAt: true },
      });
      if (existing) {
        periods.push(existing);
        continue;
      }
      const startsAt = new Date(Date.UTC(1900, month - 1, 5));
      const created = await prisma.academicPeriod.create({
        data: {
          name: `${["January", "May", "September"][sequence - 1]} intake 1900`,
          year: 1900,
          month,
          sequence,
          startsAt,
          endsAt: new Date(Date.UTC(1900, month + 3, 20)),
          applicationDeadline: new Date(Date.UTC(1899, month - 2, 15)),
        },
        select: { id: true, startsAt: true },
      });
      createdPeriodIds.push(created.id);
      periods.push(created);
    }

    const user = await prisma.user.create({
      data: {
        email: `${tag}@example.test`,
        fullName: `${tag} student`,
        passwordHash: "not-a-real-hash",
        role: "STUDENT",
        status: "ACTIVE",
        campusId: campus.id,
      },
      select: { id: true },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, admissionNo: `PB/${tag}`, campusId: campus.id },
      select: { id: true },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        programId: program.id,
        campusId: campus.id,
        periodId: periods[0].id,
        yearIndex: 1,
        semesterNo: 1,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    const initialNumbers = await nextInvoiceNumbers(1);
    await prisma.$transaction(async (tx) => {
      await generateFeeSchedule(tx, {
        studentId: student.id,
        enrollmentId: enrollment.id,
        campusId: campus.id,
        programId: program.id,
        startDate: periods[0].startsAt,
        periodId: periods[0].id,
        upTo: { yearIndex: 1, semesterNo: 1 },
        numbers: initialNumbers,
      });
    });
    const before = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    check("only the first period is billed to begin with", before === 1, `${before} invoices`);

    const synced = await syncProgression(campus.id);
    const after = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    const current = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
      select: { yearIndex: true, semesterNo: true },
    });
    check(
      "the fixture advances to the final period without touching another campus",
      synced.checked === 1 && synced.advanced === 1 && current.yearIndex === 1 && current.semesterNo === 3,
      `${synced.checked}/${synced.advanced} at Y${current.yearIndex}S${current.semesterNo}`,
    );
    check(
      "every period up to the student's current one is billed, and no further",
      after === 3 && synced.billed === 2,
      `${after} invoices, billed ${synced.billed}`,
    );

    const resync = await syncProgression(campus.id);
    const final = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    check("re-syncing bills nothing twice", final === after && resync.billed === 0, `${final} invoices, billed ${resync.billed}`);
  } finally {
    // Restrictive financial foreign keys: allocations, receipt headers, lines, then invoices.
    const invoices = await prisma.invoice.findMany({ where: { campusId: campus.id }, select: { id: true, studentId: true } });
    const invoiceIds = invoices.map((invoice) => invoice.id);
    const students = await prisma.studentProfile.findMany({ where: { campusId: campus.id }, select: { id: true } });
    const studentIds = students.map((student) => student.id);
    const receipts = await prisma.receipt.findMany({
      where: { OR: [{ campusId: campus.id }, { studentId: { in: studentIds } }] },
      select: { id: true },
    });
    const receiptIds = receipts.map((receipt) => receipt.id);
    await prisma.payment.deleteMany({
      where: { OR: [{ invoiceId: { in: invoiceIds } }, { studentId: { in: studentIds } }, { receiptId: { in: receiptIds } }] },
    });
    await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.auditLog.deleteMany({ where: { campusId: campus.id } });
    await prisma.studentUnit.deleteMany({ where: { enrollment: { campusId: campus.id } } });
    await prisma.studentAttachment.deleteMany({ where: { enrollment: { campusId: campus.id } } });
    await prisma.enrollment.deleteMany({ where: { campusId: campus.id } });
    if (programId) {
      await prisma.feeItem.deleteMany({ where: { programId } });
      await prisma.programFeePlan.deleteMany({ where: { programId } });
      await prisma.program.deleteMany({ where: { id: programId } });
    }
    await prisma.studentProfile.deleteMany({ where: { campusId: campus.id } });
    await prisma.user.deleteMany({ where: { campusId: campus.id } });
    if (createdPeriodIds.length > 0) {
      await prisma.academicPeriod.deleteMany({ where: { id: { in: createdPeriodIds } } });
    }
    await prisma.campus.deleteMany({ where: { id: campus.id } });
    await prisma.department.deleteMany({ where: { name: `${tag} dept` } });
    await prisma.programBody.deleteMany({ where: { code: tag } });
    await prisma.programType.deleteMany({ where: { code: tag } });
    if (createdCadenceId) await prisma.feeCadence.deleteMany({ where: { id: createdCadenceId } });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}).finally(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
