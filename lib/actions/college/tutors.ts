"use server";

import { Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  emailField,
  hiddenId,
  nextStaffNo,
  onSave,
  passwordField,
  phoneField,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const copy = pages.tutors;

const fieldLabel = (name: string) =>
  copy.create.fields.find((field) => field.name === name)?.label ?? name;

/** The tutor roster, the overview counters and the timetable all read this. */
const AFFECTED = ["/dashboard/tutors", "/dashboard", "/dashboard/timetable"];

export async function createTutor(formData: FormData) {
  const scope = await requireSuperAdmin();

  return onSave("/dashboard/tutors", AFFECTED, async () => {
    /*
     * The super admin picks one or both teaching campuses on the form. The sign-in account
     * keeps a primary campus (the first one picked), while the tutor profile is connected
     * to every selected campus so both offices see and can timetable the same tutor.
     */
    const postedIds = formData
      .getAll("campusIds")
      .map((value) => Number(String(value)))
      .filter((id) => Number.isInteger(id) && id > 0);
    const campuses = await prisma.campus.findMany({
      where: { id: { in: [...new Set(postedIds)] }, takesApplicants: true },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    if (campuses.length === 0) throw new FieldError(fieldErrors.required(fieldLabel("campusIds")));
    const campusId = campuses[0].id;

    const fullName = requiredText(formData, "fullName", fieldLabel("fullName"));
    // The helper throws when this required field is empty; the guard only narrows the type.
    const email = emailField(formData, "email", fieldLabel("email"));
    if (!email) throw new FieldError(fieldErrors.required(fieldLabel("email")));
    const phone = phoneField(formData, "phone", fieldLabel("phone"));
    // Hashed before the write begins: a weak password must cost no rows, and the key
    // derivation does not belong inside the database transaction.
    const passwordHash = await hashPassword(
      passwordField(formData, "password", fieldLabel("password")),
    );

    const staffNo = text(formData, "staffNo") ?? (await nextStaffNo());

    // One select value: the form asks for a single programme and more are added later.
    const programId = text(formData, "programIds");
    if (programId) {
      const program = await prisma.program.findFirst({
        where: { id: programId, campuses: { some: { id: campusId } } },
        select: { id: true },
      });
      if (!program) throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.$transaction(async (tx) => {
      const user = await unique(fieldLabel("email"), () =>
        tx.user.create({
          data: {
            email,
            fullName,
            phone,
            passwordHash,
            role: Role.TUTOR,
            status: Status.ACTIVE,
            mustChangePassword: true,
            campusId,
          },
          select: { id: true },
        }),
      );

      await unique(fieldLabel("staffNo"), () =>
        tx.tutorProfile.create({
          data: {
            userId: user.id,
            staffNo,
            campusId,
            title: text(formData, "title"),
            department: text(formData, "department"),
            programs: { connect: programId ? [{ id: programId }] : [] },
            campuses: { connect: campuses.map((campus) => ({ id: campus.id })) },
          },
        }),
      );
    });
  });
}

export async function approveTutor(formData: FormData) {
  const scope = await requireSuperAdmin();

  return onSave("/dashboard/tutors", AFFECTED, async () => {
    const tutorId = hiddenId(formData, "tutorId", copy.title);

    const tutor = await prisma.tutorProfile.findFirst({
      where: {
        id: tutorId,
        ...(scope.campusId === null ? {} : { campuses: { some: { id: scope.campusId } } }),
      },
      include: { user: { select: { id: true } } },
    });
    // A tutor connected to the scoped campus is theirs to approve, whichever campus is primary.
    if (!tutor) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.user.update({
      where: { id: tutor.user.id },
      data: { status: Status.ACTIVE },
    });
  });
}
