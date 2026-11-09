/**
 * Puts a usable programme catalogue on an empty production database.
 *
 * The portal was deployed to a database holding a single hand-typed programme whose name was
 * keyboard mashing and whose minimum grade was A — the top grade in KCSE. That combination made
 * the public application form unusable: every real applicant was refused by the grade gate, and
 * the one programme they could be admitted to had no units, so the student portal would correctly
 * show an empty syllabus.
 *
 * This creates a small, realistic catalogue instead — enough to demonstrate and test the whole
 * path from application through admission to the student portal. The fees and unit codes are
 * plausible placeholders, not the college's real syllabus; they exist so the screens have
 * something truthful-shaped to render until the office enters its own.
 *
 * Idempotent by programme code: running it twice updates rather than duplicates. The junk
 * programme is removed only when explicitly named, never by pattern, so this can never delete a
 * programme a person meant to keep.
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { EntryGrade } from "../generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** The programme that was hand-typed into production and cannot admit anyone. */
const JUNK_CODE = "0087-CERT-001";

type Seed = {
  code: string;
  name: string;
  type: "Certificate" | "Diploma" | "Higher diploma";
  months: number;
  grade: EntryGrade;
  /** Unit titles for year 1, in teaching order. Later years reuse the pool. */
  units: string[];
};

const PROGRAMMES: Seed[] = [
  {
    code: "DICT",
    name: "Diploma in Information Communication Technology",
    type: "Diploma",
    months: 24,
    grade: EntryGrade.C_MINUS,
    units: [
      "Communication Skills",
      "Information Literacy",
      "Computer Architecture",
      "Programming Fundamentals",
    ],
  },
  {
    code: "DSWE",
    name: "Diploma in Software Engineering",
    type: "Diploma",
    months: 24,
    grade: EntryGrade.C_MINUS,
    units: [
      "Programming Fundamentals",
      "Database Systems",
      "Web Development",
      "Systems Analysis",
    ],
  },
  {
    code: "DBM",
    name: "Diploma in Business Management",
    type: "Diploma",
    months: 24,
    grade: EntryGrade.D,
    units: ["Business Law", "Financial Accounting", "Marketing Principles", "Entrepreneurship"],
  },
  {
    code: "DHRM",
    name: "Diploma in Human Resource Management",
    type: "Diploma",
    months: 24,
    grade: EntryGrade.D,
    units: [
      "Human Resource Practice",
      "Office Administration",
      "Customer Service",
      "Business Law",
    ],
  },
  {
    code: "DACC",
    name: "Diploma in Accounting",
    type: "Diploma",
    months: 24,
    grade: EntryGrade.D_PLUS,
    units: [
      "Financial Accounting",
      "Statistics",
      "Business Law",
      "Entrepreneurship",
    ],
  },
  {
    code: "CICT",
    name: "Certificate in Information Communication Technology",
    type: "Certificate",
    months: 12,
    grade: EntryGrade.E,
    units: ["Communication Skills", "Information Literacy", "Programming Fundamentals"],
  },
  {
    code: "HDHRM",
    name: "Higher Diploma in Human Resource Management",
    type: "Higher diploma",
    months: 18,
    grade: EntryGrade.C_PLUS,
    units: ["Research Methods", "Human Resource Practice", "Project Management", "Statistics"],
  },
];

const FEE_PER_YEAR = 48_000;
const REGISTRATION_FEE = 2_000;

