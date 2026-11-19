"use server";

import { requireCollegeAdmin } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertPhotoDimensions,
  assertStorageFor,
  emailField,
  fileField,
  onSave,
  passwordField,
  putFile,
  requiredText,
  unique,
} from "@/lib/actions/college/_shared";

const copy = pages.profile;

const photoLabel = copy.photo.fields[0].label;
const emailLabel = copy.email.fields[0].label;
const currentLabel = copy.password.fields[0].label;
const newLabel = copy.password.fields[1].label;
const confirmLabel = copy.password.fields[2].label;

/** The profile screen is the only page that reads these values, so only it needs refreshing. */
const AFFECTED = ["/dashboard/profile", "/dashboard"];

export async function saveProfilePhoto(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const file = await fileField(formData, "photo", photoLabel, "image", false);

  return onSave("/dashboard/profile", AFFECTED, async () => {
    assertStorageFor([file]);
    await assertPhotoDimensions(file, photoLabel);
    const url = await putFile(file, "staff-photos", scope.userId);
    await prisma.user.update({ where: { id: scope.userId }, data: { photoUrl: url } });
  });
}

export async function removeProfilePhoto() {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/profile", AFFECTED, async () => {
    await prisma.user.update({ where: { id: scope.userId }, data: { photoUrl: null } });
  });
}

export async function changeEmail(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const email = emailField(formData, "email", emailLabel);

  return onSave("/dashboard/profile", AFFECTED, async () => {
    // The unique index on `users.email` is the only thing that can refuse this write.
    await unique(emailLabel, () =>
      prisma.user.update({ where: { id: scope.userId }, data: { email } }),
    );
  });
}

export async function changePassword(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const current = requiredText(formData, "currentPassword", currentLabel);
  const next = passwordField(formData, "password", newLabel);
  const confirm = requiredText(formData, "confirmPassword", confirmLabel);

  return onSave("/dashboard/profile", AFFECTED, async () => {
    if (next !== confirm) throw new FieldError(fieldErrors.passwordMismatch);

    const user = await prisma.user.findUnique({
      where: { id: scope.userId },
      select: { passwordHash: true },
    });
    if (!user || !(await verifyPassword(current, user.passwordHash))) {
      throw new FieldError(fieldErrors.currentPassword);
    }

    await prisma.user.update({
      where: { id: scope.userId },
      data: { passwordHash: await hashPassword(next) },
    });
  });
}
