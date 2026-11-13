import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { labels, pages } from "@/lib/content/dashboard";
import { site } from "@/lib/content/home";
import { mergeCardTemplate, type CardSlots } from "@/lib/cards/template";
import { fillQrSlot, verifyUrl } from "@/lib/cards/qr";
import { expiryForProgram } from "@/lib/cards/validity";
import type { PrintableCard } from "@/lib/cards/sheet";

/**
 * The artwork ships with the app rather than living in the database: it is part of the
 * build, and a missing template should fail loudly at request time rather than leave the
 * office staring at a blank card. Edit `card-templates/*.svg` to change the design.
 */
const TEMPLATE_DIR = path.join(process.cwd(), "card-templates");

/**
 * The artwork is read once per process. A batch of three hundred cards would otherwise
 * re-read the same two files three hundred times, which is the difference between a print
 * run that finishes and one that times out.
 */
let cache: { front: string; back: string } | null = null;

export async function templates() {
  if (!cache) {
    cache = {
      front: await readFile(path.join(TEMPLATE_DIR, "front.svg"), "utf8"),
      back: await readFile(path.join(TEMPLATE_DIR, "back.svg"), "utf8"),
    };
  }
  return cache;
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

type FaceInput = {
  serial: string;
  status: string;
  verifyToken: string;
  issuedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  campusName: string;
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
async function mergeFace(input: FaceInput) {
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
    };
  });
}

/**
 * Builds the printable cards for a run.
 *
 * A card that has never been requested is created here, at the moment of the print run,
 * rather than silently at enrolment: the office decides when a card exists, and a serial is
 * a thing you give someone, not a side effect. An existing card is reused so a reprinted
 * card keeps its serial and its verification token.
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
  const created: string[] = [];
  for (const candidate of candidates) {
    if (live.has(candidate.studentId)) continue;

    const card = await issueCard(
      candidate.studentId,
      campusId ?? (await campusOf(candidate.studentId)),
    );
    live.set(candidate.studentId, card);
    created.push(card.id);
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

/** The campus a student belongs to, for a card created outside a campus-scoped session. */
async function campusOf(studentId: string) {
  const row = await prisma.studentProfile.findUnique({
    where: { id: studentId },
    select: { campusId: true },
  });
  return row?.campusId ?? 1;
}

/**
 * Creates the card a student is entitled to the moment they enrol.
 *
 * The expiry comes from the programme's own duration measured from the intake, never from a
 * number chosen here: the card is proof of enrolment, so it runs as long as the programme
 * does. A programme with no duration recorded yields a card with no expiry date rather than
 * a guessed one.
 */
export async function issueCard(studentId: string, campusId: number) {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, status: "ACTIVE" },
    orderBy: { enrolledAt: "desc" },
    select: {
      programId: true,
      period: { select: { startsAt: true } },
      program: { select: { durationMonths: true } },
    },
  });

  return prisma.idCard.create({
    data: {
      serial: await nextSerial(),
      verifyToken: randomUUID(),
      studentId,
      campusId,
      programId: enrollment?.programId ?? null,
      status: "PENDING",
      expiresAt: enrollment
        ? expiryForProgram(enrollment.period.startsAt, enrollment.program.durationMonths)
        : null,
      remarks: pages.cards.create.autoRemark,
    },
    select: { id: true, studentId: true, status: true, serial: true, verifyToken: true },
  });
}

/** Serials are sequential and unique; a lost card's number is never reissued. */
async function nextSerial() {
  const taken = new Set(
    (await prisma.idCard.findMany({ select: { serial: true } })).map((row) => row.serial),
  );

  const year = new Date().getUTCFullYear();
  let sequence = taken.size + 1;
  for (let attempt = 0; attempt < 10_000; attempt += 1, sequence += 1) {
    const code = `IDC/${year}/${String(sequence).padStart(4, "0")}`;
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not allocate a card serial.");
}
