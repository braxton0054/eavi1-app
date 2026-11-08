-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "admissionRequirements" TEXT,
ADD COLUMN     "bursaryFormUrl" TEXT;

-- CreateIndex
CREATE INDEX "academic_classes_campusId_year_status_idx" ON "academic_classes"("campusId", "year", "status");

-- CreateIndex
CREATE INDEX "academic_classes_intakeId_idx" ON "academic_classes"("intakeId");

-- CreateIndex
CREATE UNIQUE INDEX "academic_classes_programId_name_key" ON "academic_classes"("programId", "name");

-- CreateIndex
CREATE INDEX "class_memberships_enrollmentId_leftAt_idx" ON "class_memberships"("enrollmentId", "leftAt");

-- CreateIndex
CREATE INDEX "class_memberships_classId_leftAt_idx" ON "class_memberships"("classId", "leftAt");

