"use server";

import { EnrollmentStatus, Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { genderValues } from "@/lib/content/apply";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  emailField,
  enumField,
  nextAdmissionNo,
  onSave,
  passwordField,
  phoneField,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const fieldLabel = (name: string) =>
  pages.students.create.fields.find((field) => field.name === name)?.label ?? name;

/** The roster, the overview counters and the enrolment screen all read this. */
const AFFECTED = ["/dashboard/students", "/dashboard", "/dashboard/enrollments"];

export async function createStudent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/students", AFFECTED, async () => {
    // A super admin is not pinned to one campus, but a student profile always is, so a
    // campus-less administrator cannot register one from this form.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const fullName = requiredText(formData, "fullName", fieldLabel("fullName"));
    // The helper throws when this required field is empty; the guard only narrows the type.
    const email = emailField(formData, "email", fieldLabel("email"));
    if (!email) throw new FieldError(fieldErrors.required(fieldLabel("email")));
    const phone = phoneField(formData, "phone", fieldLabel("phone"));
    const password = passwordField(formData, "password", fieldLabel("password"));

    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    const intakeId = text(formData, "intakeId");
    if (intakeId) {
      const intake = await prisma.intake.findUnique({
        where: { id: intakeId },
        select: { id: true },
      });
      if (!intake) throw new FieldError(fieldErrors.choice(fieldLabel("intakeId")));
    }

    const admissionNo = text(formData, "admissionNo");
    const genderRaw = text(formData, "gender");
    const gender = genderRaw === null ? null : enumField(formData, "gender", genderValues, fieldLabel("gender"));
    const dateOfBirth = dateField(formData, "dateOfBirth");
    const nationalId = text(formData, "nationalId");
    const guardianName = text(formData, "guardianName");
    const guardianPhone = phoneField(formData, "guardianPhone", fieldLabel("guardianPhone"));
    const guardianEmail = emailField(formData, "guardianEmail", fieldLabel("guardianEmail"), true);
    const guardianAddress = text(formData, "address");

    // The blank-number case queries for a free code before the write begins.
    const issuedAdmissionNo = admissionNo ?? (await nextAdmissionNo());
    const passwordHash = await hashPassword(password);

    await prisma.$transaction(async (tx) => {
      const user = await unique(fieldLabel("email"), () =>
        tx.user.create({
          data: {
            email: email.toLowerCase(),
            fullName,
            phone,
            passwordHash,
            role: Role.STUDENT,
            status: Status.ACTIVE,
            campusId,
          },
          select: { id: true },
        }),
      );

      const profile = await unique(fieldLabel("admissionNo"), () =>
        tx.studentProfile.create({
          data: {
            userId: user.id,
            admissionNo: issuedAdmissionNo,
            campusId,
            gender,
            dateOfBirth,
            nationalId,
            guardianName,
            guardianPhone,
            guardianEmail,
            address: guardianAddress,
          },
          select: { id: true },
        }),
      );

      if (programId) {
        await tx.enrollment.create({
          data: {
            studentId: profile.id,
            programId,
            intakeId: intakeId ?? null,
            campusId,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    });
  });
}
