"use server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  hiddenId,
  onSave,
  phoneField,
  requiredText,
  unique,
} from "@/lib/actions/college/_shared";

const copy = pages.campuses;

const fieldLabel = (name: string) =>
  copy.create.fields.find((field) => field.name === name)?.label ??
  copy.edit.fields.find((field) => field.name === name)?.label ??
  name;

/** The campus register, every campus picker and the college overview all read this. */
const AFFECTED = ["/dashboard/campuses", "/dashboard", "/dashboard/scope"];

export async function createCampus(formData: FormData) {
  await requireSuperAdmin();

  return onSave("/dashboard/campuses", AFFECTED, async () => {
    const code = requiredText(formData, "code", fieldLabel("code")).toUpperCase();
    const name = requiredText(formData, "name", fieldLabel("name"));
    const place = requiredText(formData, "place", fieldLabel("place"));
    const phone = phoneField(formData, "phone", fieldLabel("phone"));

    await unique(fieldLabel("code"), () =>
      prisma.campus.create({
        data: { code, name, place, phone, takesApplicants: checked(formData, "takesApplicants") },
        select: { id: true },
      }),
    );
  });
}

export async function updateCampus(formData: FormData) {
  await requireSuperAdmin();

  return onSave("/dashboard/campuses", AFFECTED, async () => {
    const campusId = Number(hiddenId(formData, "campusId", copy.heading));
    if (!Number.isInteger(campusId)) throw new FieldError(fieldErrors.notOnCampus);

    const campus = await prisma.campus.findUnique({ where: { id: campusId }, select: { id: true } });
    if (!campus) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.campus.update({
      where: { id: campusId },
      data: {
        name: requiredText(formData, "name", fieldLabel("name")),
        place: requiredText(formData, "place", fieldLabel("place")),
        phone: phoneField(formData, "phone", fieldLabel("phone")),
        takesApplicants: checked(formData, "takesApplicants"),
      },
    });
  });
}
