"use server";

import { EnrollmentStatus, Gender, Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { storageConfigured, uploadFile } from "@/lib/storage";
import { fieldErrors } from "@/lib/content/dashboard";
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

const GENDERS = Object.keys(Gender) as (keyof typeof Gender)[];

async function maybeUpload(file: FormDataEntryValue | null, folder: string, keySeed: string) {
  if (!file || !(file instanceof File) || file.size === 0) return null;
  if (!storageConfigured()) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `${folder}/${keySeed}/${Date.now()}-${safeName}`;
  return uploadFile(key, buffer, file.type || "application/octet-stream");
}

function all(formData: FormData, name: string): string[] {
  return formData.getAll(name).map((v) => String(v ?? "").trim());
}

export async function enrolStudent(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/students", ["/dashboard/students", "/dashboard", "/dashboard/enrollments"], async () => {
    const applicationId = String(formData.get("applicationId") ?? "");
    if (!applicationId) throw new FieldError("Application is required.");

    const application = await prisma.application.findFirst({
      where: { id: applicationId, ...(scope.campusId ? { campusId: scope.campusId } : {}) },
      include: { program: { select: { id: true } } },
    });
    if (!application) throw new FieldError("Application not found.");

    const existing = await prisma.studentProfile.findUnique({ where: { applicationId } });
    if (existing) throw new FieldError("This application has already been enrolled.");

    const campusId = scope.campusId ?? application.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const fullName = requiredText(formData, "fullName", "Full name");
    const emailRaw = String(formData.get("email") ?? "").trim();
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (!email) throw new FieldError(fieldErrors.required("Email"));
    const phone = phoneField(formData, "phone", "Phone");
    const password = passwordField(formData, "password", "Temporary password");

    const programId = requiredText(formData, "programId", "Programme");
    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    const intakeId = text(formData, "intakeId");
    const admissionNoInput = text(formData, "admissionNo");
    const genderRaw = text(formData, "gender");
    const gender = genderRaw === null ? null : enumField(formData, "gender", GENDERS, "Gender");
    const dateOfBirth = dateField(formData, "dateOfBirth");
    const nationalId = text(formData, "nationalId");

    const primarySchool = text(formData, "primarySchool");
    const secondarySchool = text(formData, "secondarySchool");
    const medicalInfo = text(formData, "medicalInfo");
    const hasNoMedical = formData.get("hasNoMedicalConditions") === "yes";
    const admissionCategory = text(formData, "admissionCategory");
    const previousInstitution = text(formData, "previousInstitution");

    const issuedAdmissionNo = admissionNoInput ?? (await nextAdmissionNo());
    const passwordHash = await hashPassword(password);

    const profilePhotoUrl = await maybeUpload(formData.get("profilePhoto"), "profile-photos", applicationId);
    const birthCertificateUrl = await maybeUpload(formData.get("birthCertificate"), "birth-certificates", applicationId);
    const primarySchoolDocUrl = await maybeUpload(formData.get("primarySchoolDoc"), "school-docs", applicationId);
    const secondarySchoolDocUrl = await maybeUpload(formData.get("secondarySchoolDoc"), "school-docs", applicationId);

    await prisma.$transaction(async (tx) => {
      const user = await unique("Email", () =>
        tx.user.create({
          data: {
            email: email.toLowerCase(),
            fullName,
            phone,
            passwordHash,
            role: Role.STUDENT,
            status: Status.ACTIVE,
            mustChangePassword: true,
            campusId,
          },
          select: { id: true },
        }),
      );

      const profile = await unique("Admission number", () =>
        tx.studentProfile.create({
          data: {
            userId: user.id,
            admissionNo: issuedAdmissionNo,
            campusId,
            gender,
            dateOfBirth,
            nationalId,
            address: [text(formData, "addressCounty"), text(formData, "addressSubCounty"), text(formData, "addressDetail")].filter(Boolean).join(", ") || null,
            primarySchool,
            secondarySchool,
            primarySchoolDocUrl,
            secondarySchoolDocUrl,
            birthCertificateUrl,
            medicalInfo,
            hasNoMedicalConditions: hasNoMedical,
            profilePhotoUrl,
            admissionCategory,
            previousInstitution,
            applicationId,
          },
          select: { id: true },
        }),
      );

      await tx.enrollment.create({
        data: {
          studentId: profile.id,
          programId,
          intakeId: intakeId ?? null,
          campusId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      // Parent/guardians (multiple)
      const gNames = all(formData, "guardianFullName");
      const gRels = all(formData, "guardianRelationship");
      const gPhones = all(formData, "guardianPhone");
      const gAltPhones = all(formData, "guardianAltPhone");
      const gEmails = all(formData, "guardianEmail");
      const gOccs = all(formData, "guardianOccupation");
      const gCounties = all(formData, "guardianCounty");
      const gSubs = all(formData, "guardianSubCounty");
      const gDetails = all(formData, "guardianDetail");
      for (let i = 0; i < gNames.length; i++) {
        if (!gNames[i]) continue;
        await tx.parentGuardian.create({
          data: {
            studentId: profile.id,
            fullName: gNames[i],
            relationship: gRels[i] || "Guardian",
            phone: gPhones[i] || null,
            altPhone: gAltPhones[i] || null,
            email: gEmails[i] || null,
            occupation: gOccs[i] || null,
            address: [gCounties[i], gSubs[i], gDetails[i]].filter(Boolean).join(", ") || null,
          },
        });
      }

      // Emergency contacts (multiple)
      const eNames = all(formData, "emergencyFullName");
      const eRels = all(formData, "emergencyRelationship");
      const ePhones = all(formData, "emergencyPhone");
      const eAltPhones = all(formData, "emergencyAltPhone");
      const eCounties = all(formData, "emergencyCounty");
      const eSubs = all(formData, "emergencySubCounty");
      const eDetails = all(formData, "emergencyDetail");
      for (let i = 0; i < eNames.length; i++) {
        if (!eNames[i] || !ePhones[i]) continue;
        await tx.emergencyContact.create({
          data: {
            studentId: profile.id,
            fullName: eNames[i],
            relationship: eRels[i] || "Emergency",
            phone: ePhones[i],
            altPhone: eAltPhones[i] || null,
            address: [eCounties[i], eSubs[i], eDetails[i]].filter(Boolean).join(", ") || null,
          },
        });
      }
    });
  });
}