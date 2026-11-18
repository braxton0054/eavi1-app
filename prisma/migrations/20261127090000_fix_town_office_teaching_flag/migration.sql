-- The Town Office handles paperwork; it is not a teaching campus and takes no applicants.
-- A stale flag on production left it flagged as a teaching campus, so the scope dropdown
-- and the applicant-assignment query (both filtered by takesApplicants: true) still offered
-- it. Correcting the data fixes every such picker at once; the record stays in campus
-- management, it just no longer appears where a teaching campus is required.
UPDATE "campuses" SET "takesApplicants" = false WHERE "code" = 'town';
