-- Saved documents: one row per document, with its source snapshot, rendered output and
-- the hash used to detect source changes. A second run of anything touching a document
-- updates the same row; it never creates a duplicate.
CREATE TABLE IF NOT EXISTS "generated_documents" (
  "id"         TEXT        NOT NULL,
  "kind"       TEXT        NOT NULL,
  "scopeKey"   TEXT        NOT NULL,
  "version"    INTEGER     NOT NULL DEFAULT 1,
  "sourceHash" TEXT        NOT NULL,
  "snapshot"   JSONB       NOT NULL,
  "svgText"    TEXT        NOT NULL,
  "storageUrl" TEXT,
  "fileName"   TEXT        NOT NULL,
  "status"     TEXT        NOT NULL DEFAULT 'CURRENT',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "generated_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "generated_documents_kind_scopeKey_key"
  ON "generated_documents"("kind", "scopeKey");
CREATE INDEX IF NOT EXISTS "generated_documents_status_idx"
  ON "generated_documents"("status");
