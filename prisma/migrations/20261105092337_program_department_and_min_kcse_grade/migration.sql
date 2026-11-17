/*
  Warnings:

  - Added the required column `department` to the `programs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minKcseGrade` to the `programs` table without a default value. This is not possible if the table is not empty.

*/
-- Adds the minimum KCSE grade a programme admits on.
--
-- This migration originally also added a required `department` text column; that design
-- was replaced twenty minutes later by the `departments` table and `programs.departmentId`
-- (20261105094500), so the column is deliberately not created here.
-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "minKcseGrade" "EntryGrade" NOT NULL;
