"use server";

import { randomUUID } from "node:crypto";

import { EnrollmentStatus, Role, Status } from "@/generated/prisma/enums";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { genderValues } from "@/lib/content/apply";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertStorageFor,
  dateField,
  enumField,
  nextAdmissionNo,
  nextCardSerial,
  nextInvoiceNumbers,
  onSave,
  passwordField,
  phoneField,
  putFile,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";
import { activePlanFor, generateFeeSchedule } from "@/lib/fees/schedule";
import { intakeValueForMonth, normaliseClassName } from "@/lib/academics/classes";
import { recordAudit } from "@/lib/academics/audit";
import { registerEnrolmentUnits } from "@/lib/academics/registration";
import { syncClassConversation } from "@/lib/chat/class-rooms";
import { expiryForProgram } from "@/lib/cards/validity";

/**
 * One of the enrolment's optional attachments.
 *
 * Returns null only when the applicant did not attach a file. A file that WAS attached is
 * uploaded or the whole enrolment fails: returning null on a storage error used to create a
 * student with a silently missing photograph, and the clerk had no way to know. The folder
 * and key seed place every attachment under one student's prefix in the bucket.
 */
async function maybeUpload(
  value: FormDataEntryValue | null,
  folder: string,
  keySeed: string,
): Promise<string | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  return putFile(value, folder, keySeed);
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

    /*
     * Checked before anything is created. A form carrying a photograph with nowhere to put
     * it must change nothing at all, rather than enrol a student whose picture quietly failed
     * to upload — the clerk would have no reason to look again.
     */
    assertStorageFor(
      ["profilePhoto", "birthCertificate", "primarySchoolDoc", "secondarySchoolDoc"]
        .map((name) => formData.get(name))
        .filter((value): value is File => value instanceof File && value.size > 0),
    );

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
      select: { id: true, durationMonths: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);
    const programDurationMonths = program.durationMonths;

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

    // Admissions run every month while intakes are only January, May and September, so the
    // date the student actually reported is recorded separately from the intake they join.
    //
    // No `?? new Date()` here: an omitted date is genuinely unknown, and defaulting it to
    // today is what stamped a January intake with a November date. The intake's own start is
    // the truthful fallback, applied once where the date is actually used.
    const admissionDate = dateField(formData, "admissionDate");

    // A class is a grouping. The placement below is the academic position, and the two are
    // recorded independently: a February joiner can sit in a January class at Semester 2.
    const classId = text(formData, "classId");
    const newClassNameRaw = text(formData, "newClassName");
    let stage = { yearIndex: 1, semesterNo: 1 };
    const stageValue = text(formData, "stage");
    if (stageValue) {
      const [yearRaw, semesterRaw] = stageValue.split(":");
      const yearIndex = Number(yearRaw);
      const semesterNo = Number(semesterRaw);
      if (Number.isInteger(yearIndex) && Number.isInteger(semesterNo) && yearIndex >= 1 && semesterNo >= 1) {
        stage = { yearIndex, semesterNo };
      }
    }

    const issuedAdmissionNo = admissionNoInput ?? (await nextAdmissionNo());
    const passwordHash = await hashPassword(password);

    // The fee schedule is known before the write begins, so the invoice numbers for the
    // whole programme can be reserved without one query per period inside the transaction.
    const plan = await activePlanFor(programId);
    const invoiceNumbers = await nextInvoiceNumbers(plan?.periods.length ?? 0);

    // The card serial is reserved outside the transaction for the same reason the invoice
    // numbers are: it counts rows globally rather than inside the transaction's view.
    const cardSerial = await nextCardSerial();
    const intake = intakeId
      ? await prisma.intake.findUnique({
          where: { id: intakeId },
          select: { id: true, campusId: true, startsAt: true, month: true, year: true },
        })
      : null;
    // The intake decides which semester the student is in and when their fees begin, so it
    // is required rather than guessed at: silently picking a cohort would put a student on
    // the wrong schedule.
    if (!intake) throw new FieldError(fieldErrors.required("Intake"));
    if (intake.campusId !== campusId) throw new FieldError(fieldErrors.notOnCampus);

    const startDate = intake.startsAt;

    // A class may be created inline during admission, so the office never has to leave the
    // form to set one up. It always belongs to this programme, campus and intake.
    const className = newClassNameRaw ? normaliseClassName(newClassNameRaw) : null;

    /*
     * A class is a cohort of ONE programme in ONE intake of ONE year, so all three are part of
     * what makes a class the right one. Filtering on the programme alone let a January student be
     * placed in the May class of the same programme by submitting that class's id, which is
     * exactly the kind of mix-up the intake exists to prevent — and it arrives silently, because
     * a January student sitting in a May class looks fine on every screen until the marks are
     * due. The intake and year are checked here, not only in the form that offered the choice.
     */
    let classRecord = classId
      ? await prisma.academicClass.findFirst({
          where: {
            id: classId,
            campusId,
            programId,
            intakeId: intake.id,
            year: intake.year,
            status: "ACTIVE",
          },
          select: { id: true, name: true, campusId: true },
        })
      : null;
    if (classId && !classRecord) throw new FieldError(fieldErrors.choice(pages.classes.fields.class));
    if (className) {
      /*
       * Scoped to this campus, programme and intake. Scoping to the programme alone meant a name
       * that already existed in a *different* intake was reused, so typing "ICT/JAN/2026" for a
       * May joiner could quietly enrol them into the January class.
       */
      const clash = await prisma.academicClass.findFirst({
        where: { programId, campusId, intakeId: intake.id, name: className },
        select: { id: true, campusId: true, name: true, status: true },
      });
      if (clash) {
        // An existing class of that name in this same intake is reused rather than duplicated.
        if (clash.status !== "ACTIVE") throw new FieldError(pages.classes.nameTaken);
        classRecord = { id: clash.id, name: clash.name, campusId: clash.campusId };
      } else {
        const created = await prisma.academicClass.create({
          data: {
            campusId,
            programId,
            intakeId: intake.id,
            intakeMonth: intakeValueForMonth(intake.month),
            year: intake.year,
            name: className,
          },
          select: { id: true, name: true, campusId: true },
        });
        classRecord = created;
        await recordAudit({
          campusId,
          actorId: scope.userId,
          actorEmail: scope.email,
          action: "class.create",
          entityType: "class",
          entityId: created.id,
          detail: { name: className, duringAdmission: true },
        });
      }
    }

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
            admissionDate,
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
          intakeId: intake.id,
          campusId,
          // The student's own starting stage, which they may have earned elsewhere. It is
          // never derived from the class they were put in.
          yearIndex: stage.yearIndex,
          semesterNo: stage.semesterNo,
          status: EnrollmentStatus.ACTIVE,
          /*
           * The day the student actually joined their cohort — their admission date, or the
           * intake's own start when no admission date was given.
           *
           * Leaving this to the column default stamped TODAY on a student who joined in
           * January, which made every bill anchored to their real intake look months overdue
           * on the day they registered. The intake decides where a student stands in their
           * studies, so it also decides when their first period fell due.
           */
          enrolledAt: admissionDate ?? startDate,
        },
        select: { id: true },
      });

      // Class membership is history, not a field: it is opened here and closed when the
      // student later moves, so the register can be read as it stood on any date.
      if (classRecord) {
        await tx.classMembership.create({
          data: {
            classId: classRecord.id,
            enrollmentId: enrollment.id,
            campusId,
            reason: "admitted",
            actorId: scope.userId,
          },
        });
      }

      // The student's fee obligations are written in the same transaction as the enrolment,
      // so an admitted student never exists without the bills their programme implies.
      await generateFeeSchedule(tx, {
        studentId: profile.id,
        enrollmentId: enrollment.id,
        campusId,
        programId,
        startDate,
        intakeId: intake.id,
        // Fees begin at the level the student was placed at, not at Year 1. Someone who
        // joins at Semester 3 studied the earlier periods elsewhere, at their own cost.
        from: stage,
        numbers: invoiceNumbers,
      });

      // Every unit of the programme is recorded, with the first period opened, and one
      // attachment record per stage. The profile can then show what is behind and ahead.
      await registerEnrolmentUnits(tx, {
        enrollmentId: enrollment.id,
        studentId: profile.id,
        programId,
      });

      // The card is issued in the same transaction, so an enrolled student always has one.
      // Its expiry follows the programme's duration from the intake, not a figure chosen
      // here, so the card is valid exactly as long as the student is enrolled.
      await tx.idCard.create({
        data: {
          serial: cardSerial,
          verifyToken: randomUUID(),
          studentId: profile.id,
          campusId,
          programId,
          status: "PENDING",
          expiresAt: expiryForProgram(startDate, programDurationMonths),
          remarks: pages.cards.create.autoRemark,
        },
        select: { id: true },
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

    /*
     * A newly admitted student joins their class's group chat straight away. The sync is outside
     * the transaction because it touches the conversation tables, and failing to add someone to a
     * chat must never roll back the enrolment that got them in.
     */
    if (classRecord) {
      await syncClassConversation(classRecord.id).catch(() => null);
    }
  });
}