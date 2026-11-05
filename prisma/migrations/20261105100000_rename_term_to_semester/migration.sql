-- Rename enum type
ALTER TYPE "TermStatus" RENAME TO "SemesterStatus";

-- Rename terms table to semesters
ALTER TABLE "terms" RENAME TO "semesters";
ALTER TABLE "semesters" RENAME COLUMN "termNo" TO "semesterNo";

-- Rename unique constraint / index on semesters
ALTER INDEX "terms_campusId_year_termNo_key" RENAME TO "semesters_campusId_year_semesterNo_key";
ALTER INDEX "terms_pkey" RENAME TO "semesters_pkey";

-- Rename termId columns to semesterId across referencing tables
ALTER TABLE "intakes" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "calendar_events" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "timetable_slots" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "exams" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "fee_items" RENAME COLUMN "termId" TO "semesterId";
ALTER TABLE "invoices" RENAME COLUMN "termId" TO "semesterId";

-- Rename FK constraints (best effort)
DO $$ BEGIN
  ALTER TABLE "intakes" RENAME CONSTRAINT "intakes_termId_fkey" TO "intakes_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "calendar_events" RENAME CONSTRAINT "calendar_events_termId_fkey" TO "calendar_events_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "timetable_slots" RENAME CONSTRAINT "timetable_slots_termId_fkey" TO "timetable_slots_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "exams" RENAME CONSTRAINT "exams_termId_fkey" TO "exams_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "fee_items" RENAME CONSTRAINT "fee_items_termId_fkey" TO "fee_items_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "invoices" RENAME CONSTRAINT "invoices_termId_fkey" TO "invoices_semesterId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "semesters" RENAME CONSTRAINT "terms_campusId_fkey" TO "semesters_campusId_fkey";
EXCEPTION WHEN undefined_object THEN null;
END $$;
