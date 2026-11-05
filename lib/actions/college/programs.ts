"use server";

import { ProgramLevel } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  enumField,
  onSave,
  requiredNumber,
  requiredText,
  text,
  termOnCampus,
  unique,
} from "@/lib/actions/college/_shared";

const LEVELS = Object.keys(ProgramLevel) as (keyof typeof ProgramLevel)[];

const fieldLabel = (name: string) =>
  pages.programs.create.fields.find((field) => field.name === name)?.label ??
  pages.programs.feeItems.create.fields.find((field) => field.name === name)?.label ??
  name;

/** The programme list, the overview counters and the enrolment screen all read this. */
const AFFECTED = ["/dashboard/programs", "/dashboard", "/dashboard/enrollments"];

export async function createProgram(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", AFFECTED, async () => {
    const code = requiredText(formData, "code", fieldLabel("code"));
    const name = requiredText(formData, "name", fieldLabel("name"));
    const level = enumField(formData, "level", LEVELS, fieldLabel("level"));
    const durationMonths = requiredNumber(formData, "durationMonths", fieldLabel("durationMonths"));
    if (durationMonths < 1) throw new FieldError(fieldErrors.number(fieldLabel("durationMonths")));

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
          level,
          durationMonths: Math.round(durationMonths),
          description: text(formData, "description"),
          campuses: { connect: campuses },
        },
      }),
    );
  });
}

export async function createFeeItem(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/programs", ["/dashboard/programs"], async () => {
    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const itemLabel = requiredText(formData, "label", fieldLabel("label"));
    const amount = requiredNumber(formData, "amount", fieldLabel("amount"));
    if (amount < 0) throw new FieldError(fieldErrors.number(fieldLabel("amount")));

    const visible = await prisma.program.findFirst({
      where: {
        id: programId,
        ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
      },
      select: { id: true },
    });
    if (!visible) throw new FieldError(fieldErrors.notOnCampus);

    // A fee is tied to this campus's term, or to no term at all when left blank.
    const termId = await termOnCampus(formData, "termId", scope.campusId);

    await prisma.feeItem.create({
      data: {
        programId,
        termId,
        label: itemLabel,
        amount,
        isOptional: checked(formData, "isOptional"),
      },
    });
  });
}
