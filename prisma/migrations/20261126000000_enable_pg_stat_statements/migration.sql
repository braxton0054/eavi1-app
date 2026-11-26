-- Query-level timing for the portal. Managed databases often do not grant the
-- application user permission to create extensions, so this optional migration
-- succeeds without the extension when the server administrator has not enabled it.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_stat_statements is unavailable to this database user; continuing without it';
END $$;
