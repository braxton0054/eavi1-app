"use server";

import { redirect } from "next/navigation";

import { EntryGrade, FeePeriodKind, ProgramStructure } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertStorageFor,
  enumField,
  fileField,
  hiddenId,
  nextProgramCode,
  onSave,
  putFile,
  refuseWhenUsed,
  requiredNumber,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";
import { archiveRefusal, deletionRefusal, lifecycleCounts } from "@/lib/academics/lifecycle";
import type { Field } from "@/lib/content/dashboard";

const GRADES = Object.keys(EntryGrade) as (keyof typeof EntryGrade)[];

/** The billing periods a registered payment type can stand for. */
const FEE_KINDS = Object.keys(FeePeriodKind) as (keyof typeof FeePeriodKind)[];

/** Semesters, months, modules or a hand-built structure. */
const STRUCTURES = Object.keys(ProgramStructure) as (keyof typeof ProgramStructure)[];

const copy = pages.programs;
const settings = copy.settings;
const fieldLabel = (name: string) => copy.create.fields.find((field) => field.name === name)?.label ?? name;

/** Bodies, types and payment types are created and edited from the same two labels. */
const registryFieldLabel = (section: "bodies" | "types" | "cadences", name: string) =>
  (copy.settings[section].create.fields as readonly Field[]).find((field) => field.name === name)?.label ?? name;
const registryEditLabel = (section: "bodies" | "types" | "cadences", name: string) =>
  (copy.settings[section].edit.fields as readonly Field[]).find((field) => field.name === name)?.label ?? name;

/** The programme list, the overview counters and the enrolment screen all read this. */
const AFFECTED = ["/dashboard/programs", "/dashboard", "/dashboard/enrollments"];

/**
 * A dropdown id is only trusted once it names a real row. Bodies and types are
 * college-wide, so there is no campus to check them against, and both carry the short
 * code that makes up a programme code.
 */
async function codedChoice(table: "programBody" | "programType", id: string, label: string) {
  const where = { id };
  const select = { id: true, code: true };
  const row =
    table === "programBody"
      ? await prisma.programBody.findUnique({ where, select })
      : await prisma.programType.findUnique({ where, select });
  if (!row) throw new FieldError(fieldErrors.choice(label));

  return row;
}

async function cadenceChoice(id: string, label: string) {
  const row = await prisma.feeCadence.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new FieldError(fieldErrors.choice(label));

  return row.id;
}

/** A programme is only editable from the campuses that offer it; a super admin has no filter. */
async function knownProgram(programId: string, campusId: number | null) {
  const program = await prisma.program.findFirst({
    where: { id: programId, campuses: campusId === null ? undefined : { some: { id: campusId } } },
    select: { id: true, code: true, archivedAt: true },
  });
  if (!program) throw new FieldError(fieldErrors.notOnCampus);

  return program;
}

/** Every answer the programme form collects, in the order a create and an edit both need it. */
async function programmeAnswers(formData: FormData) {
  const name = requiredText(formData, "name", fieldLabel("name"));
  const durationMonths = requiredNumber(formData, "durationMonths", fieldLabel("durationMonths"));
  if (durationMonths < 1) throw new FieldError(fieldErrors.number(fieldLabel("durationMonths")));

  const departmentId = requiredText(formData, "departmentId", fieldLabel("departmentId"));
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!department) throw new FieldError(fieldErrors.choice(fieldLabel("departmentId")));

  const body = await codedChoice("programBody", requiredText(formData, "bodyId", fieldLabel("bodyId")), fieldLabel("bodyId"));
  const type = await codedChoice("programType", requiredText(formData, "typeId", fieldLabel("typeId")), fieldLabel("typeId"));
  const cadenceId = await cadenceChoice(requiredText(formData, "cadenceId", fieldLabel("cadenceId")), fieldLabel("cadenceId"));
  const minKcseGrade = enumField(formData, "minKcseGrade", GRADES, fieldLabel("minKcseGrade"));
  const structure = enumField(formData, "structure", STRUCTURES, fieldLabel("structure"));

  return {
    name,
    durationMonths: Math.round(durationMonths),
    departmentId: department.id,
    body,
    type,
    cadenceId,
    minKcseGrade,
    structure,
    description: text(formData, "description"),
  };
}

/**
 * The two documents belong to the programme itself, so they arrive on the same form. They
 * are read before anything is written: a file with nowhere to go must not leave a half-saved
 * programme behind.
 */
async function programmeDocuments(formData: FormData) {
  const curriculum = await fileField(formData, "curriculum", fieldLabel("curriculum"), "pdf");
  const feeStructure = await fileField(formData, "feeStructure", fieldLabel("feeStructure"), "pdf");
  assertStorageFor([curriculum, feeStructure]);

  return { curriculum, feeStructure };
}

