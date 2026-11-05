-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('CAT', 'END_TERM');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "type" "ExamType" NOT NULL DEFAULT 'CAT';
