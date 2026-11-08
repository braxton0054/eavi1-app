-- CreateTable
CREATE TABLE "class_tutors" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,

    CONSTRAINT "class_tutors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "class_tutors_tutorId_idx" ON "class_tutors"("tutorId");

-- CreateIndex
CREATE UNIQUE INDEX "class_tutors_classId_tutorId_key" ON "class_tutors"("classId", "tutorId");

-- AddForeignKey
ALTER TABLE "class_tutors" ADD CONSTRAINT "class_tutors_classId_fkey" FOREIGN KEY ("classId") REFERENCES "academic_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_tutors" ADD CONSTRAINT "class_tutors_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

