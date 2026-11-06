"use server";

import { EntryGrade } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { storageConfigured, uploadFile } from "@/lib/storage";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  enumField,
  hiddenId,
  nextProgramCode,
  onSave,
  requiredNumber,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const GRADES = Object.keys(EntryGrade) as (keyof typeof EntryGrade)[];

const copy = pages.programs;
const fieldLabel = (name: string) => copy.create.fields.find((field) => field.name === name)?.label ?? name;
const registryFieldLabel = (section: "bodies" | "types" | "cadences", name: string) =>
  copy.settings[section].create.fields.find((field) => field.name === name)?.label ?? name;

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

/**
 * The code is built from the body, the type and a serial of their own, so the
 * administrator never types one and two campuses cannot collide.
 */
export async function createProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", fieldLabel("name"));
    const durationMonths = requiredNumber(formData, "durationMonths", fieldLabel("durationMonths"));
    if (durationMonths < 1) throw new FieldError(fieldErrors.number(fieldLabel("durationMonths")));

    const departmentId = requiredText(formData, "departmentId", fieldLabel("departmentId"));
    const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!department) throw new FieldError(fieldErrors.choice(fieldLabel("departmentId")));

    const body = await codedChoice("programBody", requiredText(formData, "bodyId", fieldLabel("bodyId")), fieldLabel("bodyId"));
    const type = await codedChoice("programType", requiredText(formData, "typeId", fieldLabel("typeId")), fieldLabel("typeId"));
    const cadenceId = await cadenceChoice(
      requiredText(formData, "cadenceId", fieldLabel("cadenceId")),
      fieldLabel("cadenceId"),
    );

    const minKcseGrade = enumField(formData, "minKcseGrade", GRADES, fieldLabel("minKcseGrade"));

    // A super admin is not pinned to one campus, so what they add is college-wide.
    const campuses =
      scope.campusId === null ? await prisma.campus.findMany({ select: { id: true } }) : [{ id: scope.campusId }];

    const code = await nextProgramCode(body.code, type.code, body.id, type.id);

    await prisma.program.create({
      data: {
        code,
        name,
        department: { connect: { id: department.id } },
        body: { connect: { id: body.id } },
        type: { connect: { id: type.id } },
        cadence: { connect: { id: cadenceId } },
        minKcseGrade,
        durationMonths: Math.round(durationMonths),
        description: text(formData, "description"),
        campuses: { connect: campuses },
      },
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
export async function renameFeeCadence(formData: FormData) {
  await requireCollegeAdmin();
  const cadenceId = hiddenId(formData, "cadenceId", copy.settings.cadences.rename.title);

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const name = requiredText(formData, "name", copy.settings.cadences.rename.fields[0]?.label ?? "Name");

    const known = await prisma.feeCadence.findUnique({ where: { id: cadenceId }, select: { id: true } });
    if (!known) throw new FieldError(fieldErrors.choice(copy.settings.cadences.rename.title));

    await unique(copy.settings.cadences.rename.title, () =>
      prisma.feeCadence.update({ where: { id: cadenceId }, data: { name } }),
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

export async function uploadCurriculum(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", ["/dashboard/programs"], async () => {
    const programId = String(formData.get("programId") ?? "");
    const file = formData.get("curriculum") as File | null;

    if (!programId || !file || file.size === 0) {
      throw new FieldError("Missing programme or file.");
    }

    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: scope.campusId ? { some: { id: scope.campusId } } : undefined },
      select: { id: true, code: true },
    });
    if (!program) throw new FieldError("Programme not available on your account.");

    if (!storageConfigured()) throw new FieldError("File storage is not configured.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `curricula/${program.id}/${Date.now()}-${safeName}`;
    const url = await uploadFile(key, buffer, file.type || "application/octet-stream");

    await prisma.program.update({ where: { id: program.id }, data: { curriculumUrl: url } });
  });
}

export async function uploadFeeStructure(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", ["/dashboard/programs"], async () => {
    const programId = String(formData.get("programId") ?? "");
    const file = formData.get("feeStructure") as File | null;

    if (!programId || !file || file.size === 0) {
      throw new FieldError("Missing programme or file.");
    }

    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: scope.campusId ? { some: { id: scope.campusId } } : undefined },
      select: { id: true, code: true },
    });
    if (!program) throw new FieldError("Programme not available on your account.");

    if (!storageConfigured()) throw new FieldError("File storage is not configured.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `fee-structures/${program.id}/${Date.now()}-${safeName}`;
    const url = await uploadFile(key, buffer, file.type || "application/pdf");

    await prisma.program.update({ where: { id: program.id }, data: { feeStructureUrl: url } });
  });
}
