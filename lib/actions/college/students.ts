"use server";

import { EnrollmentStatus, Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { touchStudent } from "@/lib/documents/service";
import { requireCollegeAdmin } from "@/lib/session";
import { genderValues } from "@/lib/content/apply";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertPhotoDimensions,
  assertStorageFor,
  dateField,
  emailField,
  fileField,
  hiddenId,
  enumField,
  nextAdmissionNo,
  onSave,
  passwordField,
  phoneField,
  putFile,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";

const fieldLabel = (name: string) =>
  pages.students.create.fields.find((field) => field.name === name)?.label ?? name;

/** The roster, the overview counters and the enrolment screen all read this. */
const AFFECTED = ["/dashboard/students", "/dashboard", "/dashboard/enrollments"];

/**
 * Replaces a student's photograph after enrolment.
 *
 * The card and record are saved documents: this write marks both stale, and the worker
 * puts the new photograph into them. Nobody has to regenerate a card by hand.
 */
export async function updateStudentPhoto(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const studentId = hiddenId(formData, "studentId", "Student");
  const student = await prisma.studentProfile.findFirst({
    where: { id: studentId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
    select: { id: true, userId: true },
  });
  if (!student) throw new FieldError(fieldErrors.notOnCampus);

  const file = await fileField(formData, "photo", "Photograph", "image", false);
  const path = `/dashboard/students/${studentId}`;
  return onSave(path, [...AFFECTED, path], async () => {
    assertStorageFor([file]);
    await assertPhotoDimensions(file, "Photograph");
    const url = await putFile(file, "profile-photos", student.userId);
    await prisma.studentProfile.update({ where: { id: student.id }, data: { profilePhotoUrl: url } });
    await touchStudent(student.id);
  });
}

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
      const intake = await prisma.academicPeriod.findUnique({
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
        // A register entry without a chosen cohort joins the earliest college-wide period,
        // so every enrolment counts its semesters from a real intake date.
        const intake =
          intakeId ??
          (
            await prisma.academicPeriod.findFirst({
              orderBy: { startsAt: "asc" },
              select: { id: true },
            })
          )?.id ??
          null;

        await tx.enrollment.create({
          data: {
            studentId: profile.id,
            programId,
            periodId: intake!,
            campusId,
            yearIndex: 1,
            semesterNo: 1,
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
    });
  });
}
