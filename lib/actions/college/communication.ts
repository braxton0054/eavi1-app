"use server";

import { Audience } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireCollegeAdmin } from "@/lib/session";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import {
  FieldError,
  checked,
  enumField,
  hiddenId,
  onSave,
  requiredText,
} from "@/lib/actions/college/_shared";

const AUDIENCES = Object.keys(Audience) as (keyof typeof Audience)[];

/** The "Where it appears" select is static copy; only these two values are accepted. */
const SCOPES = ["campus", "college"] as const;

const copy = pages.communication;

const fieldLabel = (name: string) =>
  copy.create.fields.find((field) => field.name === name)?.label ?? name;

/** The notice board here and the overview announcement strip both read this. */
const AFFECTED = ["/dashboard/communication", "/dashboard"];

export async function publishAnnouncement(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/communication", AFFECTED, async () => {
    const title = requiredText(formData, "title", fieldLabel("title"));
    const body = requiredText(formData, "body", fieldLabel("body"));
    const audience = enumField(formData, "audience", AUDIENCES, fieldLabel("audience"));

    // Same rule as a calendar event: "college" writes a null campusId, which only a
    // super admin may do; "campus" needs an administrator actually sitting on one.
    const noticeScope = enumField(formData, "scope", SCOPES, fieldLabel("scope"), "campus");
    let campusId: number | null = null;
    if (noticeScope === "college") {
      if (scope.campusId !== null) throw new FieldError(fieldErrors.notOnCampus);
    } else {
      if (scope.campusId === null) throw new FieldError(fieldErrors.notOnCampus);
      campusId = scope.campusId;
    }

    await prisma.announcement.create({
      data: {
        title,
        body,
        audience,
        campusId,
        authorId: scope.userId,
        pinned: checked(formData, "pinned"),
      },
    });
  });
}

export async function withdrawAnnouncement(formData: FormData) {
  const scope = await requireCollegeAdmin();

  return onSave("/dashboard/communication", AFFECTED, async () => {
    const announcementId = hiddenId(formData, "announcementId", copy.remove.button);

    const notice = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, campusId: true },
    });

    // A campus admin may only delete a notice carrying their own campusId; a
    // college-wide notice (null campusId) belongs to every campus, so only a
    // super admin may remove it.
    if (!notice || (scope.campusId !== null && notice.campusId !== scope.campusId)) {
      throw new FieldError(fieldErrors.notOnCampus);
    }

    await prisma.announcement.delete({ where: { id: notice.id } });
  });
}
