-- AlterTable
ALTER TABLE "campuses" ADD COLUMN     "takesApplicants" BOOLEAN NOT NULL DEFAULT true;

-- The Town Office is an office: it registers people but teaches no course,
-- so it is taken out of the rotation that hands applicants a campus.
UPDATE "campuses" SET "takesApplicants" = false WHERE "code" = 'town';
