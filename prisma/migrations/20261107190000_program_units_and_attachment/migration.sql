-- Programmes gain a delivery structure, a unit plan and optional industrial attachment
-- stages. A unit is defined once and placed into a programme as a separate row, so reusing
-- Communication Skills in two semesters does not duplicate the unit or its results.
--
-- History is never cascaded from a student: student_units and student_attachments go when
-- the enrolment does, not when a programme is edited. Programme deletion is therefore only
-- allowed once nothing depends on the programme, which the action layer enforces.

BEGIN;

CREATE TYPE "ProgramStructure" AS ENUM ('SEMESTER', 'MONTHLY', 'MODULE', 'CUSTOM');
CREATE TYPE "UnitStatus" AS ENUM ('NOT_STARTED', 'REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DEFERRED');
CREATE TYPE "AttachmentStatus" AS ENUM ('NOT_ELIGIBLE', 'ELIGIBLE', 'ATTACHED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DEFERRED');

ALTER TABLE "programs" ADD COLUMN "structure" "ProgramStructure" NOT NULL DEFAULT 'SEMESTER';
ALTER TABLE "programs" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "programs" ADD COLUMN "archivedReason" TEXT;

CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

CREATE TABLE "program_modules" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "durationMonths" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "assessmentNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "program_modules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "program_modules_programId_code_key" ON "program_modules"("programId", "code");
CREATE INDEX "program_modules_programId_sequence_idx" ON "program_modules"("programId", "sequence");

CREATE TABLE "program_units" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "moduleId" TEXT,
    "periodKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "yearIndex" INTEGER,
    "semesterNo" INTEGER,
    "monthIndex" INTEGER,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "isCore" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "program_units_pkey" PRIMARY KEY ("id")
);

-- The same unit may appear in several periods (different periodKey) but never twice in one.
CREATE UNIQUE INDEX "program_units_programId_unitId_periodKey_key"
    ON "program_units"("programId", "unitId", "periodKey");
CREATE INDEX "program_units_programId_periodKey_idx" ON "program_units"("programId", "periodKey");

CREATE TABLE "student_units" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "programUnitId" TEXT NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "score" DECIMAL(6,2),
    "maxScore" DECIMAL(6,2),
    "grade" TEXT,
    "remark" TEXT,
    "registeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_units_enrollmentId_programUnitId_key"
    ON "student_units"("enrollmentId", "programUnitId");
CREATE INDEX "student_units_enrollmentId_status_idx" ON "student_units"("enrollmentId", "status");

CREATE TABLE "attachment_requirements" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "afterYearIndex" INTEGER,
    "afterSemesterNo" INTEGER,
    "afterMonthIndex" INTEGER,
    "afterAllPeriods" BOOLEAN NOT NULL DEFAULT false,
    "durationWeeks" INTEGER,
    "durationMonths" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "prerequisiteNote" TEXT,
    "assessmentNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attachment_requirements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "attachment_requirements_programId_sequence_key"
    ON "attachment_requirements"("programId", "sequence");
CREATE INDEX "attachment_requirements_programId_idx" ON "attachment_requirements"("programId");

CREATE TABLE "student_attachments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "status" "AttachmentStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
    "hostOrganization" TEXT,
    "supervisorName" TEXT,
    "supervisorPhone" TEXT,
    "supervisorEmail" TEXT,
    "startDate" TIMESTAMP(3),
    "expectedEndDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assessmentNote" TEXT,
    "grade" TEXT,
    "remark" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_attachments_enrollmentId_requirementId_key"
    ON "student_attachments"("enrollmentId", "requirementId");
CREATE INDEX "student_attachments_studentId_status_idx" ON "student_attachments"("studentId", "status");

ALTER TABLE "program_modules" ADD CONSTRAINT "program_modules_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "program_units" ADD CONSTRAINT "program_units_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_units" ADD CONSTRAINT "program_units_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "program_units" ADD CONSTRAINT "program_units_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "program_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_units" ADD CONSTRAINT "student_units_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_units" ADD CONSTRAINT "student_units_programUnitId_fkey"
    FOREIGN KEY ("programUnitId") REFERENCES "program_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attachment_requirements" ADD CONSTRAINT "attachment_requirements_programId_fkey"
    FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_attachments" ADD CONSTRAINT "student_attachments_requirementId_fkey"
    FOREIGN KEY ("requirementId") REFERENCES "attachment_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
