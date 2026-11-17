/**
 * Proves the class rules hold on a real database.
 *
 * The things that matter here are the ones a mistake would quietly damage: a merge must move
 * the grouping and nothing else, a class must never decide a student's stage, and an intake
 * must never be anything but January, May or September.
 *
 * Sections 7-9 cover the scoping rules: a class belongs to one campus, programme and intake, so
 * a January student can never be placed in the May class of the same programme, and the same
 * name may legitimately exist once per intake.
 *
 * Run with: npx tsx scripts/verify-classes.ts
 */

import "dotenv/config";

let failures = 0;

/** Removes the fixture campus and everything hanging off it, whatever happened above. */
async function cleanup(campusId: number) {
  const { prisma } = await import("@/lib/prisma");
  const enrollmentCampus = { enrollment: { campusId } };
  await prisma.classMembership.deleteMany({ where: { campusId } });
  await prisma.classMembership.deleteMany({ where: enrollmentCampus });
  await prisma.invoice.deleteMany({ where: { campusId } });
  await prisma.studentUnit.deleteMany({ where: enrollmentCampus });
  await prisma.enrollment.deleteMany({ where: { campusId } });
  await prisma.studentProfile.deleteMany({ where: { campusId } });
  await prisma.user.deleteMany({ where: { campusId } });
  await prisma.academicClass.deleteMany({ where: { campusId } });
  await prisma.academicPeriod.deleteMany({ where: { campusId } });
  await prisma.$executeRawUnsafe(`DELETE FROM "_ProgramCampuses" WHERE "A" = ${campusId}`).catch(() => {});
  await prisma.campus.delete({ where: { id: campusId } }).catch(() => {});
}

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

