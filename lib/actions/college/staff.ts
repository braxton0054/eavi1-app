"use server";

import { Role, Status } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/session";
import { revokeUserAccess } from "@/lib/security/revocation";
import { recordAudit } from "@/lib/academics/audit";
import { fieldErrors, pages } from "@/lib/content/dashboard";
import { FieldError, hiddenId, onSave, text } from "@/lib/actions/college/_shared";

const copy = pages.staff;

/** Sign-in access and the tutor roster both change when an account is switched on or off. */
const AFFECTED = ["/dashboard/staff", "/dashboard/tutors", "/dashboard"];

/**
 * Switches a staff account on or off. A super admin cannot lock themselves out, and
 * student accounts are managed from the student screens, not here.
 */
export async function setStaffStatus(formData: FormData) {
  const scope = await requireSuperAdmin();

  return onSave("/dashboard/staff", AFFECTED, async () => {
    const userId = hiddenId(formData, "userId", copy.heading);
    const requested = text(formData, "status");
    if (requested !== "ACTIVE" && requested !== "DISABLED") {
      throw new FieldError(fieldErrors.required(copy.heading));
    }
    if (userId === scope.userId) throw new FieldError(copy.ownAccount);

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true } });
    if (!user || user.role === Role.STUDENT) throw new FieldError(fieldErrors.notOnCampus);
    if (requested === "ACTIVE" && user.status !== Status.PENDING) {
      throw new FieldError("Only a pending office-provisioned account can be approved.");
    }

    if (requested === "DISABLED") {
      await revokeUserAccess(userId, Status.DISABLED);
    } else {
      await prisma.user.update({ where: { id: userId }, data: { status: Status.ACTIVE } });
    }
    await recordAudit({
      actorId: scope.userId,
      actorEmail: scope.email,
      action: `staff.${requested.toLowerCase()}`,
      entityType: "user",
      entityId: userId,
      detail: { role: user.role, status: requested },
    });
  });
}