async function ensureLookups() {
  const department = await prisma.department.upsert({
    where: { name: "Computing and Business" },
    update: {},
    create: { name: "Computing and Business" },
  });

  const knec =
    (await prisma.programBody.findFirst({ where: { name: "KNEC" } })) ??
    (await prisma.programBody.create({ data: { name: "KNEC", code: "KNEC" } }));

  const cadence =
    (await prisma.feeCadence.findFirst({ where: { name: "Per semester" } })) ??
    (await prisma.feeCadence.create({ data: { name: "Per semester", kind: "SEMESTER" } }));

  const typeCodes: Record<string, string> = {
    Certificate: "CERT",
    Diploma: "DIP",
    "Higher diploma": "HDIP",
  };
  const typeId = async (name: string) =>
    (await prisma.programType.findFirst({ where: { name } })) ??
    (await prisma.programType.create({ data: { name, code: typeCodes[name] ?? "TYPE" } }));

  const campuses = await prisma.campus.findMany({ select: { id: true } });

  return { department, knec, cadence, typeId, campuses };
}

async function main() {
  const shared = await ensureLookups();

  /*
   * Removed first so the unique code cannot collide with a real programme, and so a re-run
   * cannot leave the junk behind. Guarded on "has no enrolments": if anyone somehow enrolled
   * against it, the delete is skipped and the programme stays for the office to deal with.
   */
  const junk = await prisma.program.findUnique({ where: { code: JUNK_CODE } });
  if (junk) {
    const dependent = await prisma.enrollment.count({ where: { programId: junk.id } });
    if (dependent === 0) {
      await prisma.program.delete({ where: { id: junk.id } });
      console.log(`removed junk programme ${JUNK_CODE} ("${junk.name}")`);
    } else {
      console.log(`left ${JUNK_CODE} in place: ${dependent} enrolment(s) depend on it`);
    }
  }

  for (const p of PROGRAMMES) {
    const type = await shared.typeId(p.type);

    const data = {
      code: p.code,
      name: p.name,
      departmentId: shared.department.id,
      bodyId: shared.knec.id,
      typeId: type.id,
      cadenceId: shared.cadence.id,
      durationMonths: p.months,
      minKcseGrade: p.grade,
    };

    const existing = await prisma.program.findUnique({ where: { code: p.code } });
    const program = existing
      ? await prisma.program.update({ where: { code: p.code }, data })
      : await prisma.program.create({ data });

    // Units, grouped by the year and semester the planner expects. Groups of the pool titles
    // repeat across later semesters, which is enough to make the planner and the student's
    // "my units" page show real rows.
    const existingUnits = await prisma.programUnit.count({ where: { programId: program.id } });
    if (existingUnits === 0) {
      const semesters = Math.max(1, Math.round(p.months / 4));
      let sequence = 0;
      for (let yearIndex = 1; yearIndex <= Math.ceil(semesters / 2); yearIndex += 1) {
        for (let semesterNo = 1; semesterNo <= 2; semesterNo += 1) {
          if (sequence >= semesters * p.units.length) break;
          for (let k = 0; k < p.units.length; k += 1) {
            const title = p.units[(sequence + k) % p.units.length];
            const code = `${p.code}-${100 + sequence}`;
            const unit = await prisma.unit.upsert({
              where: { code },
              update: { name: title },
              create: { code, name: title },
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

    // Fee plan and its itemised periods, which is what an enrolment is billed from.
    const planCount = await prisma.programFeePlan.count({ where: { programId: program.id } });
    if (planCount === 0) {
      const total = Math.round((FEE_PER_YEAR * p.months) / 12) + REGISTRATION_FEE;
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
      const per = Math.round(((FEE_PER_YEAR * p.months) / 12) / periods);
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

    // Every campus offers every programme, as the create-programme action links them. Without
    // this the programme is invisible to admission and cannot be enrolled.
    await prisma.program.update({
      where: { id: program.id },
      data: { campuses: { set: shared.campuses.map((c) => ({ id: c.id })) } },
    });

    const units = await prisma.programUnit.count({ where: { programId: program.id } });
    const plans = await prisma.programFeePlan.count({ where: { programId: program.id } });
    console.log(
      `${p.code.padEnd(6)} ${p.name.slice(0, 44).padEnd(46)} grade=${p.grade.padEnd(8)} units=${String(units).padStart(2)} plans=${plans}`,
    );
  }

  console.log(`\ntotal programmes: ${await prisma.program.count()}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
