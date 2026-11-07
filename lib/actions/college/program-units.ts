"use server";

import { UnitStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  enumField,
  hiddenId,
  numberField,
  onSave,
  requiredText,
  text,
  unique,
} from "@/lib/actions/college/_shared";
import {
  customPeriodKey,
  generatedPeriods,
  type Structure,
} from "@/lib/academics/structure";
import { planningSemesters } from "@/lib/academics/planning";
import { recordUnitResult as applyUnitResult, registerPeriod } from "@/lib/academics/registration";

const copy = pages.programs.unitPlan;

const STATUSES = Object.keys(UnitStatus) as (keyof typeof UnitStatus)[];

/** Any screen showing a programme's unit plan or a student's progress. */
const affected = (programId?: string, studentId?: string) => [
  "/dashboard/programs",
  programId ? `/dashboard/programs/${programId}` : "",
  programId ? `/dashboard/programs/${programId}/units` : "",
  studentId ? `/dashboard/students/${studentId}` : "",
  "/dashboard/students",
  "/dashboard/enrollments",
].filter(Boolean);

/** A programme the caller may touch: on their campus, or any when college-wide. */
async function scopedProgram(programId: string, campusId: number | null) {
  const program = await prisma.program.findFirst({
    where: {
      id: programId,
      ...(campusId === null ? {} : { campuses: { some: { id: campusId } } }),
    },
    select: { id: true, structure: true, durationMonths: true, archivedAt: true },
  });
  if (!program) throw new FieldError(fieldErrors.notOnCampus);
  return program;
}

export async function createUnit(formData: FormData) {
  await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    const code = requiredText(formData, "code", copy.unitCode).toUpperCase().replace(/\s+/g, "");
    const name = requiredText(formData, "name", copy.unitName);

    await unique(copy.unitCode, () =>
      prisma.unit.create({ data: { code, name, description: text(formData, "description") } }),
    );
  });
}

/**
 * Places a unit in one period of a programme. Periods are re-derived from the programme's own
 * structure rather than trusted from the form, so a placement can only name a real stage.
 */
export async function assignProgramUnit(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    const program = await scopedProgram(programId, scope.campusId);
    if (program.archivedAt) throw new FieldError(copy.archived);

    const unitId = requiredText(formData, "unitId", copy.unit);
    const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new FieldError(fieldErrors.choice(copy.unit));

    const structure = program.structure as Structure;
    const perYear = await planningSemesters(scope.campusId);

    let periodKey: string;
    let periodLabel: string;
    let yearIndex: number | null = null;
    let semesterNo: number | null = null;
    let monthIndex: number | null = null;
    let moduleId: string | null = null;

    if (structure === "MODULE") {
      moduleId = requiredText(formData, "moduleId", copy.module);
      const moduleRecord = await prisma.programModule.findFirst({
        where: { id: moduleId, programId: program.id },
        select: { id: true, name: true },
      });
      if (!moduleRecord) throw new FieldError(fieldErrors.choice(copy.module));
      periodKey = `MOD:${moduleRecord.id}`;
      periodLabel = moduleRecord.name;
    } else if (structure === "CUSTOM") {
      periodLabel = requiredText(formData, "customPeriod", copy.customPeriod);
      periodKey = customPeriodKey(periodLabel);
    } else {
      const periods = generatedPeriods(structure, program.durationMonths, perYear);
      const key = requiredText(formData, "periodKey", copy.period);
      const period = periods.find((candidate) => candidate.key === key);
      if (!period) throw new FieldError(fieldErrors.choice(copy.period));

      periodKey = period.key;
      periodLabel = period.label;
      yearIndex = period.yearIndex;
      semesterNo = period.semesterNo;
      monthIndex = period.monthIndex;
    }

    const sequence =
      (await prisma.programUnit.count({ where: { programId: program.id, periodKey } })) + 1;

    await unique(copy.unit, () =>
      prisma.programUnit.create({
        data: {
          programId: program.id,
          unitId: unit.id,
          moduleId,
          periodKey,
          periodLabel,
          yearIndex,
          semesterNo,
          monthIndex,
          sequence,
          isCore: formData.get("isCore") !== "no",
        },
      }),
    );
  });
}

/** A placement that a student has a result against is history and may not be removed. */
export async function removeProgramUnit(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    await scopedProgram(programId, scope.campusId);
    const placementId = hiddenId(formData, "placementId", copy.removeUnit);

    const placement = await prisma.programUnit.findFirst({
      where: { id: placementId, programId },
      select: { id: true, _count: { select: { studentUnits: true } } },
    });
    if (!placement) throw new FieldError(fieldErrors.notOnCampus);
    if (placement._count.studentUnits > 0) throw new FieldError(copy.removeBlocked);

    await prisma.programUnit.delete({ where: { id: placement.id } });
  });
}

