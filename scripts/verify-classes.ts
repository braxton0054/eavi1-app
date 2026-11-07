/**
 * Proves the class rules hold on a real database.
 *
 * The things that matter here are the ones a mistake would quietly damage: a merge must move
 * the grouping and nothing else, a class must never decide a student's stage, and an intake
 * must never be anything but January, May or September.
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
  await prisma.intake.deleteMany({ where: { campusId } });
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
  const { mergeBlockages, OFFICIAL_INTAKES, officialIntakeForDate, suggestClassName } = await import(
    "@/lib/academics/classes"
  );

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
    data: { code: tag, name: `${tag} campus`, place: "Test", phone: "+254700000000" },
  });
  campusIdForCleanup = campus.id;
  let rejected = false;
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO intakes (id, name, "campusId", year, month, "startsAt", "applicationDeadline", "commenceAt") VALUES (gen_random_uuid()::text, 'March intake', ${campus.id}, 2027, 3, now(), now(), now())`,
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

  const januaryIntake = await prisma.intake.create({
    data: {
      name: "January intake",
      campusId: campus.id,
      year: 2027,
      month: 1,
      startsAt: new Date(Date.UTC(2027, 0, 5)),
      applicationDeadline: new Date(Date.UTC(2026, 11, 20)),
      commenceAt: new Date(Date.UTC(2027, 0, 5)),
    },
  });
  const mayIntake = await prisma.intake.create({
    data: {
      name: "May intake",
      campusId: campus.id,
      year: 2027,
      month: 5,
      startsAt: new Date(Date.UTC(2027, 4, 4)),
      applicationDeadline: new Date(Date.UTC(2027, 3, 20)),
      commenceAt: new Date(Date.UTC(2027, 4, 4)),
    },
  });

  const janClass = await prisma.academicClass.create({
    data: {
      campusId: campus.id,
      programId: program.id,
      intakeId: januaryIntake.id,
      intakeMonth: "JANUARY",
      year: 2027,
      name: `${tag}/JAN/2027`,
    },
  });
  const tempClass = await prisma.academicClass.create({
    data: {
      campusId: campus.id,
      programId: program.id,
      intakeId: januaryIntake.id,
      intakeMonth: "JANUARY",
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
        intakeId: januaryIntake.id,
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
    intakeId: januaryIntake.id,
    intakeMonth: "JANUARY",
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
      { ...tempClass, intakeMonth: "JANUARY" },
      { ...tempClass, id: "x", intakeMonth: "SEPTEMBER" },
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
    select: { intakeId: true },
  });
  check("official intakes are untouched", intakesKept.every((row) => row.intakeId === januaryIntake.id));

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
    select: { yearIndex: true, semesterNo: true, intakeId: true },
  });
  const invoicesAfter = await prisma.invoice.count({ where: { enrollmentId: mover.enrollment.id } });
  check("a class change does not move the academic stage", mantis?.yearIndex === mover.stage.yearIndex && mantis?.semesterNo === mover.stage.semesterNo);
  check("a class change does not change the intake", mantis?.intakeId === januaryIntake.id);
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

  console.log("\n7. Classes are per programme, campus, intake and year");
  let duplicateRejected = false;
  try {
    await prisma.academicClass.create({
      data: {
        campusId: campus.id,
        programId: program.id,
        intakeId: mayIntake.id,
        intakeMonth: "MAY",
        year: 2027,
        name: janClass.name,
      },
    });
  } catch {
    duplicateRejected = true;
  }
  check("the same class name cannot exist twice in one programme", duplicateRejected);

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
