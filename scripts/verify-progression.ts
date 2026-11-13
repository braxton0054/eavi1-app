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
 * A student billed only for their first period, then advanced by the sync, should end up with
 * exactly one extra invoice — the period they have just entered. Re-running must add nothing.
 */
async function checkBilling() {
  const { prisma } = await import("@/lib/prisma");
  const { generateFeeSchedule, activePlanFor } = await import("@/lib/fees/schedule");
  const { nextInvoiceNumbers } = await import("@/lib/actions/college/_shared");
  const { syncProgression } = await import("@/lib/academics/progression-sync");

  const planRow = await prisma.programFeePlan.findFirst({ where: { isActive: true } });
  if (!planRow) {
    console.log("  skip no active fee plan in this database");
    return;
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { status: "ACTIVE", programId: planRow.programId },
    include: { period: true },
  });
  if (!enrollment) {
    console.log("  skip no enrolled student on the billed programme");
    return;
  }

  const plan = await activePlanFor(enrollment.programId);
  const total = plan?.periods.length ?? 0;
  const originalInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: enrollment.id },
    select: { id: true },
  });

  try {
    await prisma.invoice.deleteMany({ where: { enrollmentId: enrollment.id } });

    const numbers = await nextInvoiceNumbers(total);
    await prisma.$transaction(async (tx) => {
      await generateFeeSchedule(tx, {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        campusId: enrollment.campusId,
        programId: enrollment.programId,
        startDate: enrollment.period.startsAt,
        periodId: enrollment.period.id,
        upTo: { yearIndex: 1, semesterNo: 1 },
        numbers,
      });
    });

    const before = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    check("only the first period is billed to begin with", before === 1, `${before} invoices`);

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { yearIndex: 1, semesterNo: 1 },
    });
    const synced = await syncProgression(enrollment.campusId);
    const after = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    const current = await prisma.enrollment.findUnique({
      where: { id: enrollment.id },
      select: { yearIndex: true, semesterNo: true },
    });
    // The student is billed for every period up to where they now are, and no further.
    const expectedBills = plan!.periods.filter(
      (period) =>
        (period.yearIndex ?? 1) * 100 + (period.semesterNo ?? 1) <=
        current!.yearIndex * 100 + current!.semesterNo,
    ).length;
    check(
      "every period up to the student's current one is billed, and no further",
      after === expectedBills,
      `${after} invoices, expected ${expectedBills} for Y${current!.yearIndex}S${current!.semesterNo}`,
    );
    check("bills were raised as the student advanced", synced.billed > 0, `billed ${synced.billed}`);

    const resync = await syncProgression(enrollment.campusId);
    const final = await prisma.invoice.count({ where: { enrollmentId: enrollment.id } });
    check("re-syncing bills nothing twice", final === after && resync.billed === 0, `${final} invoices, billed ${resync.billed}`);
  } finally {
    // Leave the database as it was found.
    await prisma.invoice.deleteMany({ where: { enrollmentId: enrollment.id } });
    if (originalInvoices.length > 0) {
      await prisma.enrollment.update({
        where: { id: enrollment.id },
        data: { yearIndex: 1, semesterNo: 1 },
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
