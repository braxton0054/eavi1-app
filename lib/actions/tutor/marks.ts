"use server";

import { prisma } from "@/lib/prisma";
import { requireTutor } from "@/lib/session";
import { fieldErrors, tutorPortal } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  hiddenId,
  onSave,
  requiredNumber,
  text,
} from "@/lib/actions/college/_shared";

const copy = tutorPortal.entry;

/** The marks list and the paper's own page are the only screens that show these rows. */
const AFFECTED = ["/tutor/marks", "/tutor"];

const examPath = (examId: string | null) => `/tutor/marks/${examId ?? ""}`;

/**
 * Records one mark. A tutor can only write to a paper they invigilate, and only for a student
 * enrolled on that paper's programme at that paper's campus.
 */
export async function tutorSaveGrade(formData: FormData) {
  const tutor = await requireTutor();
  const returnPath = examPath(text(formData, "examId"));

  return onSave(returnPath, [...AFFECTED, returnPath], async () => {
    const examId = hiddenId(formData, "examId", copy.back);
    const enrollmentId = hiddenId(formData, "enrollmentId", copy.columns[1].label);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, invigilatorId: tutor.tutorId },
      select: { id: true, campusId: true, programId: true },
    });
    if (!exam) throw new FieldError(fieldErrors.notOnCampus);

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      select: { id: true, campusId: true, programId: true },
    });
    if (
      !enrollment ||
      enrollment.programId !== exam.programId ||
      enrollment.campusId !== exam.campusId
    ) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    const score = requiredNumber(formData, "score", copy.fields[0].label);
    const maxScore = requiredNumber(formData, "maxScore", copy.fields[1].label);
    if (score > maxScore || maxScore < 0 || score < 0) {
      throw new FieldError(fieldErrors.number(copy.fields[0].label));
    }

    const grade = {
      score,
      maxScore,
      remark: text(formData, "remark"),
      published: checked(formData, "published"),
    };

    await prisma.grade.upsert({
      where: { examId_enrollmentId: { examId: exam.id, enrollmentId } },
      update: grade,
      create: { examId: exam.id, enrollmentId, ...grade },
    });
  });
}

/** Releases every mark on the paper to students; only the invigilator can do this. */
export async function tutorPublishAll(formData: FormData) {
  const tutor = await requireTutor();
  const returnPath = examPath(text(formData, "examId"));

  return onSave(returnPath, [...AFFECTED, returnPath], async () => {
    const examId = hiddenId(formData, "examId", copy.back);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, invigilatorId: tutor.tutorId },
      select: { id: true },
    });
    if (!exam) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.grade.updateMany({ where: { examId: exam.id }, data: { published: true } });
  });
}
