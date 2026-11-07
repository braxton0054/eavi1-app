"use server";

import { EnrollmentStatus, Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { storageConfigured, uploadFile } from "@/lib/storage";
import { genderValues } from "@/lib/content/apply";
import { fieldErrors } from "@/lib/content/dashboard";
import {
  FieldError,
  dateField,
  enumField,
  nextAdmissionNo,
  nextInvoiceNumbers,
  onSave,
  passwordField,
  phoneField,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";
import { registerEnrolmentUnits } from "@/lib/academics/registration";

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
      where: { id: programId, archivedAt: null, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    const intakeId = text(formData, "intakeId");
    const admissionNoInput = text(formData, "admissionNo");
    const genderRaw = text(formData, "gender");
    const gender = genderRaw === null ? null : enumField(formData, "gender", genderValues, "Gender");
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

    // The fee schedule is known before the write begins, so the invoice numbers for the
    // whole programme can be reserved without one query per period inside the transaction.
    const plan = await activePlanFor(programId);
    const invoiceNumbers = await nextInvoiceNumbers(plan?.periods.length ?? 0);
    const intake = intakeId
      ? await prisma.intake.findUnique({ where: { id: intakeId }, select: { commenceAt: true } })
      : null;
    const startDate = intake?.commenceAt ?? new Date();

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

      const enrollment = await tx.enrollment.create({
        data: {
          studentId: profile.id,
          programId,
          intakeId: intakeId ?? null,
          campusId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true },
      });

      // The student's fee obligations are written in the same transaction as the enrolment,
      // so an admitted student never exists without the bills their programme implies.
      await generateFeeSchedule(tx, {
        studentId: profile.id,
        enrollmentId: enrollment.id,
        campusId,
        programId,
        startDate,
        numbers: invoiceNumbers,
      });

      // Every unit of the programme is recorded, with the first period opened, and one
      // attachment record per stage. The profile can then show what is behind and ahead.
      await registerEnrolmentUnits(tx, {
        enrollmentId: enrollment.id,
        studentId: profile.id,
        programId,
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