export async function createProgramModule(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    const program = await scopedProgram(programId, scope.campusId);
    if (program.structure !== "MODULE") throw new FieldError(copy.moduleNeedsModuleStructure);

    const code = requiredText(formData, "code", copy.moduleCode).toUpperCase().replace(/\s+/g, "");
    const name = requiredText(formData, "name", copy.moduleName);
    const sequence = numberField(formData, "sequence", copy.moduleSequence) ?? 0;

    await unique(copy.moduleCode, () =>
      prisma.programModule.create({
        data: {
          programId: program.id,
          code,
          name,
          description: text(formData, "description"),
          durationMonths: numberField(formData, "durationMonths", copy.moduleDuration),
          assessmentNote: text(formData, "assessmentNote"),
          sequence: Math.round(sequence),
        },
      }),
    );
  });
}

export async function updateProgramModule(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    await scopedProgram(programId, scope.campusId);
    const moduleId = hiddenId(formData, "moduleId", copy.module);

    const moduleRecord = await prisma.programModule.findFirst({
      where: { id: moduleId, programId },
      select: { id: true },
    });
    if (!moduleRecord) throw new FieldError(fieldErrors.notOnCampus);

    await prisma.programModule.update({
      where: { id: moduleRecord.id },
      data: {
        name: requiredText(formData, "name", copy.moduleName),
        description: text(formData, "description"),
        durationMonths: numberField(formData, "durationMonths", copy.moduleDuration),
        assessmentNote: text(formData, "assessmentNote"),
        isActive: checked(formData, "isActive"),
      },
    });
  });
}

export async function removeProgramModule(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const programId = hiddenId(formData, "programId", copy.title);

  return onSave(`/dashboard/programs/${programId}/units`, affected(programId), async () => {
    await scopedProgram(programId, scope.campusId);
    const moduleId = hiddenId(formData, "moduleId", copy.module);

    const moduleRecord = await prisma.programModule.findFirst({
      where: { id: moduleId, programId },
      select: { id: true, _count: { select: { units: true } } },
    });
    if (!moduleRecord) throw new FieldError(fieldErrors.notOnCampus);
    if (moduleRecord._count.units > 0) throw new FieldError(copy.moduleRemoveBlocked);

    await prisma.programModule.delete({ where: { id: moduleRecord.id } });
  });
}

/** Opens a period for one student, which is the explicit approval that lets them progress. */
export async function registerUnitPeriod(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const enrollmentId = hiddenId(formData, "enrollmentId", copy.title);

  const enrollment = await prisma.enrollment.findFirst({
    where: {
      id: enrollmentId,
      ...(scope.campusId === null ? {} : { campusId: scope.campusId }),
    },
    select: { id: true, studentId: true, programId: true },
  });
  if (!enrollment) throw new FieldError(fieldErrors.notOnCampus);

  const studentPath = `/dashboard/students/${enrollment.studentId}`;
  const programId = enrollment.programId;

  return onSave(studentPath, affected(programId, enrollment.studentId), async () => {
    const periodKey = requiredText(formData, "periodKey", copy.period);
    const override = checked(formData, "override");

    const outcome = await prisma.$transaction((tx) =>
      registerPeriod(tx, { enrollmentId: enrollment.id, periodKey, override }),
    );

    if (!outcome.ok) {
      if (outcome.reason === "outstanding") {
        throw new FieldError(copy.progressionBlocked(outcome.outstanding));
      }
      throw new FieldError(copy.periodUnknown);
    }
  });
}

/** Records the outcome of one unit and, when it finishes a stage, opens the attachment. */
export async function saveUnitResult(formData: FormData) {
  const scope = await requireCollegeAdmin();
  const studentUnitId = hiddenId(formData, "studentUnitId", copy.unit);

  const row = await prisma.studentUnit.findUnique({
    where: { id: studentUnitId },
    select: {
      id: true,
      enrollment: {
        select: {
          studentId: true,
          campusId: true,
          programId: true,
        },
      },
    },
  });
  if (!row || (scope.campusId !== null && row.enrollment.campusId !== scope.campusId)) {
    throw new FieldError(fieldErrors.notOnCampus);
  }

  const studentPath = `/dashboard/students/${row.enrollment.studentId}`;

  return onSave(studentPath, affected(row.enrollment.programId, row.enrollment.studentId), async () => {
    const status = enumField(formData, "status", STATUSES, copy.status);

    const score = numberField(formData, "score", copy.score);
    const maxScore = numberField(formData, "maxScore", copy.maxScore);
    if (score !== null && (score < 0 || (maxScore !== null && score > maxScore))) {
      throw new FieldError(fieldErrors.number(copy.score));
    }

    await prisma.$transaction((tx) =>
      applyUnitResult(tx, {
        studentUnitId: row.id,
        status,
        score,
        maxScore,
        grade: text(formData, "grade"),
        remark: text(formData, "remark"),
      }),
    );
  });
}
