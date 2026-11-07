-- CreateEnum
CREATE TYPE "OfficialIntake" AS ENUM ('JANUARY', 'MAY', 'SEPTEMBER');

-- CreateEnum
CREATE TYPE "ClassStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "admissionDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "academic_classes" (
    "id" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "programId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "intakeMonth" "OfficialIntake" NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "status" "ClassStatus" NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "ambient" TEXT DEFAULT 'purple',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_memberships" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "class_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_campusId_createdAt_idx" ON "audit_logs"("campusId", "createdAt");

-- AddForeignKey
ALTER TABLE "academic_classes" ADD CONSTRAINT "academic_classes_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_classes" ADD CONSTRAINT "academic_classes_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_classes" ADD CONSTRAINT "academic_classes_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "intakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_classId_fkey" FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EAVI runs exactly three intakes a year. Admissions happen every month, but a student is
-- always placed in January, May or September, so an intake record for any other month is a
-- mistake rather than a valid row. Enforced here so no client or script can create one.
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_official_month_check"
  CHECK ("month" IN (1, 5, 9));

-- A student belongs to at most ONE class at a time. Every path in the app maintains this
-- (the merge closes before it reopens, a move closes the old row), but the rule is a fact
-- about the data rather than a convention, so it is enforced here too: a partial index on
-- open memberships makes a second one impossible.
CREATE UNIQUE INDEX "class_memberships_one_open_per_enrollment"
  ON "class_memberships" ("enrollmentId")
  WHERE "leftAt" IS NULL;
