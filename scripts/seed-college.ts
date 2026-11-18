/**
 * Builds a realistic college for testing: two campuses, 500+ students each, programmes with
 * units and fee plans, intakes, classes, timetables, exams, invoices and payments.
 *
 * This is a TEST fixture and is never run in production. It is idempotent: every record is
 * keyed by a natural identifier, so re-running tops up rather than duplicating.
 *
 *   npx tsx scripts/seed-college.ts [--students=520] [--campus=MAIN] [--campus=WEST]
 */

import "../load-env";
import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/auth";

const arg = (name: string) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : null;
};

const PER_CAMPUS = Number(arg("students") ?? 520);
const PASSWORD = "Portal2026!";

const DAY_MS = 86_400_000;
const day = (d: Date) => {
  const copy = new Date(d.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const pick = <T,>(rows: T[], i: number) => rows[i % rows.length];

/** Deterministic pseudo-random, so a re-run produces the same data. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const FIRST = [
  "Amos", "Faith", "Brian", "Mercy", "Amina", "Kevin", "Grace", "Dennis", "Joy", "Paul",
  "Sarah", "Samuel", "Nancy", "Victor", "Lucy", "Peter", "Esther", "Daniel", "Cynthia", "George",
  "Hellen", "Joseph", "Irene", "Martin", "Janet", "Collins", "Winnie", "Duncan", "Beatrice", "Elijah",
  "Caroline", "Moses", "Rose", "Anthony", "Lydia", "Patrick", "Sharon", "Eric", "Millicent", "Fredrick",
];
const LAST = [
  "Kiptoo", "Chebet", "Ochieng", "Wanjiku", "Hassan", "Mutua", "Achieng", "Kimani", "Njoroge", "Auma",
  "Otieno", "Mwangi", "Barasa", "Kilonzo", "Wafula", "Onyango", "Njeri", "Kariuki", "Wekesa", "Maina",
  "Omondi", "Chepkoech", "Mbuthia", "Oduor", "Kamau", "Nyambura", "Simiyu", "Adhiambo", "Githinji", "Moraa",
];

const PROGRAMMES = [
  { code: "DICT", name: "Diploma in Information Communication Technology", type: "Diploma", months: 24, grade: "D" },
  { code: "DSWE", name: "Diploma in Software Engineering", type: "Diploma", months: 24, grade: "D" },
  { code: "DBM", name: "Diploma in Business Management", type: "Diploma", months: 24, grade: "D" },
  { code: "DHRM", name: "Diploma in Human Resource Management", type: "Diploma", months: 24, grade: "D" },
  { code: "DACC", name: "Diploma in Accounting", type: "Diploma", months: 24, grade: "D+" },
  { code: "CICT", name: "Certificate in Information Communication Technology", type: "Certificate", months: 12, grade: "E" },
  { code: "CSAL", name: "Certificate in Sales and Marketing", type: "Certificate", months: 12, grade: "E" },
  { code: "HDHRM", name: "Higher Diploma in Human Resource Management", type: "Higher diploma", months: 18, grade: "C-" },
] as const;

const UNITS = [
  "Communication Skills", "Information Literacy", "Entrepreneurship", "Life Skills",
  "Computer Architecture", "Programming Fundamentals", "Database Systems", "Networking Essentials",
  "Web Development", "Systems Analysis", "Operating Systems", "Project Management",
  "Business Law", "Financial Accounting", "Marketing Principles", "Human Resource Practice",
  "Office Administration", "Customer Service", "Statistics", "Research Methods",
];

const FEE_PER_YEAR = 48_000;
const REGISTRATION_FEE = 2_000;

async function ensureLookups() {
  const department = await prisma.department.upsert({
    where: { name: "Computing and Business" },
    update: {},
    create: { name: "Computing and Business" },
  });
  const knec = (await prisma.programBody.findFirst({ where: { name: "KNEC" } }))
    ?? (await prisma.programBody.create({ data: { name: "KNEC", code: "KNEC" } }));
  const cadence = (await prisma.feeCadence.findFirst({ where: { name: "Per semester" } }))
    ?? (await prisma.feeCadence.create({ data: { name: "Per semester", kind: "SEMESTER" } }));

  const codes: Record<string, string> = {
    Certificate: "CERT",
    Diploma: "DIP",
    "Higher diploma": "HDIP",
    Degree: "DEG",
    "Short course": "SHORT",
  };
  const typeId = async (name: string) =>
    (await prisma.programType.findFirst({ where: { name } }))
    ?? (await prisma.programType.create({ data: { name, code: codes[name] ?? name.slice(0, 6).toUpperCase() } }));

  return { department, knec, cadence, typeId };
}

async function main() {
  console.log(`Seeding a test college: ${PER_CAMPUS} students per campus`);

  const KCSE: Record<string, string> = {
    "A": "A", "A-": "A_MINUS", "B+": "B_PLUS", "B": "B", "B-": "B_MINUS",
    "C+": "C_PLUS", "C": "C", "C-": "C_MINUS", "D+": "D_PLUS", "D": "D", "D-": "D_MINUS", "E": "E",
  };

  const shared = await ensureLookups();

  const campuses = [
    { code: "MAIN", name: "Main Campus", place: "Nairobi" },
    { code: "WEST", name: "West Campus", place: "Kisumu" },
  ];

  const campusRows = [];
  for (const c of campuses) {
    campusRows.push(
      await prisma.campus.upsert({ where: { code: c.code }, update: {}, create: c }),
    );
  }

  // --- programmes ---------------------------------------------------------
  const programRows = [];
  for (const p of PROGRAMMES) {
    // The lookup helper returns a row; the programme stores only its id.
    const type = await shared.typeId(p.type);
    const typeId = type.id;
    const existing = await prisma.program.findUnique({ where: { code: p.code } });
    const data: { code: string; name: string; departmentId: string; bodyId: string; typeId: string; cadenceId: string; durationMonths: number; minKcseGrade: never } = {
      code: p.code as string,
      name: p.name,
      departmentId: shared.department.id,
      bodyId: shared.knec.id,
      typeId,
      cadenceId: shared.cadence.id,
      durationMonths: p.months,
      minKcseGrade: (KCSE[p.grade] ?? "E") as never,
    };
    const program = existing
      ? await prisma.program.update({ where: { code: p.code }, data: { ...data } })
      : await prisma.program.create({ data: { ...data } });

    // Units: one per semester of the programme, drawn from the shared pool.
    const semesters = Math.max(1, Math.round(p.months / 4));
    const existingUnits = await prisma.programUnit.count({ where: { programId: program.id } });
    if (existingUnits === 0) {
      let sequence = 0;
      for (let yearIndex = 1; yearIndex <= Math.ceil(semesters / 3); yearIndex += 1) {
        for (let semesterNo = 1; semesterNo <= Math.min(3, semesters - (yearIndex - 1) * 3); semesterNo += 1) {
          for (let k = 0; k < 3; k += 1) {
            const name = pick(UNITS, sequence);
            const code = `${p.code}-${100 + sequence}`;
            const unit = await prisma.unit.upsert({
              where: { code },
              update: {},
              create: { code, name },
            });
            await prisma.programUnit.create({
              data: {
                programId: program.id,
                unitId: unit.id,
                periodKey: `Y${yearIndex}S${semesterNo}`,
                periodLabel: `Year ${yearIndex} Semester ${semesterNo}`,
                yearIndex,
                semesterNo,
                sequence,
                isCore: true,
              },
            });
            sequence += 1;
          }
        }
      }
    }

    // Fee plan plus its itemised periods, which is what an enrolment is billed from.
    const planCount = await prisma.programFeePlan.count({ where: { programId: program.id } });
    if (planCount === 0) {
      const total = (FEE_PER_YEAR * p.months) / 12 + REGISTRATION_FEE;
      const plan = await prisma.programFeePlan.create({
        data: {
          programId: program.id,
          version: 1,
          cadenceId: shared.cadence.id,
          durationMonths: p.months,
          totalAmount: total,
        },
      });
      await prisma.feeItem.create({
        data: {
          programId: program.id,
          planId: plan.id,
          label: "Registration",
          amount: REGISTRATION_FEE,
          sequence: 0,
        },
      });
      const periods = Math.max(1, Math.round(p.months / 4));
      const per = Math.round((FEE_PER_YEAR * p.months) / 12 / periods);
      for (let i = 0; i < periods; i += 1) {
        await prisma.feeItem.create({
          data: {
            programId: program.id,
            planId: plan.id,
            label: `Semester ${i + 1} tuition`,
            amount: per,
            sequence: i + 1,
          },
        });
      }
    }

    // Every campus offers every seeded programme, the way the create-programme action links
    // them. Without this link the programme is invisible to admission and cannot be enrolled.
    await prisma.program.update({
      where: { id: program.id },
      data: { campuses: { connect: campusRows.map((c) => ({ id: c.id })) } },
    });

    programRows.push({ ...program, months: p.months });
  }
  console.log(`  programmes: ${programRows.length}`);

  // --- college-wide intakes ----------------------------------------------
  const year = new Date().getFullYear();
  const intakePlan = [
    { month: 1, start: [1, 1], end: [4, 30] },
    { month: 5, start: [5, 1], end: [8, 31] },
    { month: 9, start: [9, 1], end: [12, 20] },
  ];

  const sharedIntakes: { id: string; month: number; year: number }[] = [];
  for (const plan of intakePlan) {
    const name = `${["January", "May", "September"][[1, 5, 9].indexOf(plan.month)]} intake ${year}`;
    const startsAt = day(new Date(year, plan.start[0] - 1, plan.start[1]));
    const endsAt = day(new Date(year, plan.end[0] - 1, plan.end[1]));
    const deadline = addDays(startsAt, -21);
    const sequence = [1, 5, 9].indexOf(plan.month) + 1;

    const row = await prisma.academicPeriod.upsert({
      where: { year_month: { year, month: plan.month } },
      update: { campusId: null, startsAt, endsAt, applicationDeadline: deadline, name, sequence },
      create: {
        year,
        month: plan.month,
        sequence,
        name,
        startsAt,
        endsAt,
        applicationDeadline: deadline,
      },
    });
    sharedIntakes.push({ id: row.id, month: plan.month, year });
  }

  // Every campus books its own classes against the same shared intake rows.
  const intakesByCampus = new Map<number, { id: string; month: number; year: number }[]>();
  for (const campus of campusRows) intakesByCampus.set(campus.id, sharedIntakes);
  console.log(`  intakes: ${sharedIntakes.length} (shared by ${campusRows.length} campuses)`);

  // --- classes per campus/intake/programme --------------------------------
  const classesByCampus = new Map<number, { id: string; programId: string; intakeId: string }[]>();
  for (const campus of campusRows) {
    const list = [];
    for (const intake of intakesByCampus.get(campus.id)!) {
      for (const program of programRows) {
        const name = `${program.code}/${
          ["JAN", "MAY", "SEP"][[1, 5, 9].indexOf(intake.month)]
        }/A/${intake.year}`;
        const row = await prisma.academicClass.upsert({
          where: {
            campusId_programId_periodId_name: {
              campusId: campus.id,
              programId: program.id,
              periodId: intake.id,
              name,
            },
          },
          update: {},
          create: {
            campusId: campus.id,
            programId: program.id,
            periodId: intake.id,
            year: intake.year,
            name,
            status: "ACTIVE",
          },
        });
        list.push({ id: row.id, programId: program.id, intakeId: intake.id });
      }
    }
    classesByCampus.set(campus.id, list);
  }
  console.log(`  classes: ${[...classesByCampus.values()].flat().length}`);

  // --- students ----------------------------------------------------------
  const passwordHash = await hashPassword(PASSWORD);
  const random = rng(20260101);
  let created = 0;

  for (const campus of campusRows) {
    for (let i = 0; i < PER_CAMPUS; i += 1) {
      const first = pick(FIRST, i * 7 + campus.id);
      const last = pick(LAST, i * 13 + campus.id * 3);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}.${campus.code.toLowerCase()}@student.eavi.ac.ke`;
      const admissionNo = `EAVI/${campus.code}/${year}/${String(i + 1).padStart(4, "0")}`;

      const existing = await prisma.studentProfile.findUnique({ where: { admissionNo } });
      if (existing) continue;

      const program = pick(programRows, Math.floor(random() * programRows.length));
      const intakeList = intakesByCampus.get(campus.id)!;
      // Weight towards the earliest intake so classes have realistic sizes.
      const intake = pick(intakeList, Math.floor(random() * 3));
      const yearIndex = 1;
      const semesterNo = 1 + Math.floor(random() * 3);

      const user = await prisma.user.create({
        data: {
          email,
          fullName: `${first} ${last}`,
          passwordHash,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });

      const student = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          admissionNo,
          campusId: campus.id,
          gender: random() > 0.5 ? "FEMALE" : "MALE",
          dateOfBirth: new Date(year - 18 - Math.floor(random() * 6), Math.floor(random() * 12), 1 + Math.floor(random() * 27)),
          guardianName: `${pick(FIRST, i + 3)} ${last}`,
          guardianPhone: `07${String(10_000_000 + Math.floor(random() * 89_999_999)).slice(0, 8)}`,
          address: `${campus.place}, Kenya`,
          admissionDate: intake.month === 1 ? new Date(year, 0, 15) : new Date(year, intake.month - 1, 10),
        },
      });

      const enrollment = await prisma.enrollment.create({
        data: {
          studentId: student.id,
          programId: program.id,
          campusId: campus.id,
          periodId: intake.id,
          yearIndex,
          semesterNo,
          status: "ACTIVE",
          enrolledAt: new Date(year, intake.month - 1, 5 + Math.floor(random() * 20)),
        },
      });

      // Class membership: the class for their programme and intake.
      const klass = classesByCampus
        .get(campus.id)!
        .find((k) => k.programId === program.id && k.intakeId === intake.id);
      if (klass) {
        await prisma.classMembership.create({
          data: {
            classId: klass.id,
            enrollmentId: enrollment.id,
            campusId: campus.id,
            reason: "seeded",
          },
        });
      }

      // Registration for the units of their current semester, with plausible marks for past ones.
      const units = await prisma.programUnit.findMany({
        where: { programId: program.id, semesterNo: { lte: semesterNo } },
        select: { id: true, semesterNo: true },
      });
      for (const unit of units) {
        const past = (unit.semesterNo ?? 1) < semesterNo;
        const score = past ? 40 + Math.floor(random() * 55) : null;
        await prisma.studentUnit.create({
          data: {
            enrollmentId: enrollment.id,
            programUnitId: unit.id,
            status: past ? (score! >= 50 ? "COMPLETED" : "FAILED") : "REGISTERED",
            score: score ?? undefined,
            maxScore: past ? 100 : undefined,
            grade: past ? (score! >= 70 ? "A" : score! >= 60 ? "B" : score! >= 50 ? "C" : "D") : undefined,
            registeredAt: new Date(year, intake.month - 1, 8),
            completedAt: past ? new Date(year, intake.month + 3, 20) : undefined,
          },
        });
      }

      // Fees: one invoice per period up to the current semester, and payments for most of them.
      const plan = await prisma.programFeePlan.findFirst({
        where: { programId: program.id },
        orderBy: { version: "desc" },
        include: { periods: { orderBy: { sequence: "asc" } } },
      });
      if (plan) {
        const payable = plan.periods.slice(0, semesterNo + 1);
        for (const [index, item] of payable.entries()) {
          const dueAt = addDays(new Date(year, intake.month - 1, 5), index * 120);
          const invoice = await prisma.invoice.create({
            data: {
              number: `INV/${campus.code}/${year}/${String(created + 1).padStart(5, "0")}-${index}`,
              studentId: student.id,
              campusId: campus.id,
              programId: program.id,
              enrollmentId: enrollment.id,
              feePlanId: plan.id,
              feePeriodId: item.id,
              periodYear: yearIndex,
              periodSemester: index,
              dueAt,
              status: "OPEN",
              lines: { create: [{ label: item.label, amount: item.amount }] },
            },
          });

          // Most students have paid the older bills; recent ones are often unpaid.
          const roll = random();
          const due = Number(item.amount);
          const paidAmount = index === 0 ? due : roll > 0.45 ? due : roll > 0.2 ? Math.round(due * 0.5) : 0;
          if (paidAmount > 0) {
            await prisma.payment.create({
              data: {
                invoiceId: invoice.id,
                studentId: student.id,
                amount: paidAmount,
                method: pick(["MPESA", "BANK", "CASH"] as const, i),
                reference: `RCP${campus.code}${String(created).padStart(5, "0")}${index}`,
                paidAt: addDays(dueAt, -Math.floor(random() * 10)),
              },
            });
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: paidAmount >= Number(item.amount) ? "PAID" : "PARTIAL" },
            });
          }
        }
      }

      created += 1;
      if (created % 100 === 0) console.log(`  students: ${created}`);
    }
  }

  console.log(`  students created: ${created}`);

  // --- tutors ------------------------------------------------------------
  const tutorPlan = [
    { name: "Tutor Main", email: "tutor.main@eavi.ac.ke", campus: "MAIN", dept: "Computing" },
    { name: "Tutor West", email: "tutor.west@eavi.ac.ke", campus: "WEST", dept: "Business" },
  ];
  for (const t of tutorPlan) {
    const campus = campusRows.find((c) => c.code === t.campus)!;
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { email: t.email, fullName: t.name, passwordHash, role: "TUTOR", status: "ACTIVE" },
    });
    const profile = await prisma.tutorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        staffNo: `T-${t.campus}-001`,
        campusId: campus.id,
        department: t.dept,
      },
    });
    // Give the tutor a timetable and a class to run.
    const slots = await prisma.timetableSlot.count({ where: { tutorId: profile.id } });
    if (slots === 0) {
      const program = programRows[0];
      for (const [i, d] of (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const).entries()) {
        await prisma.timetableSlot.create({
          data: {
            campusId: campus.id,
            programId: program.id,
            tutorId: profile.id,
            day: d,
            startAt: "08:00",
            endAt: "10:00",
            room: `R${i + 1}`,
          },
        });
      }
    }
    const klass = classesByCampus.get(campus.id)![0];
    await prisma.classTutor.upsert({
      where: { classId_tutorId: { classId: klass.id, tutorId: profile.id } },
      update: {},
      create: { classId: klass.id, tutorId: profile.id },
    });
  }
  console.log(`  tutors: ${tutorPlan.length}`);

  // --- exams -------------------------------------------------------------
  const examCount = await prisma.exam.count();
  if (examCount === 0) {
    const campus = campusRows[0];
    const tutorUser = await prisma.user.findUnique({ where: { email: tutorPlan[0].email } });
    const tutor = tutorUser
      ? await prisma.tutorProfile.findUnique({ where: { userId: tutorUser.id } })
      : null;
    for (let i = 0; i < 6; i += 1) {
      await prisma.exam.create({
        data: {
          title: `${pick(UNITS, i)} end of semester paper`,
          programId: programRows[i % programRows.length].id,
          campusId: campus.id,
          type: "END_TERM",
          date: addDays(day(new Date()), 5 + i * 2),
          startAt: "09:00",
          room: `Hall ${i + 1}`,
          invigilatorId: tutor?.id ?? null,
        },
      });
    }
    console.log(`  exams: 6`);
  }

  console.log("Done.");
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
