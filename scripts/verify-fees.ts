/**
 * End-to-end check of the programme fee workflow, run against a disposable database:
 *
 *   DATABASE_URL="postgresql://…/eavi_feetest?schema=public" npx tsx scripts/verify-fees.ts
 *
 * It builds a monthly programme and a calendar-linked semester programme, enrols a student
 * in each, records a split payment, exercises receipt/invoice corrections, reprices a programme
 * and proves the enrolled student's bills did not move. Every row it creates is removed at the end.
 */

import "dotenv/config";

import { PaymentMethod, Role, Status } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { planPaymentAllocation } from "@/lib/fees/allocation";
import { correctReceipt, creditInvoice, unvoidInvoice, voidInvoiceWithReason } from "@/lib/fees/corrections";
import { invoicePosition, sumAmounts } from "@/lib/fees/ledger";
import { fromCents, parseFeeAmount, parsePaymentAmount, sumAmountCents, toCents } from "@/lib/fees/money";
import { addMonths, generatePeriods, type FeeKind } from "@/lib/fees/periods";
import { FinanceError, recordReceipt } from "@/lib/fees/receipts";
import { generateFeeSchedule } from "@/lib/fees/schedule";

const tag = `feeflow-${Date.now()}`;
let failures = 0;
/** The calendar is college-wide, so cleanup must target the exact periods this run created. */
const periodIdsForCleanup: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const day = (value: string) => new Date(`${value}T00:00:00`);

