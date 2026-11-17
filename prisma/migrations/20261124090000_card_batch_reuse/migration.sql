-- Reusable card runs: the request's fingerprint and the rendered content's fingerprint.
--
-- actionHash resolves a repeated request (a double submit, or two officers printing one
-- class together) to the run already queued. contentHash lets an unchanged reprint reuse
-- the PDF already in object storage instead of rendering and uploading a second copy.
ALTER TABLE "card_batches" ADD COLUMN "actionHash" TEXT;
ALTER TABLE "card_batches" ADD COLUMN "contentHash" TEXT;

CREATE INDEX "card_batches_actionHash_createdAt_idx" ON "card_batches" ("actionHash", "createdAt");
CREATE INDEX "card_batches_contentHash_createdAt_idx" ON "card_batches" ("contentHash", "createdAt");
