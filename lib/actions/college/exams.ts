"use server";

import { ExamStatus, ExamType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { notifyUsers } from "@/lib/notifications/service";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  enumField,
  hiddenId,
  numberField,
  onSave,
  requiredDate,
  requiredNumber,
  requiredText,
  text,
  timeField,
  periodFromForm,
} from "@/lib/actions/college/_shared";

const STATUSES = Object.keys(ExamStatus) as (keyof typeof ExamStatus)[];
const TYPES = Object.keys(ExamType) as (keyof typeof ExamType)[];

const copy = pages.exams;

const fieldLabel = (name: string) =>
  copy.create.fields.find((field) => field.name === name)?.label ??
  copy.grades.record.fields.find((field) => field.name === name)?.label ??
  name;

/** The paper list, the overview counters and the marks report all read this. */
const AFFECTED = ["/dashboard/exams", "/dashboard", "/dashboard/reports"];

/** A failed mark entry must bounce the administrator back to the paper, not the list. */
const examPath = (examId: string | null) =>
  examId ? `/dashboard/exams/${examId}` : "/dashboard/exams";

export async function createExam(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/exams", AFFECTED, async () => {
    // A paper is sat by one campus, so a campus-less super admin cannot schedule one.
    const campusId = scope.campusId;
    if (campusId === null) throw new FieldError(fieldErrors.notOnCampus);

    const title = requiredText(formData, "title", fieldLabel("title"));

    const programId = requiredText(formData, "programId", fieldLabel("programId"));
    const program = await prisma.program.findFirst({
      where: { id: programId, campuses: { some: { id: campusId } } },
      select: { id: true },
    });
    if (!program) throw new FieldError(fieldErrors.notOnCampus);

    // The paper is dated against the college's shared calendar; the paper itself stays on this campus.
    const periodId = await periodFromForm(formData, "periodId");

    const type = enumField(formData, "type", TYPES, fieldLabel("type"));
    const date = requiredDate(formData, "date", fieldLabel("date"));
    const startAt = timeField(formData, "startAt", fieldLabel("startAt"));
    // The helper throws when this required time is missing; the guard only narrows the type.
    if (!startAt) throw new FieldError(fieldErrors.required(fieldLabel("startAt")));

    const duration = numberField(formData, "durationMinutes", fieldLabel("durationMinutes"));
    const durationMinutes = duration === null ? 120 : Math.round(duration);
    if (durationMinutes < 1) {
      throw new FieldError(fieldErrors.number(fieldLabel("durationMinutes")));
    }

    const invigilatorId = text(formData, "invigilatorId");
    if (invigilatorId) {
      const invigilator = await prisma.tutorProfile.findFirst({
        where: { id: invigilatorId, campusId },
        select: { id: true },
      });
      if (!invigilator) throw new FieldError(fieldErrors.notOnCampus);
    }

    const status = enumField(formData, "status", STATUSES, fieldLabel("status"));

    await prisma.exam.create({
      data: {
        title,
        programId,
        campusId,
        periodId,
        invigilatorId: invigilatorId ?? null,
        date,
        startAt,
        durationMinutes,
        room: text(formData, "room"),
        type,
        status,
      },
    });
  });
}

export async function saveGrade(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const returnPath = examPath(text(formData, "examId"));

  return onSave(returnPath, [...AFFECTED, returnPath], async () => {
    const examId = hiddenId(formData, "examId", copy.title);
    const enrollmentId = hiddenId(formData, "enrollmentId", fieldLabel("enrollmentId"));

    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, campusId: true, programId: true },
    });
    if (!exam) throw new FieldError(fieldErrors.notOnCampus);

    // A mark may only land on an enrollment studying this paper's programme at this campus.
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

    const score = requiredNumber(formData, "score", fieldLabel("score"));
    const maxScore = requiredNumber(formData, "maxScore", fieldLabel("maxScore"));
    if (score > maxScore || maxScore < 0) {
      throw new FieldError(fieldErrors.number(fieldLabel("score")));
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

export async function publishAll(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const returnPath = examPath(text(formData, "examId"));

  return onSave(returnPath, [...AFFECTED, returnPath], async () => {
    const examId = hiddenId(formData, "examId", copy.title);

    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true, title: true },
    });
    if (!exam) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.grade.updateMany({ where: { examId: exam.id }, data: { published: true } });

    // Every student with a mark on this paper hears it once, as one batch. The link
    // opens the units screen, where a published mark is read.
    const graded = await prisma.grade.findMany({
      where: { examId: exam.id, published: true },
      select: { enrollment: { select: { student: { select: { userId: true } } } } },
      distinct: ["enrollmentId"],
    });
    await notifyUsers(
      graded.map((row) => row.enrollment.student.userId),
      {
        title: "Results published",
        body: `${exam.title} results are now available.`,
        notificationType: "result",
        targetUrl: "/student/units",
        dedupeKey: `results:exam:${exam.id}`,
      },
    );
  });
}

export async function setExamStatus(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const returnPath = examPath(text(formData, "examId"));

  return onSave(returnPath, [...AFFECTED, returnPath], async () => {
    const examId = hiddenId(formData, "examId", copy.title);
    const status = enumField(formData, "status", STATUSES, fieldLabel("status"));

    const exam = await prisma.exam.findFirst({
      where: { id: examId, ...(scope.campusId === null ? {} : { campusId: scope.campusId }) },
      select: { id: true },
    });
    if (!exam) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.exam.update({ where: { id: exam.id }, data: { status } });
  });
}
