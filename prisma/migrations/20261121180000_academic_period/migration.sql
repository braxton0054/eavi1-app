-- Collapse `semesters` and `intakes` into one `academic_periods` table.
--
-- The two tables described the same thing — a dated window a campus runs — with different keys
-- (semester number vs admission month) and an optional link between them. In practice campuses
-- ended up with one populated and the other empty: three campuses had intakes and no semesters,
-- one had a semester and no intakes, and eight of nine intakes were unlinked. Classes hung off
-- the intake, invoices hung off the semester, so neither side alone could run the college.
--
-- The college runs three intakes a year and each one IS the start of a period, so they become
-- one row. This migration preserves every existing row: a semester and an intake for the same
-- campus, year and month merge into a single period rather than colliding, and every foreign
-- key that pointed at either table is repointed before the old tables are dropped.

-- CreateEnum
CREATE TYPE "AcademicPeriodStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "academic_periods" (
    "id" TEXT NOT NULL,
    "campusId" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "applicationDeadline" TIMESTAMP(3) NOT NULL,
    "status" "AcademicPeriodStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_periods_pkey" PRIMARY KEY ("id")
);

-- The three intake months, enforced by the database so no December cohort can exist to
-- confuse every picker downstream.
ALTER TABLE "academic_periods"
    ADD CONSTRAINT "academic_periods_month_is_an_intake"
    CHECK ("month" IN (1, 5, 9));

-- An applicant cannot apply to a cohort that has already begun.
ALTER TABLE "academic_periods"
    ADD CONSTRAINT "academic_periods_deadline_before_start"
    CHECK ("applicationDeadline" <= "startsAt");

