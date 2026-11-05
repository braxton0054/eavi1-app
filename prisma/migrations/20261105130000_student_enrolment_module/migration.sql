-- AlterTable users
ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable student_profiles
ALTER TABLE "student_profiles" ADD COLUMN "applicationId" TEXT UNIQUE;
ALTER TABLE "student_profiles" ADD COLUMN "primarySchool" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "secondarySchool" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "primarySchoolDocUrl" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "secondarySchoolDocUrl" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "birthCertificateUrl" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "medicalInfo" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "hasNoMedicalConditions" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "student_profiles" ADD COLUMN "profilePhotoUrl" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "admissionCategory" TEXT;
ALTER TABLE "student_profiles" ADD COLUMN "previousInstitution" TEXT;

-- AddForeignKey student_profiles -> applications
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable parent_guardians
CREATE TABLE "parent_guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "altPhone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "occupation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "parent_guardians_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "parent_guardians_studentId_idx" ON "parent_guardians"("studentId");
ALTER TABLE "parent_guardians" ADD CONSTRAINT "parent_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable emergency_contacts
CREATE TABLE "emergency_contacts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "emergency_contacts_studentId_idx" ON "emergency_contacts"("studentId");
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
