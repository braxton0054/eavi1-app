-- Make the programme catalogue and the academic calendar college-wide.
--
-- Campuses still own their people, classes, invoices and exam bookings, but a programme and an
-- intake are the same record everywhere. Previously a campus admin's new programme was linked
-- only to their own campus, and every campus kept its own copy of an intake. That made a shared
-- catalogue impossible and meant the same January intake had several ids to maintain.
--
-- Programmes: connect every existing programme to every campus. The application now does the
-- same for programmes and campuses created later.
INSERT INTO "_ProgramCampuses" ("A", "B")
SELECT c."id", p."id"
FROM "campuses" AS c
CROSS JOIN "programs" AS p
ON CONFLICT DO NOTHING;

-- Academic periods: keep one row per year/month and repoint every campus record at it. The
-- earliest window wins, so a duplicate that was edited later does not silently move a cohort.
-- A null campus id is now the marker for a college-wide period.
ALTER TABLE "academic_periods" ALTER COLUMN "campusId" DROP NOT NULL;

CREATE TEMP TABLE _shared_period_remap AS
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "year", "month" ORDER BY "startsAt" ASC, "id" ASC) AS "rank",
    FIRST_VALUE("id") OVER (PARTITION BY "year", "month" ORDER BY "startsAt" ASC, "id" ASC) AS "canonicalId"
  FROM "academic_periods"
)
SELECT "id" AS "duplicateId", "canonicalId"
FROM ranked
WHERE "rank" > 1;

UPDATE "enrollments" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "academic_classes" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "invoices" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "fee_items" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "exams" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "timetable_slots" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

UPDATE "calendar_events" AS t
SET "periodId" = r."canonicalId"
FROM _shared_period_remap AS r
WHERE t."periodId" = r."duplicateId";

DELETE FROM "academic_periods" AS p
USING _shared_period_remap AS r
WHERE p."id" = r."duplicateId";

DROP TABLE _shared_period_remap;

-- A null campus id now means the whole college. Entries attached to a shared period are college
-- calendar entries too, even if they were originally written against one campus's copy.
UPDATE "academic_periods" SET "campusId" = NULL;
UPDATE "calendar_events" SET "campusId" = NULL WHERE "periodId" IS NOT NULL;

DROP INDEX IF EXISTS "academic_periods_campusId_year_month_key";
DROP INDEX IF EXISTS "academic_periods_campusId_startsAt_idx";
CREATE UNIQUE INDEX IF NOT EXISTS "academic_periods_year_month_key"
  ON "academic_periods"("year", "month");
CREATE INDEX IF NOT EXISTS "academic_periods_startsAt_idx"
  ON "academic_periods"("startsAt");
