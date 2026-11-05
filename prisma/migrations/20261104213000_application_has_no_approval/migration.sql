-- An applicant stays an application until enrolment turns them into a student, so the
-- approval step, the student row it used to mint and the APPROVED status are gone.

-- DropForeignKey
ALTER TABLE "applications" DROP CONSTRAINT "applications_studentId_fkey";

-- AlterTable
ALTER TABLE "applications" DROP COLUMN "studentId";

-- Postgres cannot remove one value from an enum, so the type is rebuilt without APPROVED.
-- No row carried it, so nothing is lost by the swap.
CREATE TYPE "ApplicationStatus_new" AS ENUM ('SUBMITTED', 'REVIEWING', 'REJECTED', 'WITHDRAWN');

ALTER TABLE "applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "applications"
  ALTER COLUMN "status" TYPE "ApplicationStatus_new" USING "status"::text::"ApplicationStatus_new";
ALTER TABLE "applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

DROP TYPE "ApplicationStatus";
ALTER TYPE "ApplicationStatus_new" RENAME TO "ApplicationStatus";
