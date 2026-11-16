-- CreateEnum
CREATE TYPE "CardBatchStatus" AS ENUM ('PENDING', 'COMPLETE', 'FAILED');

-- AlterTable
ALTER TABLE "card_batches" ADD COLUMN "status" "CardBatchStatus" NOT NULL DEFAULT 'COMPLETE';
