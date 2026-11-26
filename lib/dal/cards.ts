import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { labels, pages } from "@/lib/content/dashboard";
import { site } from "@/lib/content/home";
import { mergeCardTemplate, type CardSlots } from "@/lib/cards/template";
import { fillQrSlot, verifyUrl } from "@/lib/cards/qr";
import { expiryForProgram } from "@/lib/cards/validity";
import type { PrintableCard } from "@/lib/cards/sheet";
import { CARD_TEMPLATES } from "@/components/id-card-svg";

/**
 * The artwork ships with the app rather than living in the database: it is part of the
 * build, and a missing template should fail loudly at request time rather than leave the
 * office staring at a blank card. The single copy lives beside the React components that
 * preview it (`components/id-card-svg.tsx`), so the print run and the screen always show
 * the same card — edit the design there, once, in one place.
 */
export async function templates() {
  return CARD_TEMPLATES;
}

export type CardFace = {
  serial: string;
  status: string;
  frontSvg: string;
  backSvg: string;
  /** The address the QR resolves to, so the portal can show and test the same link. */
  where: string;
  /** Slots the template asked for but the record had no value for, so a proof is honest. */
  missing: string[];
};

export type FaceInput = {
  serial: string;
  status: string;
  verifyToken: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  campusName: string;
  className: string | null;
  programName: string | null;
  admissionNo: string;
  photoUrl: string | null;
  fullName: string;
  email: string;
  guardian: { fullName: string; phone: string | null } | null;
  period: { month: number; year: number } | null;
  enrollmentProgram: string | null;
};

/** Fills the artwork's slots from one student's record, and reports what was missing. */
export async function mergeFace(input: FaceInput) {
  const intakeLabel = input.period
    ? `${labels.months[input.period.month - 1] ?? ""} ${input.period.year}`.trim()
    : null;

  const slots: CardSlots = {
    logo_url: "/card-logo.png",
    signature_url: "/card-signature.png",
    photo_url: input.photoUrl,
    reg_no: input.admissionNo,
    full_name: input.fullName,
    course: input.programName ?? input.enrollmentProgram ?? null,
    campus: input.campusName,
    class_name: input.className,
    intake: intakeLabel,
    expiry_date: input.expiresAt ? formatDate(input.expiresAt) : null,
    // An unprinted card has no issue date yet, so it shows the day it was requested.
    issue_date: formatDate(input.issuedAt ?? input.createdAt),
    website: site.url ?? null,
    verify_token: input.verifyToken,
    emergency_name: input.guardian?.fullName ?? null,
    emergency_phone: input.guardian?.phone ?? null,
    contact_email: input.email,
  };

  const { front, back } = await templates();

  const missing = [
    ...new Set(
      [front, back]
        .flatMap((svg) => [...svg.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1]))
        .filter((slot) => !slots[slot]),
    ),
  ];

  // The QR carries a verification address, never the student's details. A card is handed
  // to someone who may photograph it, so the only thing worth encoding is a token that the
  // college's own database can answer for.
  const backWithQr = await fillQrSlot(back, verifyUrl(site.url, input.verifyToken));

  return {
    serial: input.serial,
    status: input.status,
    frontSvg: mergeCardTemplate(front, slots),
    backSvg: mergeCardTemplate(backWithQr, slots),
    where: verifyUrl(site.url, input.verifyToken),
    missing,
    label: input.admissionNo,
  };
}

