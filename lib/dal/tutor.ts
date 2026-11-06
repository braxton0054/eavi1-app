/**
 * Every read for the tutor portal. Each getter resolves the tutor's teaching record first and
 * scopes its query to that record, so a tutor only ever sees their own classes and papers.
 */

import { prisma } from "@/lib/prisma";
import { requireTutor } from "@/lib/session";
import { timetableDays } from "@/lib/dal/college";

const DAY_KEYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;

function minutesBetween(start: string, end: string) {
  const [sh = 0, sm = 0] = start.split(":").map(Number);
  const [eh = 0, em = 0] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export async function getTutorToday() {
  const tutor = await requireTutor();
  const todayKey = DAY_KEYS[new Date().getDay()];

  const [slots, papers] = await Promise.all([
    prisma.timetableSlot.findMany({
      where: { tutorId: tutor.tutorId },
      orderBy: { startAt: "asc" },
      include: { program: { select: { name: true, code: true } } },
    }),
    prisma.exam.findMany({
      where: { invigilatorId: tutor.tutorId, date: { gte: startOfToday() } },
      orderBy: { date: "asc" },
      take: 5,
      include: { program: { select: { name: true, code: true } } },
    }),
  ]);

  return {
    tutor,
    todayKey,
    classes: slots.filter((slot) => slot.day === todayKey),
    papers,
  };
}

export async function getTutorTimetable() {
  const tutor = await requireTutor();
  const slots = await prisma.timetableSlot.findMany({
    where: { tutorId: tutor.tutorId },
    orderBy: [{ day: "asc" }, { startAt: "asc" }],
    include: { program: { select: { name: true, code: true } } },
  });

  const byDay = new Map<string, typeof slots>();
  for (const day of timetableDays) byDay.set(day, []);
  for (const slot of slots) byDay.get(slot.day)?.push(slot);

  return { byDay };
}

export async function getTutorExams() {
  const tutor = await requireTutor();
  return prisma.exam.findMany({
    where: { invigilatorId: tutor.tutorId },
    orderBy: { date: "desc" },
    include: {
      program: { select: { name: true, code: true } },
      _count: { select: { grades: true } },
    },
  });
}

/** Papers the tutor invigilates, each with how many students are on that programme. */
export async function getTutorMarkList() {
  const exams = await getTutorExams();

  return Promise.all(
    exams.map(async (exam) => ({
      ...exam,
      students: await prisma.enrollment.count({
        where: { programId: exam.programId, campusId: exam.campusId, status: "ACTIVE" },
      }),
    })),
  );
}

/** The paper and its roster. Returns null for any paper the tutor does not invigilate. */
export async function getTutorExamForMarks(examId: string) {
  const tutor = await requireTutor();

  const exam = await prisma.exam.findFirst({
    where: { id: examId, invigilatorId: tutor.tutorId },
    include: {
      program: { select: { id: true, name: true, code: true } },
      grades: { select: { enrollmentId: true, score: true, maxScore: true, remark: true, published: true } },
    },
  });
  if (!exam) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { programId: exam.programId, campusId: exam.campusId, status: "ACTIVE" },
    orderBy: { student: { admissionNo: "asc" } },
    include: {
      student: { select: { admissionNo: true, user: { select: { fullName: true } } } },
    },
  });

  const gradeByEnrollment = new Map(exam.grades.map((grade) => [grade.enrollmentId, grade]));

  return {
    exam,
    rows: enrollments.map((enrollment) => ({
      enrollmentId: enrollment.id,
      admissionNo: enrollment.student.admissionNo,
      fullName: enrollment.student.user.fullName,
      grade: gradeByEnrollment.get(enrollment.id) ?? null,
    })),
  };
}

export async function getTutorProfile() {
  const tutor = await requireTutor();

  const [profile, slots] = await Promise.all([
    prisma.tutorProfile.findUnique({
      where: { id: tutor.tutorId },
      include: {
        user: { select: { email: true } },
        campus: { select: { name: true } },
        programs: { select: { name: true, code: true } },
      },
    }),
    prisma.timetableSlot.findMany({
      where: { tutorId: tutor.tutorId },
      select: { startAt: true, endAt: true },
    }),
  ]);

  const weeklyHours = Number(
    (slots.reduce((sum, slot) => sum + minutesBetween(slot.startAt, slot.endAt), 0) / 60).toFixed(1),
  );

  return { profile, weeklyHours };
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}
