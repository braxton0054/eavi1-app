/*
  Warnings:

  - Added the required column `feeFrequency` to the `programs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "FeeFrequency" AS ENUM ('SEMESTER', 'TERM', 'MODULE', 'MONTH');

-- AlterTable
ALTER TABLE "programs" ADD COLUMN     "feeFrequency" "FeeFrequency" NOT NULL;