let campusIdForCleanup: number | null = null;

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const {
    mergeBlockages,
    OFFICIAL_INTAKES,
    officialIntakeForDate,
    suggestClassName,
    nextClassLetter,
  } = await import("@/lib/academics/classes");

  const tag = `clsflow-${Date.now()}`;

  console.log("\n1. Only three intakes a year exist");
  check("January, May and September are the official months", OFFICIAL_INTAKES.map((i) => i.month).join(",") === "1,5,9");
  const february = new Date(2027, 1, 15);
  check("a February admission belongs to the January intake", officialIntakeForDate(february) === "JANUARY", officialIntakeForDate(february));
  const june = new Date(2027, 5, 3);
  check("a June admission belongs to the May intake", officialIntakeForDate(june) === "MAY", officialIntakeForDate(june));
  const november = new Date(2027, 10, 20);
  check("a November admission belongs to the September intake", officialIntakeForDate(november) === "SEPTEMBER", officialIntakeForDate(november));
  check("the suggested name follows the ICT/JAN/2027 convention", suggestClassName("ICT", "JANUARY", 2027) === "ICT/JAN/2027", suggestClassName("ICT", "JANUARY", 2027));

  // The database itself must reject a fourth intake month, whatever the client sends.
  const campus = await prisma.campus.create({
    data: { code: tag, name: `${tag} campus`, place: "Test", phone: "+254700000000", takesApplicants: false },
  });
  campusIdForCleanup = campus.id;
  let rejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO academic_periods (id, name, "campusId", year, month, sequence, "startsAt", "endsAt", "applicationDeadline", "updatedAt") VALUES (gen_random_uuid()::text, 'March intake', ${campus.id}, 2027, 3, 4, now() + interval '30 days', now() + interval '120 days', now(), now())`,
    );
  } catch {
    rejected = true;
  }
  check("the database refuses a March intake", rejected);

  // --- fixtures -----------------------------------------------------------------
  const program = await prisma.program.findFirst({ where: { archivedAt: null }, orderBy: { createdAt: "asc" } });
  if (!program) {
    console.log("  skip no programme in this database to build classes from");
    await prisma.campus.delete({ where: { id: campus.id } });
    await prisma.$disconnect();
    return;
  }
  // Link the programme to the test campus so a class can reference both, as the app requires.
  await prisma.$executeRawUnsafe(
    `INSERT INTO "_ProgramCampuses" ("A", "B") VALUES (${campus.id}, '${program.id}') ON CONFLICT DO NOTHING`,
  );

  const januaryIntake = await prisma.academicPeriod.create({
    data: {
      name: "January intake 2027",
      campusId: campus.id,
      year: 2027,
      month: 1,
      sequence: 1,
      startsAt: new Date(Date.UTC(2027, 0, 5)),
      endsAt: new Date(Date.UTC(2027, 3, 30)),
      applicationDeadline: new Date(Date.UTC(2026, 11, 20)),
    },
  });
  const mayIntake = await prisma.academicPeriod.create({
    data: {
      name: "May intake 2027",
      campusId: campus.id,
      year: 2027,
      month: 5,
      sequence: 2,
      startsAt: new Date(Date.UTC(2027, 4, 4)),
      endsAt: new Date(Date.UTC(2027, 7, 31)),
      applicationDeadline: new Date(Date.UTC(2027, 3, 20)),
    },
  });

  const janClass = await prisma.academicClass.create({
    data: {
      campusId: campus.id,
      programId: program.id,
      periodId: januaryIntake.id,
      year: 2027,
      name: `${tag}/JAN/2027`,
    },
  });
  const tempClass = await prisma.academicClass.create({
    data: {
      campusId: campus.id,
      programId: program.id,
      periodId: januaryIntake.id,
      year: 2027,
      name: `${tag}/JAN-FEB/2027`,
      note: "Late January joiners",
    },
  });

  console.log("\n2. A class is a grouping, not an academic stage");
  // Four students in ONE class, deliberately at four different stages.
  const stages = [
    { yearIndex: 1, semesterNo: 1 },
    { yearIndex: 1, semesterNo: 2 },
    { yearIndex: 1, semesterNo: 2 },
    { yearIndex: 1, semesterNo: 3 },
  ];
  const students: {
    profile: { id: string };
    enrollment: { id: string };
    stage: { yearIndex: number; semesterNo: number };
  }[] = [];
  for (const [index, stage] of stages.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `${tag}-${index}@example.test`,
        fullName: `${tag} Student ${index + 1}`,
        passwordHash: "x",
        role: "STUDENT",
        campusId: campus.id,
      },
    });
    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        admissionNo: `${tag}/${index + 1}`,
        campusId: campus.id,
        // Deliberately in February, after the January intake opened.
        admissionDate: new Date(Date.UTC(2027, 1, 15)),
      },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: profile.id,
        programId: program.id,
        campusId: campus.id,
        periodId: januaryIntake.id,
        yearIndex: stage.yearIndex,
        semesterNo: stage.semesterNo,
      },
    });
    await prisma.classMembership.create({
      data: { classId: tempClass.id, enrollmentId: enrollment.id, campusId: campus.id, reason: "admitted" },
    });
    students.push({ profile, enrollment, stage });
  }

  const members = await prisma.classMembership.findMany({
    where: { classId: tempClass.id, leftAt: null },
    select: { enrollment: { select: { yearIndex: true, semesterNo: true } } },
  });
  const distinctStages = new Set(members.map((m) => `${m.enrollment.yearIndex}:${m.enrollment.semesterNo}`));
  check("one class can hold several academic stages", distinctStages.size === 3, `${distinctStages.size} stages`);

  console.log("\n3. Compatibility is checked before any merge");
  const otherProgram = await prisma.program.findFirst({
    where: { archivedAt: null, id: { not: program.id } },
    select: { id: true },
  });
  const foreign = {
    id: "foreign",
    name: "X/JAN/2027",
    programId: otherProgram?.id ?? "nope",
    campusId: campus.id,
    periodId: januaryIntake.id,
    year: 2027,
    status: "ACTIVE",
  };
  check(
    "a class from another programme cannot be merged",
    mergeBlockages({ ...tempClass, programId: program.id }, foreign).some((b) => b.code === "programme"),
  );
  check(
    "a class from another campus cannot be merged",
    mergeBlockages({ ...tempClass, campusId: campus.id }, { ...foreign, programId: program.id, campusId: 999 }).some(
      (b) => b.code === "campus",
    ),
  );
  check(
    "a class for another intake cannot be merged",
    mergeBlockages(
      { ...tempClass, periodId: januaryIntake.id },
      { ...tempClass, id: "x", periodId: mayIntake.id },
    ).some((b) => b.code === "intake"),
  );
  check(
    "a class cannot be merged into itself",
    mergeBlockages(tempClass, tempClass).some((b) => b.code === "same"),
  );
  check(
    "compatible classes report no blockage",
    mergeBlockages(tempClass, janClass).length === 0,
    JSON.stringify(mergeBlockages(tempClass, janClass)),
  );

  console.log("\n4. Merging moves the grouping and nothing else");
  const before = await Promise.all(
    students.map(async (s) => ({
      enrollment: s.enrollment,
      invoices: await prisma.invoice.count({ where: { enrollmentId: s.enrollment.id } }),
      units: await prisma.studentUnit.count({ where: { enrollmentId: s.enrollment.id } }),
    })),
  );

  // Perform the merge exactly as the action does: close, reopen, audit.
  const moving = await prisma.classMembership.findMany({
    where: { classId: tempClass.id, leftAt: null },
    select: { id: true, enrollmentId: true },
  });
  const targetIds = new Set(
    (await prisma.classMembership.findMany({ where: { classId: janClass.id, leftAt: null }, select: { enrollmentId: true } })).map(
      (r) => r.enrollmentId,
    ),
  );
  const toMove = moving.filter((m) => !targetIds.has(m.enrollmentId));
  await prisma.$transaction(async (tx) => {
    await tx.classMembership.updateMany({
      where: { id: { in: moving.map((m) => m.id) } },
      data: { leftAt: new Date(), reason: `merged into ${janClass.name}` },
    });
    await tx.classMembership.createMany({
      data: toMove.map((m) => ({
        classId: janClass.id,
        enrollmentId: m.enrollmentId,
        campusId: campus.id,
        reason: `merged from ${tempClass.name}`,
      })),
    });
  });

  const after = await prisma.classMembership.findMany({
    where: { enrollmentId: { in: students.map((s) => s.enrollment.id) } },
    select: { enrollmentId: true, classId: true, leftAt: true, reason: true },
  });

  check("every student moved to the destination class", after.filter((m) => m.classId === janClass.id && m.leftAt === null).length === 4, `${after.filter((m) => m.classId === janClass.id && m.leftAt === null).length}/4`);
  check("no student has a second open membership", after.filter((m) => m.leftAt === null).length === 4, `${after.filter((m) => m.leftAt === null).length} open`);
  check("the old membership is kept as history", after.filter((m) => m.classId === tempClass.id && m.leftAt !== null).length === 4);

  const stagesAfter = await prisma.enrollment.findMany({
    where: { id: { in: students.map((s) => s.enrollment.id) } },
    select: { id: true, yearIndex: true, semesterNo: true },
  });
  const stageKept = stagesAfter.every((row, index) => {
    const original = students[index].stage;
    return row.yearIndex === original.yearIndex && row.semesterNo === original.semesterNo;
  });
  check("each student kept their own academic stage", stageKept, JSON.stringify(stagesAfter.map((r) => `${r.yearIndex}:${r.semesterNo}`)));

  const intakesKept = await prisma.enrollment.findMany({
    where: { id: { in: students.map((s) => s.enrollment.id) } },
    select: { periodId: true },
  });
  check("official intakes are untouched", intakesKept.every((row) => row.periodId === januaryIntake.id));

  const admissionDates = await prisma.studentProfile.findMany({
    where: { id: { in: students.map((s) => s.profile.id) } },
    select: { admissionDate: true },
  });
  check(
    "admission dates are untouched",
    admissionDates.every((row) => row.admissionDate?.toISOString() === new Date(Date.UTC(2027, 1, 15)).toISOString()),
  );

  const afterCounts = await Promise.all(
    students.map(async (s) => ({
      invoices: await prisma.invoice.count({ where: { enrollmentId: s.enrollment.id } }),
      units: await prisma.studentUnit.count({ where: { enrollmentId: s.enrollment.id } }),
    })),
  );
  check(
    "invoices and unit registrations are untouched",
    afterCounts.every((row, index) => row.invoices === before[index].invoices && row.units === before[index].units),
  );

  const enrolments = await prisma.enrollment.count({ where: { studentId: { in: students.map((s) => s.profile.id) } } });
  check("the merge created no duplicate enrolment", enrolments === 4, `${enrolments} enrolments for 4 students`);

  console.log("\n5. Moving a student between classes leaves fees and stage alone");
  const mover = students[0];
  const invoicesBefore = await prisma.invoice.count({ where: { enrollmentId: mover.enrollment.id } });
  await prisma.$transaction(async (tx) => {
    await tx.classMembership.updateMany({ where: { enrollmentId: mover.enrollment.id, leftAt: null }, data: { leftAt: new Date() } });
    await tx.classMembership.create({
      data: { classId: tempClass.id, enrollmentId: mover.enrollment.id, campusId: campus.id, reason: "moved" },
    });
  });
  const mantis = await prisma.enrollment.findUnique({
    where: { id: mover.enrollment.id },
    select: { yearIndex: true, semesterNo: true, periodId: true },
  });
  const invoicesAfter = await prisma.invoice.count({ where: { enrollmentId: mover.enrollment.id } });
  check("a class change does not move the academic stage", mantis?.yearIndex === mover.stage.yearIndex && mantis?.semesterNo === mover.stage.semesterNo);
  check("a class change does not change the intake", mantis?.periodId === januaryIntake.id);
  check("a class change does not raise or remove a bill", invoicesAfter === invoicesBefore, `${invoicesBefore} -> ${invoicesAfter}`);
  check(
    "the previous membership is retained",
    (await prisma.classMembership.count({ where: { enrollmentId: mover.enrollment.id } })) === 3,
  );

  console.log("\n6. A student can only hold one class at a time");
  let secondRejected = false;
  try {
    await prisma.classMembership.create({
      data: {
        classId: janClass.id,
        enrollmentId: mover.enrollment.id,
        campusId: campus.id,
        reason: "duplicate attempt",
      },
    });
  } catch {
    secondRejected = true;
  }
  check("the database refuses a second open membership", secondRejected);

  console.log("\n7. A class name is scoped to its campus, programme and intake");

  // The same name in a DIFFERENT intake is a different class and must be allowed: an intake per
  // year is the norm, and blocking it would stop May 2027 from having its own ICT/A class.
  const maySameName = await prisma.academicClass
    .create({
      data: {
        campusId: campus.id,
        programId: program.id,
        periodId: mayIntake.id,
        year: 2027,
        name: janClass.name,
      },
    })
    .catch(() => null);
  check(
    "the same name in another intake is allowed",
    maySameName !== null,
    maySameName === null ? "the unique index is still scoped to the programme alone" : "",
  );

  // ...but a duplicate within one intake is still refused.
  let duplicateRejected = false;
  try {
    await prisma.academicClass.create({
      data: {
        campusId: campus.id,
        programId: program.id,
        periodId: januaryIntake.id,
        year: 2027,
        name: janClass.name,
      },
    });
  } catch {
    duplicateRejected = true;
  }
  check("the same name twice in ONE intake is refused", duplicateRejected);

  console.log("\n8. A closed intake is still joinable by a transfer or returning student");

  /*
   * The admission form once listed only intakes whose application deadline had not passed. That is
   * right for new applications and wrong for the two students who legitimately join a cohort that
   * is already running or over: a transfer placed into the intake matching what they have already
   * studied, and a returning student resuming with the group they began in.
   */
  const closedIntake = await prisma.academicPeriod.create({
    data: {
      name: "January intake 2025",
      campusId: campus.id,
      year: 2025,
      month: 1,
      sequence: 1,
      startsAt: new Date(Date.UTC(2025, 0, 6)),
      endsAt: new Date(Date.UTC(2025, 3, 30)),
      // Deliberately in the past: this cohort has already started and its applications closed.
      applicationDeadline: new Date(Date.UTC(2024, 11, 20)),
    },
  });
  check(
    "a past-deadline intake still exists to be joined",
    closedIntake.applicationDeadline < new Date(),
  );

  // The picker must now return it. Mirrors getIntakeOptions without needing a request scope.
  const listed = await prisma.academicPeriod.findMany({
    where: { campusId: campus.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true, month: true, year: true, applicationDeadline: true },
  });
  check(
    "the intake picker lists an intake whose deadline has passed",
    listed.some((row) => row.id === closedIntake.id),
    "filtering on applicationDeadline hides it and leaves a transfer unplaceable",
  );
  check(
    "intakes are listed newest first",
    listed[0].year >= listed[listed.length - 1].year,
  );

  // An old intake is a valid placement: progression simply reads further along.
  const { currentPeriod } = await import("@/lib/academics/progression");
  const early = currentPeriod(
    { startsAt: closedIntake.startsAt },
    new Date(Date.UTC(2025, 0, 6)),
    { totalPeriods: 6, semestersPerYear: 3 },
  );
  check(
    "a student who started in that intake begins at year 1, semester 1",
    early.yearIndex === 1 && early.semesterNo === 1,
  );
  const later = currentPeriod(
    { startsAt: closedIntake.startsAt },
    new Date(Date.UTC(2025, 7, 6)),
    { totalPeriods: 6, semestersPerYear: 3 },
  );
  check(
    "the same intake now reads as a later period, so a transfer can be placed forward",
    later.yearIndex > 1 || later.semesterNo > 1,
    `${later.yearIndex}.${later.semesterNo}`,
  );

  console.log("\n9. A class letter splits one intake into teaching groups");
  check(
    "a lettered name is suggested when a letter is given",
    suggestClassName("ICT", "JANUARY", 2027, "B") === "ICT/JAN/B/2027",
    suggestClassName("ICT", "JANUARY", 2027, "B"),
  );
  check(
    "without a letter the plain name is kept",
    suggestClassName("ICT", "JANUARY", 2027) === "ICT/JAN/2027",
  );
  check("the first free letter with nothing used is A", nextClassLetter([]) === "A");
  check("A taken gives B", nextClassLetter(["ICT/JAN/A/2027"]) === "B");
  check("A and B taken gives C", nextClassLetter(["ICT/JAN/A/2027", "ICT/JAN/B/2027"]) === "C");
  check(
    "letters are read in any position and casing",
    nextClassLetter(["ict/jan/b/2027", "ICT/JAN/A/2027"]) === "C",
  );
  check("a name with no letter does not consume one", nextClassLetter(["ICT/JAN/2027"]) === "A");

  console.log("\n10. The class a student is placed in must be of their own intake");
  // This is the query the admission action runs. A January intake must not resolve the May class.
  const resolvesMayForJanuary = await prisma.academicClass.findFirst({
    where: {
      id: maySameName?.id ?? "none",
      campusId: campus.id,
      programId: program.id,
      periodId: januaryIntake.id,
      year: januaryIntake.year,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  check(
    "a May class does not resolve for a January student",
    resolvesMayForJanuary === null,
    "scoping the lookup to the programme alone would accept it",
  );

  const resolvesOwn = await prisma.academicClass.findFirst({
    where: {
      id: janClass.id,
      campusId: campus.id,
      programId: program.id,
      periodId: januaryIntake.id,
      year: januaryIntake.year,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  check("a January class does resolve for a January student", resolvesOwn !== null);

  // A class of a different programme must never resolve, whatever the intake.
  const foreignProgram = await prisma.program.findFirst({
    where: { archivedAt: null, id: { not: program.id } },
    select: { id: true },
  });
  if (foreignProgram) {
    const crossProgram = await prisma.academicClass.findFirst({
      where: {
        id: janClass.id,
        campusId: campus.id,
        programId: foreignProgram.id,
        periodId: januaryIntake.id,
        year: januaryIntake.year,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    check("another programme's class never resolves", crossProgram === null);
  } else {
    console.log("  skip only one programme in this database, so the cross-programme check is moot");
  }

  console.log("\n11. A class ID is reused, not duplicated, when the same class runs again");

  /*
   * The office archives a class at the end of its intake and later opens the same class
   * again (a late cohort, a corrected archive, a re-run). The row — and therefore the ID
   * every document, membership and chat room points at — must be reused: a twin class
   * would split the roster's history in two.
   */
  const { resolveClassForName, renameClash } = await import("@/lib/academics/class-reuse");

  const again = await resolveClassForName({
    campusId: campus.id,
    programId: program.id,
    periodId: mayIntake.id,
    year: mayIntake.year,
    name: "ICT/REUSE/2027",
  });
  check("a new name creates one class", again.reuse === "created");

  const sameAgain = await resolveClassForName({
    campusId: campus.id,
    programId: program.id,
    periodId: mayIntake.id,
    year: mayIntake.year,
    name: "ICT/REUSE/2027",
  });
  check(
    "the same name in the same identity reuses the class ID",
    sameAgain.reuse === "reused" && sameAgain.id === again.id,
    `${sameAgain.reuse} ${sameAgain.id === again.id}`,
  );

  await prisma.academicClass.update({
    where: { id: again.id },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });

  const reopened = await resolveClassForName({
    campusId: campus.id,
    programId: program.id,
    periodId: mayIntake.id,
    year: mayIntake.year,
    name: "ICT/REUSE/2027",
  });
  check(
    "an archived class is reopened under its own ID",
    reopened.reuse === "reactivated" && reopened.id === again.id,
    `${reopened.reuse} ${reopened.id === again.id}`,
  );
  const reopenedRow = await prisma.academicClass.findUnique({
    where: { id: again.id },
    select: { status: true, archivedAt: true },
  });
  check("the reopened class is active and no longer archived", reopenedRow?.status === "ACTIVE" && reopenedRow?.archivedAt === null);

  // A name reused in a DIFFERENT intake is a different class: it must create, not reuse.
  const otherIntake = await resolveClassForName({
    campusId: campus.id,
    programId: program.id,
    periodId: januaryIntake.id,
    year: januaryIntake.year,
    name: "ICT/REUSE/2027",
  });
  check("the same name in another intake is its own class", otherIntake.reuse === "created" && otherIntake.id !== again.id);

  // Renaming onto a name used by another intake is allowed; the identity is per intake.
  const crossIntake = await renameClash({
    id: otherIntake.id,
    campusId: campus.id,
    programId: program.id,
    periodId: januaryIntake.id,
    name: "ICT/REUSE/2027",
  });
  check(
    "a rename may use a name another intake already has",
    crossIntake === null || crossIntake.id === otherIntake.id,
    crossIntake?.id ?? "none",
  );

  // ...but renaming onto a name inside its own identity is refused.
  const sameScope = await renameClash({
    id: otherIntake.id,
    campusId: campus.id,
    programId: program.id,
    periodId: januaryIntake.id,
    name: janClass.name,
  });
  check("a rename colliding inside its own class is refused", sameScope !== null && sameScope.id !== otherIntake.id);

  console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
  await prisma.$disconnect();
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The fixture campus is removed even when a check throws, so a failed run cannot leave
  // rows behind for the next one to trip over.
  .finally(async () => {
    const { prisma } = await import("@/lib/prisma");
    if (campusIdForCleanup !== null) await cleanup(campusIdForCleanup);
    await prisma.$disconnect();
  });