/** Two dates on the same calendar day, ignoring the time of day. */
const sameDay = (a: Date | null | undefined, b: Date) =>
  !!a && a.toDateString() === b.toDateString();

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
        totalAmount: fromCents(toCents(total)),
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
        amount: fromCents(toCents(period.amount)),
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

  /**
   * One shared intake per year and month, reused by every campus. A period that already exists
   * belongs to the college, so this script only reads it and never edits or removes it.
   */
  async function sharedPeriod(
    year: number,
    month: number,
    sequence: number,
    name: string,
    startsAt: Date,
    endsAt: Date,
    applicationDeadline: Date,
  ) {
    const existing = await prisma.academicPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing) return existing;

    const row = await prisma.academicPeriod.create({
      data: { name, year, month, sequence, startsAt, endsAt, applicationDeadline },
    });
    periodIdsForCleanup.push(row.id);
    return row;
  }

  const campus = await prisma.campus.create({
    data: { code: `T${Date.now() % 100000}`, name: `${tag} campus`, place: "Test", takesApplicants: false },
    select: { id: true },
  });

  /*
    Every enrolment belongs to a period, which anchors the student's own Semester 1. The period
    the test student joins is the shared January 2027 one, so it carries the window the student
    needs. One row serves every campus; the campus is on the enrolment, not the period.
  */
  const intake = await sharedPeriod(
    2027,
    1,
    1,
    "January intake 2027",
    day("2027-01-05"),
    day("2027-04-20"),
    day("2026-12-15"),
  );

  /*
   * The rest of the college calendar. A fee plan of kind SEMESTER reads how many periods the
   * year is split into off the shared calendar, so the college has to run its other two periods
   * or the six-period plan below would be billed as if the year had one period.
   */
  for (const seed of [
    { year: 2027, month: 5, sequence: 2, start: "2027-05-10", end: "2027-08-18" },
    { year: 2027, month: 9, sequence: 3, start: "2027-09-07", end: "2027-12-15" },
    { year: 2028, month: 1, sequence: 1, start: "2028-01-10", end: "2028-04-18" },
    { year: 2028, month: 5, sequence: 2, start: "2028-05-08", end: "2028-08-16" },
    { year: 2028, month: 9, sequence: 3, start: "2028-09-05", end: "2028-12-13" },
  ]) {
    await sharedPeriod(
      seed.year,
      seed.month,
      seed.sequence,
      `${["January", "May", "September"][seed.sequence - 1]} intake ${seed.year}`,
      day(seed.start),
      day(seed.end),
      // Applications close three weeks before the period opens.
      new Date(day(seed.start).getTime() - 21 * 86_400_000),
    );
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
      select: { id: true, email: true },
    });
    const student = await prisma.studentProfile.create({
      data: { userId: user.id, admissionNo, campusId: campus.id },
      select: { id: true },
    });
    const enrollment = await prisma.enrollment.create({
      data: { studentId: student.id, programId, campusId: campus.id, periodId: intake.id, status: "ACTIVE" },
      select: { id: true },
    });
    return {
      studentId: student.id,
      enrollmentId: enrollment.id,
      actor: { id: user.id, email: user.email },
    };
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
  const partial = await prisma.$transaction((tx) =>
    recordReceipt(tx, {
      studentId: a.studentId,
      campusId: campus.id,
      amountCents: 300_000,
      method: PaymentMethod.MPESA,
      reference: `QK-${tag}`,
      paidAt: new Date("2027-01-06T09:00:00Z"),
      actor: a.actor,
      idempotencyKey: `${tag}:partial`,
      allocation: "STUDENT",
    }),
  );
  check("allocation accepted", partial.amountCents === 300_000, JSON.stringify(partial));

  const firstReceipt = await prisma.receipt.findUnique({ where: { id: partial.receiptId } });
  check(
    "the first receipt has its own normalized identity",
    !!firstReceipt && firstReceipt.number === partial.receiptNo &&
      firstReceipt.numberNormalized === firstReceipt.number.toUpperCase(),
    firstReceipt?.number,
  );
  check(
    "the first receipt stores exact amount and ledger snapshot",
    !!firstReceipt && toCents(firstReceipt.amount) === 300_000 &&
      toCents(firstReceipt.totalFees) === 1_500_000 &&
      toCents(firstReceipt.paidToDate) === 300_000 &&
      toCents(firstReceipt.balance) === 1_200_000,
    firstReceipt ? JSON.stringify({
      amount: firstReceipt.amount,
      totalFees: firstReceipt.totalFees,
      paidToDate: firstReceipt.paidToDate,
      balance: firstReceipt.balance,
    }) : undefined,
  );
  check("the first receipt is issued", firstReceipt?.status === "ISSUED", firstReceipt?.status ?? undefined);

  const afterPartial = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    orderBy: { feePeriod: { sequence: "asc" } },
    include: { lines: true, payments: { include: { receipt: true } } },
  });
  check("first period is settled", afterPartial[0]?.status === "PAID", afterPartial[0]?.status);
  check("second period is part paid", afterPartial[1]?.status === "PARTIAL", afterPartial[1]?.status);
  check(
    "the 500 remainder landed on the second period",
    sumAmountCents(afterPartial[1]?.payments ?? []) === 50_000,
    String(sumAmountCents(afterPartial[1]?.payments ?? [])),
  );
  check(
    "both allocations point at the first receipt header",
    afterPartial.slice(0, 2).every((invoice) =>
      invoice.payments.length === 1 && invoice.payments[0].receiptId === partial.receiptId &&
        invoice.payments[0].receiptNo === partial.receiptNo,
    ),
  );

  console.log("\n5. The balance clears the rest of the schedule");
  const rest = await prisma.$transaction((tx) =>
    recordReceipt(tx, {
      studentId: a.studentId,
      campusId: campus.id,
      amountCents: 1_200_000,
      method: PaymentMethod.BANK,
      reference: `TRX-${tag}`,
      paidAt: new Date("2027-01-07T09:00:00Z"),
      actor: a.actor,
      idempotencyKey: `${tag}:balance`,
      allocation: "STUDENT",
    }),
  );
  check("second receipt accepted", rest.amountCents === 1_200_000, JSON.stringify(rest));
  check(
    "the two submissions produced distinct receipt identities",
    rest.receiptId !== partial.receiptId && rest.receiptNo !== partial.receiptNo,
    `${partial.receiptId} / ${rest.receiptId}`,
  );

  const settled = await prisma.invoice.findMany({
    where: { enrollmentId: a.enrollmentId },
    include: { payments: { include: { receipt: true } } },
  });
  const receiptRows = await prisma.receipt.findMany({
    where: { id: { in: [partial.receiptId, rest.receiptId] } },
  });
  const payments = settled.flatMap((invoice) => invoice.payments);
  check("every period is paid", settled.every((invoice) => invoice.status === "PAID"));
  check(
    "the two receipts total the programme fee",
    receiptRows.length === 2 && receiptRows.reduce((sum, row) => sum + toCents(row.amount), 0) === 1_500_000,
    String(receiptRows.reduce((sum, row) => sum + toCents(row.amount), 0)),
  );
  check(
    "posted payment rows total the programme fee exactly",
    sumAmountCents(payments) === 1_500_000,
    String(sumAmountCents(payments)),
  );
  check(
    "both receipt identities are used by the allocations",
    new Set(payments.map((payment) => payment.receiptId)).size === 2,
  );
  check(
    "every allocation row matches its receipt identity and payment status",
    payments.every((payment) =>
      payment.receiptId === payment.receipt.id && payment.receiptNo === payment.receipt.number &&
        payment.entryType === "PAYMENT",
    ),
  );
  check(
    "both receipt headers are issued",
    receiptRows.length === 2 && receiptRows.every((row) => row.status === "ISSUED"),
  );
  check(
    "the final receipt snapshots the fully settled ledger",
    (() => {
      const row = receiptRows.find((receiptRow) => receiptRow.id === rest.receiptId);
      return !!row && toCents(row.totalFees) === 1_500_000 &&
        toCents(row.paidToDate) === 1_500_000 && toCents(row.balance) === 0;
    })(),
  );

  console.log("\n5b. Exact-cent allocation regressions");
  const planInvoice = (
    id: string,
    outstandingCents: number,
    dueAt: string,
    status = "OPEN",
  ) => ({
    id,
    invoiceNumber: `INV/${id}`,
    status,
    dueAt,
    createdAt: "2027-01-01T00:00:00Z",
    outstandingCents,
  });
  const centsInvoices = [
    planInvoice("three-cents", 3, "2027-01-01"),
    planInvoice("one-cent", 1, "2027-02-01"),
  ];
  const fourCents = planPaymentAllocation(centsInvoices, 4);
  check(
    "0.04 allocates exactly across 0.03 and 0.01",
    fourCents.ok && fourCents.appliedCents === 4 &&
      fourCents.allocations.map((row) => row.amountCents).join(",") === "3,1",
    JSON.stringify(fourCents),
  );
  const rejectsAmount = (raw: string) => {
    try {
      parsePaymentAmount(raw);
      return false;
    } catch {
      return true;
    }
  };
  check("0.004 is rejected rather than rounded", rejectsAmount("0.004"));
  check("0.006 is rejected rather than rounded", rejectsAmount("0.006"));
  check("fee-plan amounts also reject fractional cents", (() => {
    try { parseFeeAmount("0.004"); return false; } catch { return true; }
  })());
  check("a zero fee period stays exact while the plan total is validated separately", parseFeeAmount("0") === 0);
  check("0.04 remains exactly four cents", parsePaymentAmount("0.04") === 4 && fromCents(4) === "0.04");
  const overpay = planPaymentAllocation([planInvoice("three-cents", 3, "2027-01-01")], 4);
  check("one cent above the debt is an overpay", !overpay.ok && overpay.reason === "overpay", JSON.stringify(overpay));

  const leadInvoices = [
    planInvoice("oldest", 3, "2027-01-01"),
    planInvoice("selected", 2, "2027-02-01"),
  ];
  const leadFirst = planPaymentAllocation(leadInvoices, 5, { leadInvoiceId: "selected" });
  check(
    "a selected lead invoice is allocated first",
    leadFirst.ok && leadFirst.allocations[0]?.invoiceId === "selected" &&
      leadFirst.allocations[0]?.amountCents === 2,
    JSON.stringify(leadFirst),
  );
  const settledLead = planPaymentAllocation(
    [planInvoice("oldest", 3, "2027-01-01"), planInvoice("settled", 0, "2027-02-01", "PAID")],
    1,
    { leadInvoiceId: "settled" },
  );
  check("a settled lead invoice conflicts", !settledLead.ok && settledLead.reason === "conflict", JSON.stringify(settledLead));
  const missingLead = planPaymentAllocation(leadInvoices, 1, { leadInvoiceId: "missing" });
  check("a missing lead invoice conflicts", !missingLead.ok && missingLead.reason === "conflict", JSON.stringify(missingLead));

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

  console.log("\n7. Semester bills follow the student's own intake, not the calendar");
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
    include: { period: true, lines: true },
  });
  // A semester plan is dated from the student's intake. Period 1 opens on day one of their
  // intake and every later period follows it, whatever the shared calendar is doing then.
  check("six bills were written", bInvoices.length === 6, `got ${bInvoices.length}`);
  check(
    "the first bill opens on the student's intake date",
    sameDay(bInvoices[0]?.dueAt, bStart),
    bInvoices[0]?.dueAt?.toDateString(),
  );
  check(
    "each bill is one academic period after the last",
    bInvoices.every((invoice, index) => {
      const expected = addMonths(bStart, Math.round((index / 3) * 12));
      return sameDay(invoice.dueAt, expected);
    }),
  );
  check(
    "the academic period is the student's own, counted from their intake",
    bInvoices[0]?.periodYear === 1 &&
      bInvoices[0]?.periodSemester === 1 &&
      bInvoices[3]?.periodYear === 2 &&
      bInvoices[3]?.periodSemester === 1 &&
      bInvoices[5]?.periodYear === 2 &&
      bInvoices[5]?.periodSemester === 3,
  );

  console.log("\n7b. Fees start at the level the student joined, not at Year 1");
  // A student placed at Year 2 of a three-semester-year programme: the earlier periods were
  // studied (and paid for) elsewhere, so this college bills only from Year 2 onward.
  const later = await enrol("d", semesterProgram.id, `FD/${tag}`);
  const laterGenerated = await prisma.$transaction((tx) =>
    generateFeeSchedule(tx, {
      studentId: later.studentId,
      enrollmentId: later.enrollmentId,
      campusId: campus.id,
      programId: semesterProgram.id,
      startDate: day("2027-01-10"),
      from: { yearIndex: 2, semesterNo: 1 },
      numbers: numbersFor("D", 6),
    }),
  );
  const laterInvoices = await prisma.invoice.findMany({
    where: { enrollmentId: later.enrollmentId },
    orderBy: { feePeriod: { sequence: "asc" } },
    include: { lines: true },
  });
  check(
    "no bill is raised for periods before the student joined",
    laterInvoices.every((invoice) => (invoice.periodYear ?? 1) >= 2),
    laterInvoices.map((i) => `Y${i.periodYear}S${i.periodSemester}`).join(","),
  );
  check("billing begins at the placement, not at Year 1", laterGenerated.created === 3, `created ${laterGenerated.created}`);
  check(
    "the first bill is for the level they joined at",
    laterInvoices[0]?.periodYear === 2 && laterInvoices[0]?.periodSemester === 1,
  );

  // These bills belong to a scenario, not to the running totals section 9 reconciles.

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
    where: {
      campusId: campus.id,
      enrollmentId: { in: [a.enrollmentId, b.enrollmentId, c.enrollmentId] },
      status: { not: "VOID" },
    },
    include: { lines: true, payments: true },
  });
  const expected = finance.reduce((sum, invoice) => sum + sumAmounts(invoice.lines), 0);
  const collected = finance.reduce((sum, invoice) => sum + sumAmounts(invoice.payments), 0);
  check("expected fees are 99,000", expected === 99000, String(expected));
  check("collected fees are 15,000", collected === 15000, String(collected));
  check("outstanding is 84,000", expected - collected === 84000, String(expected - collected));

  console.log("\n10. Receipt concurrency, idempotency, and provider-reference regressions");
  const manualInvoice = async (studentId: string, label: string, amountCents: number) =>
    prisma.invoice.create({
      data: {
        number: `FT/${tag}/${label}`,
        studentId,
        campusId: campus.id,
        status: "OPEN",
        lines: { create: { label, amount: fromCents(amountCents) } },
      },
      select: { id: true },
    });

  const concurrent = await enrol("concurrent", monthlyProgram.id, `FA/${tag}/CONCURRENT`);
  const concurrentInvoice = await manualInvoice(concurrent.studentId, "CONCURRENT", 100);
  const concurrentAttempts = await Promise.allSettled(
    [1, 2].map((attempt) =>
      prisma.$transaction((tx) =>
        recordReceipt(tx, {
          studentId: concurrent.studentId,
          campusId: campus.id,
          amountCents: 60,
          method: PaymentMethod.BANK,
          reference: `CONCURRENT-${tag}-${attempt}`,
          paidAt: new Date("2027-02-01T09:00:00Z"),
          actor: concurrent.actor,
          idempotencyKey: `${tag}:concurrent:${attempt}`,
          allocation: "STUDENT",
        }),
      ),
    ),
  );
  const concurrentSuccesses = concurrentAttempts.filter((attempt) => attempt.status === "fulfilled");
  const concurrentFailure = concurrentAttempts.find((attempt) => attempt.status === "rejected");
  check(
    "two concurrent 60-cent allocations against 100 cents commit only once",
    concurrentSuccesses.length === 1 && concurrentFailure?.status === "rejected" &&
      concurrentFailure.reason instanceof FinanceError && concurrentFailure.reason.code === "overpay",
    concurrentAttempts.map((attempt) => attempt.status).join(","),
  );
  const concurrentAfter = await prisma.invoice.findUniqueOrThrow({
    where: { id: concurrentInvoice.id },
    include: { lines: true, payments: true },
  });
  const concurrentReceipts = await prisma.receipt.findMany({ where: { studentId: concurrent.studentId } });
  check(
    "the losing concurrent transaction left no extra receipt or payment",
    concurrentReceipts.length === 1 && sumAmountCents(concurrentAfter.payments) === 60,
    `${concurrentReceipts.length} receipts, ${sumAmountCents(concurrentAfter.payments)} cents paid`,
  );
  check(
    "the concurrent invoice remains part paid without exceeding its debt",
    concurrentAfter.status === "PARTIAL" && sumAmountCents(concurrentAfter.payments) === 60,
    `${concurrentAfter.status}, ${sumAmountCents(concurrentAfter.payments)} cents`,
  );
  check(
    "the concurrent receipt snapshots exact totals",
    concurrentReceipts.length === 1 && toCents(concurrentReceipts[0].totalFees) === 100 &&
      toCents(concurrentReceipts[0].paidToDate) === 60 && toCents(concurrentReceipts[0].balance) === 40 &&
      concurrentReceipts[0].status === "ISSUED",
  );

  const idempotent = await enrol("idempotent", monthlyProgram.id, `FA/${tag}/IDEMPOTENT`);
  const idempotentInvoice = await manualInvoice(idempotent.studentId, "IDEMPOTENT", 200);
  const idempotentInput = {
    studentId: idempotent.studentId,
    campusId: campus.id,
    amountCents: 60,
    method: PaymentMethod.BANK,
    reference: `IDEMPOTENT-${tag}`,
    paidAt: new Date("2027-02-02T09:00:00Z"),
    actor: idempotent.actor,
    idempotencyKey: `${tag}:same-submission`,
    allocation: "STUDENT" as const,
  };
  const firstSubmission = await prisma.$transaction((tx) => recordReceipt(tx, idempotentInput));
  const repeatedSubmission = await prisma.$transaction((tx) => recordReceipt(tx, idempotentInput));
  check(
    "the same idempotency key returns the same receipt",
    repeatedSubmission.receiptId === firstSubmission.receiptId &&
      repeatedSubmission.receiptNo === firstSubmission.receiptNo,
  );
  check(
    "the same idempotency key creates one receipt",
    (await prisma.receipt.count({ where: { idempotencyKey: idempotentInput.idempotencyKey } })) === 1,
  );
  const idempotentAfter = await prisma.invoice.findUniqueOrThrow({
    where: { id: idempotentInvoice.id },
    include: { payments: true },
  });
  check(
    "an idempotent replay does not duplicate the payment",
    idempotentAfter.status === "PARTIAL" && sumAmountCents(idempotentAfter.payments) === 60,
    `${idempotentAfter.status}, ${sumAmountCents(idempotentAfter.payments)} cents`,
  );

  check(
    "an allocation changed after review is rejected before writing",
    await (async () => {
      const invoice = await manualInvoice(idempotent.studentId, "STALE-PLAN", 100);
      const before = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { lines: true, payments: true } });
      const expected = planPaymentAllocation([
        {
          id: invoice.id,
          invoiceNumber: before.number,
          status: before.status,
          dueAt: before.dueAt,
          createdAt: before.createdAt,
          outstandingCents: invoicePosition(before.lines, before.payments).outstandingCents,
        },
      ], 60, { leadInvoiceId: invoice.id });
      if (!expected.ok) return false;
      const fingerprint = JSON.stringify(expected.allocations.map((row) => ({
        invoiceId: row.invoiceId,
        amountCents: row.amountCents,
        balanceBeforeCents: row.balanceBeforeCents + 1,
        balanceAfterCents: row.balanceAfterCents + 1,
      })));
      let error: unknown = null;
      try {
        await prisma.$transaction((tx) => recordReceipt(tx, {
          studentId: idempotent.studentId,
          campusId: campus.id,
          amountCents: 60,
          method: PaymentMethod.BANK,
          reference: `STALE-${tag}`,
          paidAt: new Date("2027-02-04T09:00:00Z"),
          actor: idempotent.actor,
          idempotencyKey: `${tag}:stale-plan`,
          allocation: "STUDENT",
          invoiceId: invoice.id,
          expectedAllocationFingerprint: fingerprint,
        }));
      } catch (cause) {
        error = cause;
      }
      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { payments: true } });
      return error instanceof FinanceError && error.message.includes("changed after review") &&
        after.payments.length === 0 && (await prisma.receipt.count({ where: { idempotencyKey: `${tag}:stale-plan` } })) === 0;
    })(),
  );

  const mpesaReference = `M-PESA ${tag} ABC 123`;
  const normalizedMpesa = mpesaReference.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const mpesaReceipt = await prisma.$transaction((tx) =>
    recordReceipt(tx, {
      studentId: idempotent.studentId,
      campusId: campus.id,
      amountCents: 10,
      method: PaymentMethod.MPESA,
      reference: mpesaReference,
      paidAt: new Date("2027-02-03T09:00:00Z"),
      actor: idempotent.actor,
      idempotencyKey: `${tag}:mpesa:first`,
      allocation: "STUDENT",
    }),
  );
  let duplicateMpesa: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      recordReceipt(tx, {
        studentId: idempotent.studentId,
        campusId: campus.id,
        amountCents: 10,
        method: PaymentMethod.MPESA,
        reference: mpesaReference.toLowerCase().replace(/-/g, "/"),
        paidAt: new Date("2027-02-03T10:00:00Z"),
        actor: idempotent.actor,
        idempotencyKey: `${tag}:mpesa:duplicate`,
        allocation: "STUDENT",
      }),
    );
  } catch (error) {
    duplicateMpesa = error;
  }
  check(
    "a duplicate normalized M-Pesa reference is rejected",
    duplicateMpesa instanceof FinanceError && duplicateMpesa.code === "duplicate",
    duplicateMpesa instanceof Error ? duplicateMpesa.message : String(duplicateMpesa),
  );
  const mpesaRows = await prisma.receipt.findMany({
    where: { studentId: idempotent.studentId, method: PaymentMethod.MPESA },
  });
  const mpesaHeader = mpesaRows.find((row) => row.id === mpesaReceipt.receiptId);
  const idempotentFinal = await prisma.invoice.findUniqueOrThrow({
    where: { id: idempotentInvoice.id },
    include: { payments: true },
  });
  check(
    "the normalized M-Pesa reference is stored once",
    mpesaRows.length === 1 && mpesaHeader?.providerReferenceNormalized === normalizedMpesa,
    mpesaHeader?.providerReferenceNormalized ?? undefined,
  );
  check(
    "the rejected M-Pesa duplicate left the ledger unchanged",
    idempotentFinal.status === "PARTIAL" && sumAmountCents(idempotentFinal.payments) === 70,
    `${idempotentFinal.status}, ${sumAmountCents(idempotentFinal.payments)} cents`,
  );
  check(
    "the M-Pesa receipt snapshots the post-payment ledger",
    !!mpesaHeader && toCents(mpesaHeader.totalFees) === 300 &&
      toCents(mpesaHeader.paidToDate) === 70 && toCents(mpesaHeader.balance) === 230,
  );

  console.log("\n11. Receipt and invoice correction workflows");
  const paidCorrectionFixture = async (label: string, amountCents: number) => {
    const student = await enrol(label, monthlyProgram.id, `FA/${tag}/${label.toUpperCase()}`);
    const invoice = await manualInvoice(student.studentId, label.toUpperCase(), amountCents);
    const receipt = await prisma.$transaction((tx) =>
      recordReceipt(tx, {
        studentId: student.studentId,
        campusId: campus.id,
        amountCents,
        method: PaymentMethod.BANK,
        reference: `PAY-${tag}-${label}`,
        paidAt: new Date("2027-03-01T09:00:00Z"),
        actor: student.actor,
        idempotencyKey: `${tag}:payment:${label}`,
        allocation: "STUDENT",
      }),
    );
    const payment = await prisma.payment.findFirstOrThrow({
      where: { receiptId: receipt.receiptId, invoiceId: invoice.id, entryType: "PAYMENT" },
    });
    return { student, invoice, receipt, payment };
  };
  const isForeignKeyViolation = (error: unknown) => {
    if (!error || typeof error !== "object" || !("code" in error)) return false;
    return (error as { code?: unknown }).code === "P2003";
  };
  const auditHasReason = (detail: string | null | undefined, reason: string) => {
    if (!detail) return false;
    try {
      return (JSON.parse(detail) as { reason?: unknown }).reason === reason;
    } catch {
      return false;
    }
  };

  const reversal = await paidCorrectionFixture("correction", 10_000);
  let paidVoidError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      voidInvoiceWithReason(tx, {
        invoiceId: reversal.invoice.id,
        reason: "Must not void paid money",
        actor: reversal.student.actor,
      }),
    );
  } catch (error) {
    paidVoidError = error;
  }
  const paidBeforeReversal = await prisma.invoice.findUniqueOrThrow({
    where: { id: reversal.invoice.id },
    include: { lines: true, payments: true },
  });
  check(
    "a paid invoice cannot be voided while net money remains",
    paidVoidError instanceof FinanceError && paidVoidError.code === "conflict",
    paidVoidError instanceof Error ? paidVoidError.message : String(paidVoidError),
  );
  check(
    "the refused void leaves the paid invoice and its money unchanged",
    paidBeforeReversal.status === "PAID" && sumAmountCents(paidBeforeReversal.payments) === 10_000 &&
      paidBeforeReversal.lines.every((line) => line.kind === "CHARGE") &&
      (await prisma.auditLog.count({ where: { action: "invoice.void", entityId: reversal.invoice.id } })) === 0,
  );

  const reversalReason = "Duplicate bank posting";
  const reversalEffectiveAt = new Date("2027-03-02T09:00:00Z");
  const reversalKey = `${tag}:correction:reversal`;
  const reversalResult = await prisma.$transaction((tx) =>
    correctReceipt(tx, {
      receiptId: reversal.receipt.receiptId,
      kind: "REVERSAL",
      reason: reversalReason,
      effectiveAt: reversalEffectiveAt,
      reference: null,
      actor: reversal.student.actor,
      idempotencyKey: reversalKey,
    }),
  );
  check("the whole receipt reverses by exact cents", reversalResult.amountCents === 10_000, JSON.stringify(reversalResult));
  const afterReversal = await prisma.invoice.findUniqueOrThrow({
    where: { id: reversal.invoice.id },
    include: { lines: true, payments: true },
  });
  const originalAfterReversal = afterReversal.payments.find((payment) => payment.id === reversal.payment.id);
  const reversalPayment = afterReversal.payments.find((payment) => payment.entryType === "REVERSAL");
  const reversalCredit = await prisma.receipt.findUniqueOrThrow({ where: { number: reversalResult.creditNoteNo } });
  const reversedOriginal = await prisma.receipt.findUniqueOrThrow({ where: { id: reversal.receipt.receiptId } });
  check(
    "reversal appends a linked negative payment without rewriting the original",
    !!originalAfterReversal && originalAfterReversal.entryType === "PAYMENT" &&
      toCents(originalAfterReversal.amount) === 10_000 && originalAfterReversal.reversesPaymentId === null &&
      !!reversalPayment && toCents(reversalPayment.amount) === -10_000 &&
      reversalPayment.reversesPaymentId === reversal.payment.id && reversalPayment.receiptId === reversalCredit.id,
  );
  check(
    "the reversed invoice reopens with zero net money",
    afterReversal.status === "OPEN" && sumAmountCents(afterReversal.lines) === 10_000 &&
      sumAmountCents(afterReversal.payments) === 0,
  );
  check(
    "the linked credit receipt is negative and snapshots the reopened ledger",
    reversalCredit.kind === "CREDIT_NOTE" && toCents(reversalCredit.amount) === -10_000 &&
      reversalCredit.status === "ISSUED" && toCents(reversalCredit.totalFees) === 10_000 &&
      toCents(reversalCredit.paidToDate) === 0 && toCents(reversalCredit.balance) === 10_000,
  );
  check(
    "the original receipt is marked reversed and audited",
    reversedOriginal.status === "REVERSED" && reversedOriginal.reversedAt?.getTime() === reversalEffectiveAt.getTime() &&
      (await prisma.auditLog.count({
        where: { action: "receipt.reversal", entityId: reversal.receipt.receiptId },
      })) === 1,
  );

  let duplicateReversalError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      correctReceipt(tx, {
        receiptId: reversal.receipt.receiptId,
        kind: "REVERSAL",
        reason: "Second reversal attempt",
        effectiveAt: new Date("2027-03-03T09:00:00Z"),
        reference: null,
        actor: reversal.student.actor,
        idempotencyKey: `${tag}:correction:reversal:duplicate`,
      }),
    );
  } catch (error) {
    duplicateReversalError = error;
  }
  let alteredReversalReplayError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      correctReceipt(tx, {
        receiptId: reversal.receipt.receiptId,
        kind: "REVERSAL",
        reason: "Altered replay",
        effectiveAt: reversalEffectiveAt,
        reference: null,
        actor: reversal.student.actor,
        idempotencyKey: reversalKey,
      }),
    );
  } catch (error) {
    alteredReversalReplayError = error;
  }
  check(
    "a duplicate reversal and an altered idempotent replay are rejected",
    duplicateReversalError instanceof FinanceError && duplicateReversalError.code === "conflict" &&
      alteredReversalReplayError instanceof FinanceError && alteredReversalReplayError.code === "conflict",
  );
  check(
    "rejected reversal duplicates append no money or documents",
    (await prisma.payment.count({ where: { invoiceId: reversal.invoice.id } })) === 2 &&
      (await prisma.receipt.count({ where: { studentId: reversal.student.studentId } })) === 2,
  );

  const voidReason = "Invoice raised in error";
  await prisma.$transaction((tx) =>
    voidInvoiceWithReason(tx, { invoiceId: reversal.invoice.id, reason: voidReason, actor: reversal.student.actor }),
  );
  const voided = await prisma.invoice.findUniqueOrThrow({
    where: { id: reversal.invoice.id },
    include: { lines: true, payments: true },
  });
  const voidContra = voided.lines.find((line) => line.kind === "VOID");
  const voidAudit = await prisma.auditLog.findFirst({
    where: { action: "invoice.void", entityId: reversal.invoice.id },
  });
  check(
    "voiding a reversed invoice appends a VOID contra and records the reason",
    voided.status === "VOID" && voided.voidReason === voidReason && voided.voidedFromStatus === "OPEN" &&
      !!voidContra && toCents(voidContra.amount) === -10_000 && sumAmountCents(voided.lines) === 0 &&
      auditHasReason(voidAudit?.detail, voidReason),
  );

  const unvoidReason = "Restore invoice after review";
  await prisma.$transaction((tx) =>
    unvoidInvoice(tx, { invoiceId: reversal.invoice.id, reason: unvoidReason, actor: reversal.student.actor }),
  );
  const restored = await prisma.invoice.findUniqueOrThrow({
    where: { id: reversal.invoice.id },
    include: { lines: true, payments: true },
  });
  const voidReversal = restored.lines.find((line) => line.kind === "VOID_REVERSAL");
  const restoredPosition = invoicePosition(restored.lines, restored.payments);
  const unvoidAudit = await prisma.auditLog.findFirst({
    where: { action: "invoice.unvoid", entityId: reversal.invoice.id },
  });
  check(
    "unvoid appends VOID_REVERSAL and restores the exact balance and status",
    !!voidReversal && toCents(voidReversal.amount) === 10_000 && restored.status === "OPEN" &&
      restored.voidedAt === null && restored.voidReason === null &&
      restoredPosition.billedCents === 10_000 && restoredPosition.paidCents === 0 &&
      restoredPosition.balanceCents === 10_000 && auditHasReason(unvoidAudit?.detail, unvoidReason),
  );

  let invoiceDeleteError: unknown = null;
  try {
    await prisma.invoice.delete({ where: { id: reversal.invoice.id } });
  } catch (error) {
    invoiceDeleteError = error;
  }
  check(
    "restrictive foreign keys reject deleting an invoice with lines and payments",
    isForeignKeyViolation(invoiceDeleteError) &&
      (await prisma.invoice.count({ where: { id: reversal.invoice.id } })) === 1,
    invoiceDeleteError instanceof Error ? invoiceDeleteError.message : String(invoiceDeleteError),
  );

  const generatedInvoice = aInvoices[0];
  const provenanceDeletes: Array<[string, () => Promise<unknown>]> = [
    ["enrolment", () => prisma.enrollment.delete({ where: { id: generatedInvoice.enrollmentId! } })],
    ["fee plan", () => prisma.programFeePlan.delete({ where: { id: generatedInvoice.feePlanId! } })],
    ["fee period", () => prisma.feeItem.delete({ where: { id: generatedInvoice.feePeriodId! } })],
  ];
  for (const [label, remove] of provenanceDeletes) {
    let error: unknown = null;
    try { await remove(); } catch (cause) { error = cause; }
    check(
      `billing provenance rejects deleting the ${label} while an invoice exists`,
      isForeignKeyViolation(error) && (await prisma.invoice.count({ where: { id: generatedInvoice.id } })) === 1,
      error instanceof Error ? error.message : String(error),
    );
  }

  const credit = await paidCorrectionFixture("credit", 10_000);
  const creditBefore = await prisma.invoice.findUniqueOrThrow({
    where: { id: credit.invoice.id },
    include: { payments: true },
  });
  check(
    "the credit-note fixture starts fully paid",
    creditBefore.status === "PAID" && sumAmountCents(creditBefore.payments) === 10_000,
  );
  const creditReason = "Bursary adjustment";
  const creditEffectiveAt = new Date("2027-03-04T09:00:00Z");
  const creditKey = `${tag}:credit:posted`;
  const creditResult = await prisma.$transaction((tx) =>
    creditInvoice(tx, {
      invoiceId: credit.invoice.id,
      amountCents: 4_000,
      reason: creditReason,
      effectiveAt: creditEffectiveAt,
      actor: credit.student.actor,
      idempotencyKey: creditKey,
    }),
  );
  const credited = await prisma.invoice.findUniqueOrThrow({
    where: { id: credit.invoice.id },
    include: { lines: true, payments: true },
  });
  const creditLine = credited.lines.find((line) => line.kind === "CREDIT_NOTE");
  const creditHeader = await prisma.receipt.findUniqueOrThrow({ where: { number: creditResult.creditNoteNo } });
  check(
    "the credit line and its document share one sequence identity",
    creditHeader.number === creditLine?.reference,
  );
  const creditedPosition = invoicePosition(credited.lines, credited.payments);
  const creditAudit = await prisma.auditLog.findFirst({
    where: { action: "invoice.credit_note", entityId: creditLine?.id },
  });
  check(
    "a credit note appends a negative CREDIT_NOTE line and creates credit due",
    !!creditLine && toCents(creditLine.amount) === -4_000 && creditLine.reference === creditResult.creditNoteNo &&
      creditLine.reason === creditReason && credited.status === "CREDIT" &&
      creditedPosition.billedCents === 6_000 && creditedPosition.paidCents === 10_000 &&
      creditedPosition.balanceCents === -4_000 && creditedPosition.creditCents === 4_000,
  );
  check(
    "the credit receipt is linked to its source invoice and snapshots the credit",
    creditHeader.kind === "CREDIT_NOTE" && toCents(creditHeader.amount) === -4_000 &&
      creditHeader.sourceInvoiceId === credit.invoice.id && creditHeader.status === "ISSUED" &&
      toCents(creditHeader.totalFees) === 6_000 && toCents(creditHeader.paidToDate) === 10_000 &&
      toCents(creditHeader.balance) === -4_000 && auditHasReason(creditAudit?.detail, creditReason),
  );

  let overCreditError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      creditInvoice(tx, {
        invoiceId: credit.invoice.id,
        amountCents: 6_001,
        reason: "One cent too much",
        effectiveAt: new Date("2027-03-05T09:00:00Z"),
        actor: credit.student.actor,
        idempotencyKey: `${tag}:credit:overpay`,
      }),
    );
  } catch (error) {
    overCreditError = error;
  }
  const afterRejectedCredit = await prisma.invoice.findUniqueOrThrow({
    where: { id: credit.invoice.id },
    include: { lines: true, payments: true },
  });
  const afterRejectedCreditPosition = invoicePosition(afterRejectedCredit.lines, afterRejectedCredit.payments);
  check(
    "a credit note exceeding the current billed total is rejected",
    overCreditError instanceof FinanceError && overCreditError.code === "overpay",
    overCreditError instanceof Error ? overCreditError.message : String(overCreditError),
  );
  check(
    "the rejected credit leaves lines, receipts, and the exact credit balance unchanged",
    afterRejectedCredit.lines.length === 2 && afterRejectedCredit.payments.length === 1 &&
      (await prisma.receipt.count({ where: { studentId: credit.student.studentId } })) === 2 &&
      afterRejectedCreditPosition.billedCents === 6_000 && afterRejectedCreditPosition.balanceCents === -4_000,
  );

  const refund = await paidCorrectionFixture("refund", 5_000);
  const refundReference = `REFUND-${tag}`;
  const refundReason = "Student withdrew before classes";
  const refundEffectiveAt = new Date("2027-03-06T09:00:00Z");
  let missingRefundReferenceError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      correctReceipt(tx, {
        receiptId: refund.receipt.receiptId,
        kind: "REFUND",
        reason: refundReason,
        effectiveAt: refundEffectiveAt,
        reference: null,
        actor: refund.student.actor,
        idempotencyKey: `${tag}:refund:missing-reference`,
      }),
    );
  } catch (error) {
    missingRefundReferenceError = error;
  }
  const beforeRefund = await prisma.receipt.findUniqueOrThrow({ where: { id: refund.receipt.receiptId } });
  check(
    "a refund requires a reference and leaves the original receipt untouched when missing",
    missingRefundReferenceError instanceof FinanceError && missingRefundReferenceError.code === "invalid" &&
      beforeRefund.status === "ISSUED" && beforeRefund.refundedAt === null &&
      (await prisma.payment.count({ where: { invoiceId: refund.invoice.id } })) === 1,
  );

  const refundKey = `${tag}:refund:posted`;
  const refundResult = await prisma.$transaction((tx) =>
    correctReceipt(tx, {
      receiptId: refund.receipt.receiptId,
      kind: "REFUND",
      reason: refundReason,
      effectiveAt: refundEffectiveAt,
      reference: refundReference,
      actor: refund.student.actor,
      idempotencyKey: refundKey,
    }),
  );
  const refunded = await prisma.invoice.findUniqueOrThrow({
    where: { id: refund.invoice.id },
    include: { lines: true, payments: true },
  });
  const refundPayment = refunded.payments.find((payment) => payment.entryType === "REFUND");
  const refundHeader = await prisma.receipt.findUniqueOrThrow({ where: { number: refundResult.creditNoteNo } });
  const refundedOriginal = await prisma.receipt.findUniqueOrThrow({ where: { id: refund.receipt.receiptId } });
  check(
    "a refund appends a linked negative payment and reopens the invoice",
    !!refundPayment && toCents(refundPayment.amount) === -5_000 &&
      refundPayment.reversesPaymentId === refund.payment.id && refundPayment.receiptId === refundHeader.id &&
      refunded.status === "OPEN" && sumAmountCents(refunded.payments) === 0,
  );
  check(
    "the original receipt is marked REFUNDED and the credit receipt keeps the refund reference",
    refundedOriginal.status === "REFUNDED" && refundedOriginal.refundedAt?.getTime() === refundEffectiveAt.getTime() &&
      refundedOriginal.reason === refundReason && refundHeader.kind === "CREDIT_NOTE" &&
      refundHeader.status === "ISSUED" && toCents(refundHeader.amount) === -5_000 &&
      refundHeader.reference === refundReference &&
      toCents(refundHeader.totalFees) === 5_000 && toCents(refundHeader.paidToDate) === 0 &&
      toCents(refundHeader.balance) === 5_000,
  );
  check(
    "the refund is audited",
    (await prisma.auditLog.count({
      where: { action: "receipt.refund", entityId: refund.receipt.receiptId },
    })) === 1,
  );

  let duplicateRefundError: unknown = null;
  try {
    await prisma.$transaction((tx) =>
      correctReceipt(tx, {
        receiptId: refund.receipt.receiptId,
        kind: "REFUND",
        reason: "Second refund attempt",
        effectiveAt: new Date("2027-03-07T09:00:00Z"),
        reference: `DUPLICATE-${tag}`,
        actor: refund.student.actor,
        idempotencyKey: `${tag}:refund:duplicate`,
      }),
    );
  } catch (error) {
    duplicateRefundError = error;
  }
  check(
    "a duplicate refund correction is rejected",
    duplicateRefundError instanceof FinanceError && duplicateRefundError.code === "conflict",
    duplicateRefundError instanceof Error ? duplicateRefundError.message : String(duplicateRefundError),
  );
  check(
    "the rejected refund duplicate appends no money or documents",
    (await prisma.payment.count({ where: { invoiceId: refund.invoice.id } })) === 2 &&
      (await prisma.receipt.count({ where: { studentId: refund.student.studentId } })) === 2,
  );

  // --- cleanup -------------------------------------------------------------------
  // The campus is a fixture created by this run, so every financial row under it is ours.
  // Restrictive foreign keys require children to be removed before their headers.
  const fixtureInvoices = await prisma.invoice.findMany({
    where: { campusId: campus.id },
    select: { id: true, studentId: true },
  });
  const invoiceIds = fixtureInvoices.map((invoice) => invoice.id);
  const fixtureStudents = await prisma.studentProfile.findMany({
    where: { campusId: campus.id },
    select: { id: true },
  });
  const studentIds = fixtureStudents.map((student) => student.id);
  const fixtureReceipts = await prisma.receipt.findMany({
    where: {
      OR: [
        { campusId: campus.id },
        { studentId: { in: studentIds } },
      ],
    },
    select: { id: true },
  });
  const receiptIds = fixtureReceipts.map((receipt) => receipt.id);
  const fixturePaymentWhere = {
    OR: [
      { invoiceId: { in: invoiceIds } },
      { studentId: { in: studentIds } },
      { receiptId: { in: receiptIds } },
    ],
  };
  // Reversal/refund rows reference their original payment, so remove those children first.
  const deletedCorrections = await prisma.payment.deleteMany({
    where: { ...fixturePaymentWhere, reversesPaymentId: { not: null } },
  });
  const deletedPayments = await prisma.payment.deleteMany({ where: fixturePaymentWhere });
  check(
    "payment rows are removable during fixture cleanup",
    deletedCorrections.count + deletedPayments.count > 0,
    `deleted ${deletedCorrections.count + deletedPayments.count}`,
  );
  await prisma.receipt.deleteMany({ where: { id: { in: receiptIds } } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
  await prisma.auditLog.deleteMany({ where: { campusId: campus.id } });
  await prisma.studentUnit.deleteMany({ where: { enrollment: { campusId: campus.id } } });
  await prisma.enrollment.deleteMany({ where: { campusId: campus.id } });
  await prisma.studentProfile.deleteMany({ where: { campusId: campus.id } });
  await prisma.user.deleteMany({ where: { campusId: campus.id } });
  await prisma.feeItem.deleteMany({ where: { programId: { in: [monthlyProgram.id, semesterProgram.id] } } });
  await prisma.programFeePlan.deleteMany({
    where: { programId: { in: [monthlyProgram.id, semesterProgram.id] } },
  });
  await prisma.program.deleteMany({ where: { id: { in: [monthlyProgram.id, semesterProgram.id] } } });
  await prisma.academicPeriod.deleteMany({ where: { id: { in: periodIdsForCleanup } } });
  await prisma.campus.deleteMany({ where: { id: campus.id } });
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
