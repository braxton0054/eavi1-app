"use server";

import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin, type AdminScope } from "@/lib/session";
import { fieldErrors, labels, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  assertOpenYear,
  hiddenId,
  onSave,
  requiredDate,
  requiredNumber,
  startOfToday,
} from "@/lib/actions/college/_shared";

const copy = pages.applications.dateSetting;

const MONTHS = 12;

/** Index 0 is January, so a stored month number reads back as its name. */
const monthName = (month: number) => labels.months[month - 1] ?? String(month);

/** The campus being written to: a campus admin is pinned to their own and the form value is ignored. */
async function targetCampus(scope: AdminScope, formData: FormData): Promise<number> {
  if (scope.campusId !== null) return scope.campusId;

  const campusId = requiredNumber(formData, "campusId", copy.campus.select);
  const campus = await prisma.campus.findUnique({ where: { id: campusId }, select: { id: true } });
  if (!campus) throw new FieldError(fieldErrors.choice(copy.campus.select));

  return campus.id;
}

/**
 * Year and month come from the screen, never from the applicant, so one month can only
 * ever carry one date: the row is written where the (campus, year, month) slot already is.
 */
function monthField(formData: FormData, label: string): number {
  const month = requiredNumber(formData, "month", label);
  if (!Number.isInteger(month) || month < 1 || month > MONTHS) {
    throw new FieldError(fieldErrors.choice(label));
  }
  return month;
}

export async function saveReportingDate(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/applications", ["/dashboard/applications"], async () => {
    const campusId = await targetCampus(scope, formData);

    const year = Math.round(requiredNumber(formData, "year", copy.year.select));
    assertOpenYear(year);

    const month = monthField(formData, copy.months);
    const date = requiredDate(formData, "date", copy.set.field.label);

    if (date.getFullYear() !== year || date.getMonth() + 1 !== month) {
      throw new FieldError(fieldErrors.dateNotInMonth(monthName(month)));
    }

    const where = { campusId_year_month: { campusId, year, month } } as const;
    const existing = await prisma.reportingDate.findUnique({ where, select: { date: true } });

    // A month whose students have already reported is history, even if the calendar month
    // has days left in it.
    if (existing && existing.date < startOfToday()) {
      throw new FieldError(fieldErrors.reportingPassed);
    }
    if (date < startOfToday()) throw new FieldError(fieldErrors.datePast);

    await prisma.reportingDate.upsert({
      where,
      create: { campusId, year, month, date },
      update: { date },
    });
  });
}

export async function clearReportingDate(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/applications", ["/dashboard/applications"], async () => {
    const campusId = await targetCampus(scope, formData);
    const id = hiddenId(formData, "reportingId", copy.months);

    const row = await prisma.reportingDate.findUnique({
      where: { id },
      select: { id: true, campusId: true, year: true, date: true },
    });
    // The row is only the caller's when it sits on the campus their form was addressed to.
    if (!row || row.campusId !== campusId) throw new FieldError(fieldErrors.notOnCampus);

    assertOpenYear(row.year);
    if (row.date < startOfToday()) throw new FieldError(fieldErrors.reportingPassed);

    await prisma.reportingDate.delete({ where: { id: row.id } });
  });
}
