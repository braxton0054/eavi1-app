"use server";

import { EntryGrade } from "@/generated/prisma/enums";
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
import type { Field } from "@/lib/content/dashboard";

const GRADES = Object.keys(EntryGrade) as (keyof typeof EntryGrade)[];

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
    select: { id: true, code: true },
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

  return {
    name,
    durationMonths: Math.round(durationMonths),
    departmentId: department.id,
    body,
    type,
    cadenceId,
    minKcseGrade,
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
        description: answers.description,
        campuses: { connect: campuses },
      },
      select: { id: true },
    });

    await saveProgrammeDocuments(program.id, documents);
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
        description: answers.description,
      },
    });

    await saveProgrammeDocuments(program.id, documents);
  });
}

/**
 * Paperwork is the reason a programme cannot simply vanish: an application, an enrolment, an
 * exam, a bill or a timetable slot that stopped pointing at it would read as corrupt data.
 */
export async function deleteProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const program = await knownProgram(programId, scope.campusId);

    const counts = await Promise.all([
      prisma.application.count({ where: { programId: program.id } }),
      prisma.enrollment.count({ where: { programId: program.id } }),
      prisma.exam.count({ where: { programId: program.id } }),
      prisma.feeItem.count({ where: { programId: program.id } }),
      prisma.timetableSlot.count({ where: { programId: program.id } }),
    ]);

    await refuseWhenUsed(
      copy.remove.blocked,
      async () => counts.some((count) => count > 0),
      () => prisma.program.delete({ where: { id: program.id } }),
    );
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

    await unique(registryFieldLabel("cadences", "name"), () => prisma.feeCadence.create({ data: { name } }));
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

    const known = await prisma.feeCadence.findUnique({ where: { id: cadenceId }, select: { id: true } });
    if (!known) throw new FieldError(fieldErrors.choice(settings.cadences.heading));

    await unique(settings.cadences.edit.title, () =>
      prisma.feeCadence.update({ where: { id: cadenceId }, data: { name } }),
    );
  });
}

export async function deleteFeeCadence(formData: FormData) {
  await requireCollegeAdmin();
  const cadenceId = hiddenId(formData, "cadenceId", settings.cadences.remove.button);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const known = await prisma.feeCadence.findUnique({
      where: { id: cadenceId },
      select: { id: true, _count: { select: { programs: true } } },
    });
    if (!known) throw new FieldError(fieldErrors.choice(settings.cadences.heading));

    await refuseWhenUsed(
      settings.cadences.remove.blocked,
      async () => known._count.programs > 0,
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