/** The stored path is named after the programme, so this runs once the row exists. */
async function saveProgrammeDocuments(
  programId: string,
  documents: Awaited<ReturnType<typeof programmeDocuments>>,
) {
  const data: { curriculumUrl?: string; feeStructureUrl?: string } = {};
  if (documents.curriculum) data.curriculumUrl = await putFile(documents.curriculum, "curricula", programId);
  if (documents.feeStructure) data.feeStructureUrl = await putFile(documents.feeStructure, "fee-structures", programId);
  if (data.curriculumUrl || data.feeStructureUrl) {
    await prisma.program.update({ where: { id: programId }, data });
  }
}

/**
 * The code is built from the body, the type and a serial of their own, so the
 * administrator never types one and two campuses cannot collide.
 */
export async function createProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const answers = await programmeAnswers(formData);
    const documents = await programmeDocuments(formData);

    // A super admin is not pinned to one campus, so what they add is college-wide.
    const campuses =
      scope.campusId === null ? await prisma.campus.findMany({ select: { id: true } }) : [{ id: scope.campusId }];

    const code = await nextProgramCode(answers.body.code, answers.type.code, answers.body.id, answers.type.id);

    const program = await prisma.program.create({
      data: {
        code,
        name: answers.name,
        department: { connect: { id: answers.departmentId } },
        body: { connect: { id: answers.body.id } },
        type: { connect: { id: answers.type.id } },
        cadence: { connect: { id: answers.cadenceId } },
        minKcseGrade: answers.minKcseGrade,
        durationMonths: answers.durationMonths,
        structure: answers.structure,
        description: answers.description,
        campuses: { connect: campuses },
      },
      select: { id: true },
    });

    await saveProgrammeDocuments(program.id, documents);

    // Choosing a payment type and a duration is only half of setting a programme up; the
    // amounts are entered on the fee screen, so the administrator lands there next.
    redirect(`/dashboard/programs/${program.id}/fees`);
  });
}

/**
 * Everything about a programme can be corrected here, including the body and the payment
 * type it was filed under. The issued code is deliberately not rewritten: it already sits on
 * printed offers and fee notes, and a second one would not be recognisable to anyone holding
 * that paper.
 */
export async function updateProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.edit.title);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const program = await knownProgram(programId, scope.campusId);
    const answers = await programmeAnswers(formData);
    const documents = await programmeDocuments(formData);

    // Period keys are stored on each placed unit, so the structure cannot change underneath
    // them without silently detaching the unit plan. It is locked once units exist.
    const existing = await prisma.program.findUnique({
      where: { id: program.id },
      select: { structure: true, _count: { select: { units: true } } },
    });
    if (
      existing &&
      existing.structure !== answers.structure &&
      existing._count.units > 0
    ) {
      throw new FieldError(copy.edit.structureLocked);
    }

    await prisma.program.update({
      where: { id: program.id },
      data: {
        name: answers.name,
        departmentId: answers.departmentId,
        bodyId: answers.body.id,
        typeId: answers.type.id,
        cadenceId: answers.cadenceId,
        minKcseGrade: answers.minKcseGrade,
        durationMonths: answers.durationMonths,
        structure: answers.structure,
        description: answers.description,
      },
    });

    await saveProgrammeDocuments(program.id, documents);
  });
}

/**
 * Archiving is the safe exit. The programme stops taking new admissions, but its enrolments,
 * results, attachments and bills stay exactly where they are and remain reportable.
 *
 * It is refused while students are still studying, because they need the programme to stay
 * active for them; completed cohorts can be archived.
 */
export async function archiveProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.archive.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const program = await knownProgram(programId, scope.campusId);
    if (program.archivedAt) return;

    const counts = await lifecycleCounts(prisma, program.id);
    if (archiveRefusal(counts) === "active") {
      throw new FieldError(copy.archive.blocked(counts.activeEnrollments));
    }

    await prisma.program.update({
      where: { id: program.id },
      data: { archivedAt: new Date(), archivedReason: text(formData, "reason") },
    });
  });
}

/**
 * Permanent deletion is only for a programme that nothing has ever been recorded against.
 *
 * Enrolments, applications, exams, timetables, cards, invoices and payments are historical
 * records, so any of them sends the administrator to Archiving instead. Nothing here cascades
 * through a student's academic or financial history.
 */
export async function deleteProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const program = await knownProgram(programId, scope.campusId);

    const counts = await lifecycleCounts(prisma, program.id);
    const refusal = deletionRefusal(counts);

    if (refusal === "active") throw new FieldError(copy.remove.active(counts.activeEnrollments));
    if (refusal === "history") throw new FieldError(copy.remove.history);

    await prisma.program.delete({ where: { id: program.id } });
  });
}

