-- A tutor can teach at both campuses. The profile keeps its primary campusId for the
-- sign-in account and existing scoping, and this join table records every campus the
-- super admin assigned the tutor to.
CREATE TABLE "_TutorCampuses" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TutorCampuses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TutorCampuses_B_index" ON "_TutorCampuses"("B");

-- AddForeignKey
ALTER TABLE "_TutorCampuses" ADD CONSTRAINT "_TutorCampuses_A_fkey" FOREIGN KEY ("A") REFERENCES "campuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_TutorCampuses" ADD CONSTRAINT "_TutorCampuses_B_fkey" FOREIGN KEY ("B") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing tutor keeps the campus they already had.
INSERT INTO "_TutorCampuses" ("A", "B")
SELECT "campusId", "id" FROM "tutor_profiles";
