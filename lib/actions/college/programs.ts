"use server";

import { EntryGrade, FeeFrequency, ProgramLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  enumField,
  onSave,
  requiredNumber,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const LEVELS = Object.keys(ProgramLevel) as (keyof typeof ProgramLevel)[];
const GRADES = Object.keys(EntryGrade) as (keyof typeof EntryGrade)[];
const FREQUENCIES = Object.keys(FeeFrequency) as (keyof typeof FeeFrequency)[];

const fieldLabel = (name: string) =>
  pages.programs.create.fields.find((field) => field.name === name)?.label ?? name;

/** The programme list, the overview counters and the enrolment screen all read this. */
const AFFECTED = ["/dashboard/programs", "/dashboard", "/dashboard/enrollments"];

export async function createProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const code = requiredText(formData, "code", fieldLabel("code"));
    const name = requiredText(formData, "name", fieldLabel("name"));
    const departmentId = requiredText(formData, "departmentId", fieldLabel("departmentId"));
    const level = enumField(formData, "level", LEVELS, fieldLabel("level"));
    const minKcseGrade = enumField(formData, "minKcseGrade", GRADES, fieldLabel("minKcseGrade"));
    const feeFrequency = enumField(formData, "feeFrequency", FREQUENCIES, fieldLabel("feeFrequency"));
    const durationMonths = requiredNumber(formData, "durationMonths", fieldLabel("durationMonths"));
    if (durationMonths < 1) throw new FieldError(fieldErrors.number(fieldLabel("durationMonths")));

    // The id arrives from a dropdown, so prove it still names a real department.
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new FieldError(fieldErrors.choice(fieldLabel("departmentId")));

    // A super admin is not pinned to one campus, so what they add is college-wide.
    const campuses =
      scope.campusId === null
        ? await prisma.campus.findMany({ select: { id: true } })
        : [{ id: scope.campusId }];

    await unique(fieldLabel("code"), () =>
      prisma.program.create({
        data: {
          code: code.toUpperCase(),
          name,
          department: { connect: { id: department.id } },
          level,
          minKcseGrade,
          feeFrequency,
          durationMonths: Math.round(durationMonths),
          description: text(formData, "description"),
          campuses: { connect: campuses },
        },
      }),
    );
  });
}

/** The department form's only field is also called `name`, so it needs its own lookup. */
const departmentFieldLabel = (name: string) =>
  pages.programs.departments.create.fields.find((field) => field.name === name)?.label ?? name;

export async function createDepartment(formData: FormData) {
  await requireCollegeAdmin();

  return onSave("/dashboard/programs", ["/dashboard/programs"], async () => {
    const name = requiredText(formData, "name", departmentFieldLabel("name"));

    await unique(departmentFieldLabel("name"), () => prisma.department.create({ data: { name } }));
  });
}