/** Every row of the fee form arrives as its own parallel list, in the order it is drawn. */
function column(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((value) => String(value ?? "").trim());
}

/**
 * Publishes a new version of a programme's fee structure.
 *
 * The previous version is retired rather than edited, so an enrolled student keeps the
 * amounts their invoices were written from. Enrolments made after this point pick up the
 * new version.
 */
export async function saveProgramFeePlan(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.feePlan.title);
  const feesPath = `/dashboard/programs/${programId}/fees`;

  return onSave(feesPath, ["/dashboard/programs", feesPath, "/dashboard"], async () => {
    const program = await knownProgram(programId, scope.campusId);

    const cadenceId = requiredText(formData, "cadenceId", copy.feePlan.cadence);
    const cadence = await prisma.feeCadence.findUnique({ where: { id: cadenceId }, select: { id: true } });
    if (!cadence) throw new FieldError(fieldErrors.choice(copy.feePlan.cadence));

    const durationMonths = requiredNumber(formData, "durationMonths", copy.feePlan.duration);
    if (durationMonths < 1) throw new FieldError(fieldErrors.number(copy.feePlan.duration));

    const labels = column(formData, "periodLabel");
    const amounts = column(formData, "periodAmount");
    const years = column(formData, "periodYear");
    const semesters = column(formData, "periodSemester");
    const offsets = column(formData, "periodOffset");

    if (labels.length === 0) throw new FieldError(copy.feePlan.noPeriods);
    if (amounts.length !== labels.length) throw new FieldError(copy.feePlan.noPeriods);

    const periods = labels.map((label, index) => {
      const amount = Number(String(amounts[index] ?? "").replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount < 0) {
        throw new FieldError(fieldErrors.number(`${label} ${copy.feePlan.amount}`));
      }
      const yearIndex = Number(years[index]);
      const semesterNo = Number(semesters[index]);
      const offset = Number(offsets[index]);

      return {
        label: label || copy.feePlan.periodFallback(index + 1),
        amount,
        yearIndex: Number.isFinite(yearIndex) && yearIndex > 0 ? Math.round(yearIndex) : null,
        semesterNo: Number.isFinite(semesterNo) && semesterNo > 0 ? Math.round(semesterNo) : null,
        dueOffsetDays: Number.isFinite(offset) && offset > 0 ? Math.round(offset) : 0,
      };
    });

    const total = periods.reduce((sum, period) => sum + period.amount, 0);
    if (total <= 0) throw new FieldError(copy.feePlan.zeroTotal);

    await prisma.$transaction(async (tx) => {
      const last = await tx.programFeePlan.findFirst({
        where: { programId: program.id },
        orderBy: { version: "desc" },
        select: { version: true },
      });

      const version = (last?.version ?? 0) + 1;

      // Retired first: the partial unique index allows one active version per programme.
      await tx.programFeePlan.updateMany({
        where: { programId: program.id, isActive: true },
        data: { isActive: false },
      });

      const plan = await tx.programFeePlan.create({
        data: {
          programId: program.id,
          version,
          cadenceId: cadence.id,
          durationMonths: Math.round(durationMonths),
          totalAmount: total,
          note: text(formData, "note"),
          isActive: true,
        },
        select: { id: true },
      });

      await tx.feeItem.createMany({
        data: periods.map((period, index) => ({
          programId: program.id,
          planId: plan.id,
          sequence: index + 1,
          label: period.label,
          amount: period.amount,
          yearIndex: period.yearIndex,
          semesterNo: period.semesterNo,
          dueOffsetDays: period.dueOffsetDays,
          isOptional: false,
        })),
      });
    });
  });
}

/** Short codes are the letters on every programme code, so they are stored upper-case. */
function registryCode(value: string, label: string) {
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!code) throw new FieldError(fieldErrors.choice(label));

  return code;
}

export async function createProgramBody(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryFieldLabel("bodies", "name"));
    const code = registryCode(
      requiredText(formData, "code", registryFieldLabel("bodies", "code")),
      registryFieldLabel("bodies", "code"),
    );

    await unique(registryFieldLabel("bodies", "name"), () => prisma.programBody.create({ data: { name, code } }));
  });
}

export async function updateProgramBody(formData: FormData) {
  await requireCollegeAdmin();
  const bodyId = hiddenId(formData, "bodyId", settings.bodies.edit.title);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryEditLabel("bodies", "name"));
    const code = registryCode(
      requiredText(formData, "code", registryEditLabel("bodies", "code")),
      registryEditLabel("bodies", "code"),
    );

    const known = await prisma.programBody.findUnique({ where: { id: bodyId }, select: { id: true } });
    if (!known) throw new FieldError(fieldErrors.choice(settings.bodies.heading));

    await unique(settings.bodies.edit.title, () => prisma.programBody.update({ where: { id: bodyId }, data: { name, code } }));
  });
}

