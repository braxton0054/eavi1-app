import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { verify } from "@/lib/content/verify";
import { formatDate } from "@/lib/format";
import { cardLifecycle } from "@/lib/cards/status";

/**
 * Where a scanned student card or a printed admission letter lands.
 *
 * Deliberately public: the person checking is a guard at a gate, an examiner, or a clerk at an
 * enrolment counter, and has no account. The only input is the token printed in the QR, and the
 * only output is a clear answer read from the college's own database — so a forged document fails
 * here no matter how convincing it looks.
 *
 * Cards and letters share this page because they share the QR they print: one address, one token
 * space. The token is looked up in both tables and the document that matches decides what the page
 * says.
 */

export const metadata: Metadata = {
  title: `Verification · EAVI`,
  // A verification page is for the holder of the document, not an index of students.
  robots: { index: false, follow: false },
};

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const [card, letter] = await Promise.all([
    cardFor(token),
    letterFor(token),
  ]);

  // A letter token is not a card, so it is answered in its own terms rather than as a bad card.
  if (letter) return <LetterAnswer letter={letter} />;

  // An unrecognised token says only that it is unrecognised. Naming what might have been
  // wrong would help someone guess their way to a valid code.
  if (!card) {
    return (
      <Shell
        tone="invalid"
        title={verify.heading.invalid}
        body={verify.invalidBody}
        hint={verify.scannedHint}
      >
        <p className="text-sm text-eavi-muted-text">
          {token ? verify.invalidBody : verify.dinMissing}
        </p>
      </Shell>
    );
  }

  return <CardAnswer card={card} />;
}

async function cardFor(token: string) {
  if (!token) return null;
  return prisma.idCard.findUnique({
        where: { verifyToken: token },
        select: {
          status: true,
          issuedAt: true,
          expiresAt: true,
          student: {
            select: {
              admissionNo: true,
              user: { select: { fullName: true, status: true } },
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
      });
}

async function letterFor(token: string) {
  if (!token) return null;
  return prisma.offerLetter.findUnique({
    where: { verifyToken: token },
    select: {
      reference: true,
      printedName: true,
      issuedAt: true,
      expiresAt: true,
      revokedAt: true,
      program: { select: { name: true } },
      campus: { select: { name: true } },
      application: { select: { campus: { select: { name: true } } } },
    },
  });
}

type Card = NonNullable<Awaited<ReturnType<typeof cardFor>>>;
type Letter = NonNullable<Awaited<ReturnType<typeof letterFor>>>;

async function CardAnswer({ card }: { card: Card }) {
  const enrollment = card.student.enrollments[0] ?? null;
  const now = new Date();

  // The portal and this public page share one lifecycle rule, so a pending card can never
  // be presented as active in one place and verified in the other.
  const lifecycle = cardLifecycle(card, enrollment !== null && card.student.user.status === "ACTIVE", now);
  const state = lifecycle.key === "active"
    ? { tone: "valid" as const, head: verify.heading.valid, body: verify.validBody, ok: true }
    : lifecycle.key === "expired"
      ? { tone: "expired" as const, head: verify.heading.expired, body: verify.expiredBody, ok: false }
      : lifecycle.key === "pending" || lifecycle.key === "printing"
        ? { tone: "pending" as const, head: verify.heading.pending, body: verify.pendingBody, ok: false }
        : lifecycle.key === "not-enrolled"
          ? { tone: "revoked" as const, head: verify.heading.revoked, body: verify.notEnrolledBody, ok: false }
          : { tone: "revoked" as const, head: verify.heading.revoked, body: verify.revokedBody, ok: false };

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
      value: card.issuedAt ? formatDate(card.issuedAt) : "Not issued",
    },
    {
      label: verify.labels.expires,
      value: card.expiresAt ? formatDate(card.expiresAt) : "—",
    },
  ];

  return (
    <Shell tone={state.tone} title={state.head} body={state.body} hint={verify.scannedHint}>
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
 * The answer for an admission letter.
 *
 * Kept apart from the card answer because the states mean different things. A card that does not
 * verify is not a student; a letter that does not verify was never issued by us. And a genuine
 * letter is not the same as an admission — it proves the application was received and nothing
 * more — so the page says that outright rather than letting a green tick imply a place has been
 * offered.
 */
function LetterAnswer({ letter }: { letter: Letter }) {
  const now = new Date();
  const revoked = letter.revokedAt !== null;
  const expired = letter.expiresAt < now;

  const state = revoked
    ? { tone: "revoked" as const, head: verify.letter.heading.revoked, body: verify.letter.revokedBody }
    : expired
      ? { tone: "expired" as const, head: verify.letter.heading.expired, body: verify.letter.expiredBody }
      : { tone: "valid" as const, head: verify.letter.heading.valid, body: verify.letter.validBody };

  const rows = [
    { label: verify.letter.labels.name, value: letter.printedName },
    { label: verify.letter.labels.reference, value: letter.reference },
    { label: verify.letter.labels.programme, value: letter.program.name },
    { label: verify.letter.labels.campus, value: letter.application.campus.name },
    { label: verify.letter.labels.issued, value: formatDate(letter.issuedAt) },
    { label: verify.letter.labels.expires, value: formatDate(letter.expiresAt) },
  ];

  return (
    <Shell tone={state.tone} title={state.head} body={state.body} hint={verify.letter.scannedHint}>
      <dl className="mt-2 divide-y divide-eavi-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 py-2">
            <dt className="shrink-0 text-xs text-eavi-muted-text">{row.label}</dt>
            <dd className="min-w-0 text-right text-sm font-medium text-eavi-text">{row.value}</dd>
          </div>
        ))}
      </dl>
      {state.tone === "valid" ? (
        <p className="mt-3 rounded-lg border border-eavi-border bg-eavi-muted px-3 py-2 text-xs leading-5 text-eavi-text">
          {verify.letter.notAdmitted}
        </p>
      ) : null}
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
  hint,
  children,
}: {
  tone: "valid" | "invalid" | "pending" | "expired" | "revoked";
  title: string;
  body: string;
  /** What to scan to reach this page. Cards and letters are different documents, so it is a prop
   *  rather than always the card wording. */
  hint: string;
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
    pending: {
      ring: "border-eavi-warn-text",
      badge: "bg-eavi-warn-soft text-eavi-warn-text",
      mark: "!",
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

        <p className="mt-4 text-xs text-eavi-muted-text">{hint}</p>
        <p className="mt-6 text-xs text-eavi-muted-text">{verify.footer}</p>
      </div>
    </main>
  );
}