-- A period cannot end before it begins.
ALTER TABLE "academic_periods"
    ADD CONSTRAINT "academic_periods_ends_after_start"
    CHECK ("endsAt" > "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "academic_periods_campusId_year_month_key"
    ON "academic_periods"("campusId", "year", "month");

-- CreateIndex
CREATE INDEX "academic_periods_campusId_startsAt_idx"
    ON "academic_periods"("campusId", "startsAt");

-- AddForeignKey
ALTER TABLE "academic_periods"
    ADD CONSTRAINT "academic_periods_campusId_fkey"
    FOREIGN KEY ("campusId") REFERENCES "campuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Backfill from `semesters`.
--
-- The period id is carried over from the semester id so the dependent rows below can be
-- repointed by a plain join rather than by matching on dates. Semester number maps to the
-- intake month it always meant: 1st semester opens in January, 2nd in May, 3rd in September.
-- A semester had no application deadline, so it inherits its own start date, which is the
-- latest date the new constraint permits and is truthful: that period is already running.
-- The name is derived rather than copied, so the old "Semester 1 · 2026" and "May intake" and
-- "May intake 2026" spellings cannot survive into one list.
-- ---------------------------------------------------------------------------
INSERT INTO "academic_periods" (
    "id", "campusId", "year", "month", "sequence", "name",
    "startsAt", "endsAt", "applicationDeadline", "status", "createdAt", "updatedAt"
)
SELECT
    s."id",
    s."campusId",
    s."year",
    CASE s."semesterNo" WHEN 1 THEN 1 WHEN 2 THEN 5 WHEN 3 THEN 9 END,
    s."semesterNo",
    (CASE s."semesterNo" WHEN 1 THEN 'January' WHEN 2 THEN 'May' WHEN 3 THEN 'September' END)
        || ' intake ' || s."year",
    s."startDate",
    s."endDate",
    s."startDate",
    s."status"::text::"AcademicPeriodStatus",
    s."createdAt",
    s."updatedAt"
FROM "semesters" s
WHERE s."semesterNo" IN (1, 2, 3)
  AND s."endDate" > s."startDate";

-- ---------------------------------------------------------------------------
-- Backfill from `intakes`, but only where no semester has already claimed that campus, year
-- and month. Where both existed, the semester row wins because that is the one invoices,
-- exams and timetable slots already point at — its id has to stay put. The intake's own rows
-- are repointed onto the surviving period further down.
-- ---------------------------------------------------------------------------
INSERT INTO "academic_periods" (
    "id", "campusId", "year", "month", "sequence", "name",
    "startsAt", "endsAt", "applicationDeadline", "status", "createdAt", "updatedAt"
)
SELECT
    i."id",
    i."campusId",
    i."year",
    i."month",
    CASE i."month" WHEN 1 THEN 1 WHEN 5 THEN 2 ELSE 3 END,
    (CASE i."month" WHEN 1 THEN 'January' WHEN 5 THEN 'May' ELSE 'September' END)
        || ' intake ' || i."year",
    i."startsAt",
    COALESCE(i."endsAt", i."startsAt" + INTERVAL '4 months'),
    LEAST(i."applicationDeadline", i."startsAt"),
    'PLANNED',
    NOW(),
    NOW()
FROM "intakes" i
WHERE i."month" IN (1, 5, 9)
  AND NOT EXISTS (
      SELECT 1 FROM "academic_periods" p
      WHERE p."campusId" = i."campusId" AND p."year" = i."year" AND p."month" = i."month"
  );

-- ---------------------------------------------------------------------------
-- Repoint every dependent row.
--
-- Each dependent is matched through the row it used to point at, so the mapping is exact even
-- where a semester and an intake merged into one period.
-- ---------------------------------------------------------------------------

-- enrollments.intakeId -> periodId
ALTER TABLE "enrollments" ADD COLUMN "periodId" TEXT;
UPDATE "enrollments" e
SET "periodId" = p."id"
FROM "intakes" i
JOIN "academic_periods" p
  ON p."campusId" = i."campusId" AND p."year" = i."year" AND p."month" = i."month"
WHERE e."intakeId" = i."id";

-- academic_classes.intakeId -> periodId
ALTER TABLE "academic_classes" ADD COLUMN "periodId" TEXT;
UPDATE "academic_classes" c
SET "periodId" = p."id"
FROM "intakes" i
JOIN "academic_periods" p
  ON p."campusId" = i."campusId" AND p."year" = i."year" AND p."month" = i."month"
WHERE c."intakeId" = i."id";

-- invoices / fee_items / exams / timetable_slots / calendar_events: semesterId -> periodId
ALTER TABLE "invoices" ADD COLUMN "periodId" TEXT;
UPDATE "invoices" t SET "periodId" = t."semesterId" WHERE t."semesterId" IS NOT NULL;

ALTER TABLE "fee_items" ADD COLUMN "periodId" TEXT;
UPDATE "fee_items" t SET "periodId" = t."semesterId" WHERE t."semesterId" IS NOT NULL;

ALTER TABLE "exams" ADD COLUMN "periodId" TEXT;
UPDATE "exams" t SET "periodId" = t."semesterId" WHERE t."semesterId" IS NOT NULL;

ALTER TABLE "timetable_slots" ADD COLUMN "periodId" TEXT;
UPDATE "timetable_slots" t SET "periodId" = t."semesterId" WHERE t."semesterId" IS NOT NULL;

ALTER TABLE "calendar_events" ADD COLUMN "periodId" TEXT;
UPDATE "calendar_events" t SET "periodId" = t."semesterId" WHERE t."semesterId" IS NOT NULL;

-- An enrolment must belong to a period. Anything that failed to map means the row pointed at
-- an intake outside the three official months, which the old code already refused to create.
-- Fail loudly here rather than let a null through into a NOT NULL column.
DO $$
DECLARE orphaned INTEGER;
BEGIN
    SELECT count(*) INTO orphaned FROM "enrollments" WHERE "periodId" IS NULL;
    IF orphaned > 0 THEN
        RAISE EXCEPTION 'Cannot merge periods: % enrolment(s) point at an intake that could not be mapped', orphaned;
    END IF;
    SELECT count(*) INTO orphaned FROM "academic_classes" WHERE "periodId" IS NULL;
    IF orphaned > 0 THEN
        RAISE EXCEPTION 'Cannot merge periods: % class(es) point at an intake that could not be mapped', orphaned;
    END IF;
END $$;

-- Enforce the new shape.
ALTER TABLE "enrollments" ALTER COLUMN "periodId" SET NOT NULL;
ALTER TABLE "academic_classes" ALTER COLUMN "periodId" SET NOT NULL;

-- DropIndex (old unique and indexes keyed on intakeId)
DROP INDEX "academic_classes_campusId_programId_intakeId_name_key";
DROP INDEX "academic_classes_intakeId_idx";
DROP INDEX "academic_classes_programId_intakeId_year_idx";
DROP INDEX "enrollments_intakeId_yearIndex_semesterNo_idx";

-- CreateIndex
CREATE UNIQUE INDEX "academic_classes_campusId_programId_periodId_name_key"
    ON "academic_classes"("campusId", "programId", "periodId", "name");

-- CreateIndex
CREATE INDEX "academic_classes_periodId_idx" ON "academic_classes"("periodId");

-- CreateIndex
CREATE INDEX "academic_classes_programId_periodId_year_idx"
    ON "academic_classes"("programId", "periodId", "year");

-- CreateIndex
CREATE INDEX "enrollments_periodId_yearIndex_semesterNo_idx"
    ON "enrollments"("periodId", "yearIndex", "semesterNo");

-- AddForeignKey
ALTER TABLE "enrollments"
    ADD CONSTRAINT "enrollments_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_classes"
    ADD CONSTRAINT "academic_classes_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fee_items"
    ADD CONSTRAINT "fee_items_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams"
    ADD CONSTRAINT "exams_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots"
    ADD CONSTRAINT "timetable_slots_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events"
    ADD CONSTRAINT "calendar_events_periodId_fkey"
    FOREIGN KEY ("periodId") REFERENCES "academic_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DropForeignKey (old)
ALTER TABLE "academic_classes" DROP CONSTRAINT "academic_classes_intakeId_fkey";
ALTER TABLE "calendar_events" DROP CONSTRAINT "calendar_events_semesterId_fkey";
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_intakeId_fkey";
ALTER TABLE "exams" DROP CONSTRAINT "exams_semesterId_fkey";
ALTER TABLE "fee_items" DROP CONSTRAINT "fee_items_semesterId_fkey";
ALTER TABLE "intakes" DROP CONSTRAINT "intakes_semesterId_fkey";
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_semesterId_fkey";
ALTER TABLE "timetable_slots" DROP CONSTRAINT "timetable_slots_semesterId_fkey";
ALTER TABLE "intakes" DROP CONSTRAINT "intakes_campusId_fkey";
ALTER TABLE "semesters" DROP CONSTRAINT "semesters_campusId_fkey";

-- DropColumn (old foreign keys and the redundant denormalised intake month)
ALTER TABLE "academic_classes" DROP COLUMN "intakeId", DROP COLUMN "intakeMonth";
ALTER TABLE "calendar_events" DROP COLUMN "semesterId";
ALTER TABLE "enrollments" DROP COLUMN "intakeId";
ALTER TABLE "exams" DROP COLUMN "semesterId";
ALTER TABLE "fee_items" DROP COLUMN "semesterId";
ALTER TABLE "invoices" DROP COLUMN "semesterId";
ALTER TABLE "timetable_slots" DROP COLUMN "semesterId";

-- DropTable
DROP TABLE "intakes";
DROP TABLE "semesters";

-- DropEnum
DROP TYPE "SemesterStatus";
DROP TYPE "OfficialIntake";