/** Everything the printed card shows, assembled from the student's own record. */
export async function getCardFace(cardId: string, campusId: number | null) {
  const card = await prisma.idCard.findFirst({
    where: { id: cardId, ...(campusId === null ? {} : { campusId }) },
    select: {
      serial: true,
      status: true,
      verifyToken: true,
      issuedAt: true,
      expiresAt: true,
      createdAt: true,
      campus: { select: { name: true } },
      program: { select: { name: true } },
      student: {
        select: {
          admissionNo: true,
          profilePhotoUrl: true,
          user: { select: { fullName: true, email: true } },
          parentGuardians: { take: 1, select: { fullName: true, phone: true } },
          enrollments: {
            where: { status: "ACTIVE" },
            take: 1,
            orderBy: { enrolledAt: "desc" },
            select: {
              period: { select: { month: true, year: true } },
              program: { select: { name: true } },
              memberships: {
                where: { leftAt: null },
                take: 1,
                select: { class: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!card) return null;

  const enrollment = card.student.enrollments[0] ?? null;

  const face = await mergeFace({
    serial: card.serial,
    status: card.status,
    verifyToken: card.verifyToken,
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    createdAt: card.createdAt,
    campusName: card.campus.name,
    className: enrollment?.memberships[0]?.class.name ?? null,
    programName: card.program?.name ?? null,
    admissionNo: card.student.admissionNo,
    photoUrl: card.student.profilePhotoUrl,
    fullName: card.student.user.fullName,
    email: card.student.user.email,
    guardian: card.student.parentGuardians[0] ?? null,
    period: enrollment?.period ?? null,
    enrollmentProgram: enrollment?.program.name ?? null,
  });

  return face satisfies CardFace;
}

/**
 * Who a print run covers.
 *
 * The office prints a card for one student, a whole class, or everyone who joined at an
 * intake — never "the whole college" by accident, which is why every option names the
 * people it will include before anything is generated.
 */
export type CardTarget =
  | { kind: "student"; studentId: string }
  | { kind: "class"; classId: string }
  | { kind: "intake"; intakeId: string };

export type CardCandidate = {
  studentId: string;
  admissionNo: string;
  fullName: string;
  programName: string | null;
  intakeLabel: string | null;
  classLabel: string | null;
  hasPhoto: boolean;
  /** The student's own campus, so a college-wide run still issues cards to the right one. */
  campusId: number;
};

/** The students a run would cover, so the office can see the list before printing it. */
export async function getCardCandidates(
  target: CardTarget | null,
  campusId: number | null,
): Promise<CardCandidate[]> {
  if (!target) return [];

  const scope = campusId === null ? {} : { campusId };

  const where =
    target.kind === "student"
      ? { id: target.studentId, ...scope }
      : target.kind === "intake"
        ? { enrollments: { some: { periodId: target.intakeId, status: "ACTIVE" as const, ...scope } } }
        : {
            // Class membership hangs off the enrollment, so the filter crosses that way.
            enrollments: { some: { memberships: { some: { classId: target.classId, leftAt: null } } } },
          };

  const rows = await prisma.studentProfile.findMany({
    where,
    orderBy: { admissionNo: "asc" },
    select: {
      id: true,
      admissionNo: true,
      profilePhotoUrl: true,
      campusId: true,
      user: { select: { fullName: true } },
      enrollments: {
        where: { status: "ACTIVE" },
        take: 1,
        orderBy: { enrolledAt: "desc" },
        select: {
          program: { select: { name: true } },
          period: { select: { month: true, year: true } },
          memberships: {
            where: { leftAt: null },
            take: 1,
            select: { class: { select: { name: true } } },
          },
        },
      },
    },
  });

  return rows.map((row) => {
    const enrollment = row.enrollments[0] ?? null;
    return {
      studentId: row.id,
      admissionNo: row.admissionNo,
      fullName: row.user.fullName,
      programName: enrollment?.program.name ?? null,
      intakeLabel: enrollment
        ? `${labels.months[enrollment.period.month - 1] ?? ""} ${enrollment.period.year}`.trim()
        : null,
      classLabel: enrollment?.memberships[0]?.class.name ?? null,
      hasPhoto: Boolean(row.profilePhotoUrl),
      campusId: row.campusId,
    };
  });
}

/**
 * Builds the printable cards for a run.
 *
 * Cards are issued digitally at enrolment. This repair path creates an issued card only for
 * an older imported student who has no card row, so a print run never leaves an enrolled
 * student without an identity record. Existing cards are reused so reprints keep their serial
 * and verification token.
 */
export async function buildPrintableCards(target: CardTarget, campusId: number | null) {
  const candidates = await getCardCandidates(target, campusId);
  if (candidates.length === 0) return { cards: [] as PrintableCard[], created: 0 };

  const ids = candidates.map((c) => c.studentId);

  const existing = await prisma.idCard.findMany({
    where: { studentId: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: { id: true, studentId: true, status: true, serial: true, verifyToken: true },
  });

  // One card per student: a replaced or lost card is superseded, so the newest live card wins.
  const live = new Map<string, (typeof existing)[number]>();
  for (const card of existing) {
    if (!live.has(card.studentId)) live.set(card.studentId, card);
  }

  // A card is created at enrolment, so a run should normally find every card already there.
  // Anyone missing one gets it now, which repairs a student imported or promoted before the
  // cards existed — the office is never told to "generate again".
  const missing = candidates.filter((candidate) => !live.has(candidate.studentId));
  const created: string[] = [];

  if (missing.length > 0) {
    /*
     * Each card's expiry comes from the student's own active programme measured from their
     * intake, read once for the whole run rather than once per student — a full-cohort run
     * issues around a thousand cards, and the per-student lookups had it issuing a thousand
     * queries and re-reading every serial in the table a thousand times on top.
     */
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: { in: missing.map((m) => m.studentId) }, status: "ACTIVE" },
      orderBy: { enrolledAt: "desc" },
      select: {
        studentId: true,
        programId: true,
        period: { select: { startsAt: true } },
        program: { select: { durationMonths: true } },
      },
    });

    const active = new Map<string, (typeof enrollments)[number]>();
    for (const enrollment of enrollments) {
      if (!active.has(enrollment.studentId)) active.set(enrollment.studentId, enrollment);
    }

    /*
     * Serials are sequential and unique; a lost card's number is never reissued. The free
     * codes are allocated from one read of the serials, in issue order — exactly the
     * sequence allocating them one at a time produced, without the per-card table read.
     */
    const taken = new Set(
      (await prisma.idCard.findMany({ select: { serial: true } })).map((row) => row.serial),
    );

    const year = new Date().getUTCFullYear();
    let sequence = taken.size + 1;

    const rows = missing.map((candidate) => {
      let serial: string | null = null;
      for (let attempt = 0; attempt < 10_000 && serial === null; attempt += 1, sequence += 1) {
        const code = `IDC/${year}/${String(sequence).padStart(4, "0")}`;
        if (!taken.has(code)) serial = code;
      }
      if (serial === null) throw new Error("Could not allocate a card serial.");
      taken.add(serial);

      // A student with no active enrollment still gets a card, just one with no expiry
      // date and no programme: the same answer the per-student lookup gave.
      const enrollment = active.get(candidate.studentId) ?? null;

      return {
        serial,
        verifyToken: randomUUID(),
        studentId: candidate.studentId,
        campusId: campusId ?? candidate.campusId,
        programId: enrollment?.programId ?? null,
        status: "ISSUED" as const,
        issuedAt: new Date(),
        expiresAt: enrollment
          ? expiryForProgram(enrollment.period.startsAt, enrollment.program.durationMonths)
          : null,
        remarks: pages.cards.create.autoRemark,
      };
    });

    /*
     * One transaction, so a run that dies halfway does not leave half a cohort holding
     * serials the retry cannot account for. A thousand creates is well inside a database
     * transaction, but not inside the default five-second one — hence the generous limit.
     */
    const issued = await prisma.$transaction(
      rows.map((data) =>
        prisma.idCard.create({
          data,
          select: { id: true, studentId: true, status: true, serial: true, verifyToken: true },
        }),
      ),
      { timeout: 60_000, maxWait: 10_000 },
    );

    for (const card of issued) {
      live.set(card.studentId, card);
      created.push(card.id);
    }
  }

  const faces = await Promise.all(
    [...live.values()]
      .filter((card) => ids.includes(card.studentId))
      .map((card) => getCardFace(card.id, campusId)),
  );

  return {
    cards: faces.filter((f): f is NonNullable<typeof f> => f !== null),
    created: created.length,
  };
}
