import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/content/verify";
import { formatDate } from "@/lib/format";

/**
 * Where a scanned student card lands.
 *
 * Deliberately public: the person checking a card is a guard at a gate or an examiner, and
 * has no account. The only input is the token printed in the QR, and the only output is a
 * clear answer read from the college's own database — so a forged or copied card fails
 * here no matter how convincing the plastic looks.
 */

export const metadata: Metadata = {
  title: `${verify.title} · EAVI`,
  // A verification page is for the holder of the card, not an index of students.
  robots: { index: false, follow: false },
};

/** A card that is no longer proof of enrolment. LOST and REPLACED are both withdrawn. */
const WITHDRAWN = new Set(["LOST", "REPLACED"]);

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const card = token
    ? await prisma.idCard.findUnique({
        where: { verifyToken: token },
        select: {
          status: true,
          issuedAt: true,
          expiresAt: true,
          createdAt: true,
          student: {
            select: {
              admissionNo: true,
              user: { select: { fullName: true } },
              enrollments: {
                where: { status: "ACTIVE" },
                take: 1,
                orderBy: { enrolledAt: "desc" },
                select: { program: { select: { name: true } } },
              },
            },
          },
          campus: { select: { name: true } },
          program: { select: { name: true } },
        },
      })
    : null;

  // An unrecognised token says only that it is unrecognised. Naming what might have been
  // wrong would help someone guess their way to a valid code.
  if (!card) {
    return (
      <Shell tone="invalid" title={verify.heading.invalid} body={verify.invalidBody}>
        <p className="text-sm text-eavi-muted-text">
          {token ? verify.invalidBody : verify.dinMissing}
        </p>
      </Shell>
    );
  }

  const enrollment = card.student.enrollments[0] ?? null;
  const now = new Date();

  // Three separate reasons a card is not proof, because they mean different things to the
  // person holding it: a lost card was never handed back, an expired one belongs to someone
  // who has finished or left.
  const withdrawn = WITHDRAWN.has(card.status);
  const expired = card.expiresAt !== null && card.expiresAt < now;
  const notEnrolled = enrollment === null;

  const state = withdrawn
    ? { tone: "revoked" as const, head: verify.heading.revoked, body: verify.revokedBody, ok: false }
    : notEnrolled
      ? { tone: "revoked" as const, head: verify.heading.revoked, body: verify.expiredBody, ok: false }
      : expired
        ? { tone: "expired" as const, head: verify.heading.expired, body: verify.expiredBody, ok: false }
        : { tone: "valid" as const, head: verify.heading.valid, body: verify.validBody, ok: true };

  const rows = [
    { label: verify.labels.name, value: card.student.user.fullName },
    { label: verify.labels.admissionNo, value: card.student.admissionNo },
    {
      label: verify.labels.programme,
      value: card.program?.name ?? enrollment?.program.name ?? "—",
    },
    { label: verify.labels.campus, value: card.campus.name },
    {
      label: verify.labels.issued,
      value: card.issuedAt ? formatDate(card.issuedAt) : formatDate(card.createdAt),
    },
    {
      label: verify.labels.expires,
      value: card.expiresAt ? formatDate(card.expiresAt) : "—",
    },
  ];

  return (
    <Shell tone={state.tone} title={state.head} body={state.body}>
      <dl className="mt-2 divide-y divide-eavi-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-xs text-eavi-muted-text">{row.label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-eavi-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-eavi-muted-text">{verify.checkedAt}</p>
    </Shell>
  );
}

/**
 * The one layout both the valid and invalid answers share.
 *
 * Colour alone is not the message: the heading says it in words, so the page still works
 * for someone who cannot distinguish the green from the red.
 */
function Shell({
  tone,
  title,
  body,
  children,
}: {
  tone: "valid" | "invalid" | "expired" | "revoked";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  const palette = {
    valid: {
      ring: "border-eavi-success-fill",
      badge: "bg-eavi-success-soft text-eavi-secondary-text",
      mark: "✓",
    },
    invalid: {
      ring: "border-eavi-destructive",
      badge: "bg-eavi-danger-soft text-eavi-destructive",
      mark: "✕",
    },
    expired: {
      ring: "border-eavi-border",
      badge: "bg-eavi-muted text-eavi-muted-text",
      mark: "!",
    },
    revoked: {
      ring: "border-eavi-destructive",
      badge: "bg-eavi-danger-soft text-eavi-destructive",
      mark: "✕",
    },
  }[tone];

  return (
    <main className="min-h-dvh bg-eavi-bg px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-semibold tracking-tight text-eavi-primary-text">
            East Africa Vision Institute
          </span>
        </div>

        <section
          aria-label={title}
          className={`rounded-2xl border-2 ${palette.ring} bg-eavi-card p-5 shadow-eavi-card`}
        >
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={`flex size-11 shrink-0 items-center justify-center rounded-full text-xl font-bold ${palette.badge}`}
            >
              {palette.mark}
            </span>
            <h1 className="text-lg leading-tight font-semibold text-balance text-eavi-on-bg">
              {title}
            </h1>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-eavi-muted-text">{body}</p>

          {children}
        </section>

        <p className="mt-4 text-xs text-eavi-muted-text">{verify.scannedHint}</p>
        <p className="mt-6 text-xs text-eavi-muted-text">{verify.footer}</p>
      </div>
    </main>
  );
}
