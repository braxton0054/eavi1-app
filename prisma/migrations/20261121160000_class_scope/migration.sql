-- DropIndex
DROP INDEX "academic_classes_programId_name_key";

-- CreateIndex
CREATE INDEX "academic_classes_programId_intakeId_year_idx" ON "academic_classes"("programId", "intakeId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "academic_classes_campusId_programId_intakeId_name_key" ON "academic_classes"("campusId", "programId", "intakeId", "name");

