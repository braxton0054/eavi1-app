-- Query-level timing for the portal. This registers the view and functions; the db
-- service loads the library at boot so they actually collect data. Creating the
-- extension without preloading is harmless (the view stays empty), so migrations
-- remain safe on databases that do not set shared_preload_libraries.
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
