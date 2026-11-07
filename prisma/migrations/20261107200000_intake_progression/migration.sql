-- Student progression belongs to the intake, not the campus calendar.
--
-- An Intake becomes the anchor for a cohort's academic life: its own campus, year, month and
-- start date, with the advertised calendar semester now optional and informational only. An
-- Enrollment records the cohort it joined through (now required) plus the student's own
-- (yearIndex, semesterNo), which starts at 1/1 for every intake. A May joiner is therefore in
-- their own Semester 1 in May while the January cohort is in its Semester 2.
--
-- The existing rows are backfilled from the semester each intake was advertised in, and
-- enrolled students without a cohort are attached to the earliest intake on their campus.

-- Intake: own identity, semester becomes informational.
ALTER TABLE "intakes" ADD COLUMN "campusId" INTEGER;
ALTER TABLE "intakes" ADD COLUMN "month" INTEGER;
ALTER TABLE "intakes" ADD COLUMN "startsAt" TIMESTAMP(3);
ALTER TABLE "intakes" ADD COLUMN "year" INTEGER;

UPDATE "intakes" i SET
  "campusId" = s."campusId",
  "year" = s."year",
  "month" = EXTRACT(MONTH FROM i."commenceAt")::int,
  "startsAt" = i."commenceAt"
FROM "semesters" s
WHERE s."id" = i."semesterId";

ALTER TABLE "intakes" ALTER COLUMN "campusId" SET NOT NULL;
ALTER TABLE "intakes" ALTER COLUMN "month" SET NOT NULL;
ALTER TABLE "intakes" ALTER COLUMN "startsAt" SET NOT NULL;
ALTER TABLE "intakes" ALTER COLUMN "year" SET NOT NULL;

ALTER TABLE "intakes" DROP CONSTRAINT "intakes_semesterId_fkey";
DROP INDEX "intakes_termId_name_key";
ALTER TABLE "intakes" ALTER COLUMN "semesterId" DROP NOT NULL;
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_semesterId_fkey"
  FOREIGN KEY ("semesterId") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "intakes_campusId_year_month_name_key" ON "intakes"("campusId", "year", "month", "name");
CREATE INDEX "intakes_campusId_startsAt_idx" ON "intakes"("campusId", "startsAt");
ALTER TABLE "intakes" ADD CONSTRAINT "intakes_campusId_fkey"
  FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enrollment: the cohort, and the student's own position in their programme.
ALTER TABLE "enrollments" ADD COLUMN "promotedAt" TIMESTAMP(3);
ALTER TABLE "enrollments" ADD COLUMN "semesterNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "enrollments" ADD COLUMN "yearIndex" INTEGER NOT NULL DEFAULT 1;

UPDATE "enrollments"
SET "intakeId" = (SELECT id FROM "intakes" ORDER BY "startsAt" LIMIT 1)
WHERE "intakeId" IS NULL;

ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_intakeId_fkey";
ALTER TABLE "enrollments" ALTER COLUMN "intakeId" SET NOT NULL;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_intakeId_fkey"
  FOREIGN KEY ("intakeId") REFERENCES "intakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "enrollments_intakeId_yearIndex_semesterNo_idx"
  ON "enrollments"("intakeId", "yearIndex", "semesterNo");

-- Housekeeping: index names Prisma expects, and indexes it no longer declares.
ALTER INDEX "terms_campusId_startDate_idx" RENAME TO "semesters_campusId_startDate_idx";
DROP INDEX "id_cards_templateId_idx";
DROP INDEX "programs_bodyId_fkey";
DROP INDEX "programs_cadenceId_fkey";
DROP INDEX "programs_departmentId_idx";
DROP INDEX "programs_typeId_fkey";