export async function deleteProgramBody(formData: FormData) {
  await requireCollegeAdmin();
  const bodyId = hiddenId(formData, "bodyId", settings.bodies.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const known = await prisma.programBody.findUnique({
      where: { id: bodyId },
      select: { id: true, _count: { select: { programs: true } } },
    });
    if (!known) throw new FieldError(fieldErrors.choice(settings.bodies.heading));

    await refuseWhenUsed(
      settings.bodies.remove.blocked,
      async () => known._count.programs > 0,
      () => prisma.programBody.delete({ where: { id: known.id } }),
    );
  });
}

export async function createProgramType(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryFieldLabel("types", "name"));
    const code = registryCode(
      requiredText(formData, "code", registryFieldLabel("types", "code")),
      registryFieldLabel("types", "code"),
    );

    await unique(registryFieldLabel("types", "name"), () => prisma.programType.create({ data: { name, code } }));
  });
}

export async function updateProgramType(formData: FormData) {
  await requireCollegeAdmin();
  const typeId = hiddenId(formData, "typeId", settings.types.edit.title);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryEditLabel("types", "name"));
    const code = registryCode(
      requiredText(formData, "code", registryEditLabel("types", "code")),
      registryEditLabel("types", "code"),
    );

    const known = await prisma.programType.findUnique({ where: { id: typeId }, select: { id: true } });
    if (!known) throw new FieldError(fieldErrors.choice(settings.types.heading));

    await unique(settings.types.edit.title, () => prisma.programType.update({ where: { id: typeId }, data: { name, code } }));
  });
}

export async function deleteProgramType(formData: FormData) {
  await requireCollegeAdmin();
  const typeId = hiddenId(formData, "typeId", settings.types.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const known = await prisma.programType.findUnique({
      where: { id: typeId },
      select: { id: true, _count: { select: { programs: true } } },
    });
    if (!known) throw new FieldError(fieldErrors.choice(settings.types.heading));

    await refuseWhenUsed(
      settings.types.remove.blocked,
      async () => known._count.programs > 0,
      () => prisma.programType.delete({ where: { id: known.id } }),
    );
  });
}

export async function createFeeCadence(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryFieldLabel("cadences", "name"));
    const kind = enumField(formData, "kind", FEE_KINDS, registryFieldLabel("cadences", "kind"));

    await unique(registryFieldLabel("cadences", "name"), () =>
      prisma.feeCadence.create({ data: { name, kind } }),
    );
  });
}

/**
 * Renaming a payment type rewrites the one row, so every programme using it follows
 * without touching the programmes themselves.
 */
export async function updateFeeCadence(formData: FormData) {
  await requireCollegeAdmin();
  const cadenceId = hiddenId(formData, "cadenceId", settings.cadences.edit.title);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", registryEditLabel("cadences", "name"));
    const kind = enumField(formData, "kind", FEE_KINDS, registryEditLabel("cadences", "kind"));

    const known = await prisma.feeCadence.findUnique({ where: { id: cadenceId }, select: { id: true } });
    if (!known) throw new FieldError(fieldErrors.choice(settings.cadences.heading));

    // The kind only decides how *future* plans are generated; plans already published keep
    // the period rows they were saved with.
    await unique(settings.cadences.edit.title, () =>
      prisma.feeCadence.update({ where: { id: cadenceId }, data: { name, kind } }),
    );
  });
}

export async function deleteFeeCadence(formData: FormData) {
  await requireCollegeAdmin();
  const cadenceId = hiddenId(formData, "cadenceId", settings.cadences.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const known = await prisma.feeCadence.findUnique({
      where: { id: cadenceId },
      select: { id: true, _count: { select: { programs: true, plans: true } } },
    });
    if (!known) throw new FieldError(fieldErrors.choice(settings.cadences.heading));

    // A published fee plan also pins the payment type, even when no programme row still
    // points at it, so both counts have to clear before the delete is attempted.
    await refuseWhenUsed(
      settings.cadences.remove.blocked,
      async () => known._count.programs > 0 || known._count.plans > 0,
      () => prisma.feeCadence.delete({ where: { id: known.id } }),
    );
  });
}

/** The department form's only field is also called `name`, so it needs its own lookup. */
const departmentFieldLabel = (name: string) =>
  copy.departments.create.fields.find((field) => field.name === name)?.label ?? name;

export async function createDepartment(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", departmentFieldLabel("name"));

    await unique(departmentFieldLabel("name"), () => prisma.department.create({ data: { name } }));
  });
}
