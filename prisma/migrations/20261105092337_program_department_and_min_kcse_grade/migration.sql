/*
  Warnings:

  - Added the required column `department` to the `programs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minKcseGrade` to the `programs` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "department" TEXT NOT NULL,
ADD COLUMN     "minKcseGrade" "EntryGrade" NOT NULL;
