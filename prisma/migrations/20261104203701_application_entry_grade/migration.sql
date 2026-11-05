-- CreateEnum
CREATE TYPE "EntryGrade" AS ENUM ('A', 'A_MINUS', 'B_PLUS', 'B', 'B_MINUS', 'C_PLUS', 'C', 'C_MINUS', 'D_PLUS', 'D', 'D_MINUS', 'E');

-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "gender" "Gender",
ADD COLUMN     "grade" "EntryGrade",
ALTER COLUMN "email" DROP NOT NULL;
