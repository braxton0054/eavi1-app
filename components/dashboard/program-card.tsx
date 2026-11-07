import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** The few facts a card carries, already formatted by the screen that renders it. */
export type ProgramCardData = {
  id: string;
  href: string;
  code: string;
  name: string;
  /** Awarding body and level for the small top line, e.g. "KNEC" and "Diploma". */
  body: string;
  level: string;
  duration: string;
  students: string;
  fee: string;
  feeSet: boolean;
  status: ReactNode;
  /** Documents the programme is still missing, shown as one quiet line. */
  missing: string[];
};

/**
 * One programme, one card — and the card itself is the link to the programme. There is no
 * per-row menu any more: everything an administrator can do to a programme (units, fees,
 * attachment, edit, archive, delete) lives on the programme's own screen, so the list only
 * has to get them there in one tap.
 *
 * The whole card is a single anchor, which also means one tab stop per programme and a
 * large touch target instead of a 3-dot button and a separate name link.
 */
export function ProgramCard({
  program,
  copy,
}: {
  program: ProgramCardData;
  copy: { students: string; open: string };
}) {
  return (
    <li className="min-w-0">
      <Link
        href={program.href}
        aria-label={`${copy.open}: ${program.name}`}
        className={cn(
          "group flex h-full min-h-11 flex-col rounded-2xl border border-eavi-border bg-eavi-card p-4 shadow-eavi-card",
          "transition-colors hover:border-eavi-primary-text hover:bg-eavi-primary-soft/50 active:bg-eavi-primary-soft",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[11px] font-medium tracking-wide text-eavi-muted-text tabular-nums uppercase">
            {program.code} · {program.body}
          </p>
          {program.status}
        </div>

        <p className="mt-1.5 text-sm leading-snug font-semibold text-balance text-eavi-on-bg">
          {program.name}
        </p>

        <dl className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <div className="flex items-center">
            <dt className="sr-only">Level</dt>
            <dd className="rounded-md bg-eavi-primary-soft px-1.5 py-0.5 font-medium text-eavi-primary-text">
              {program.level}
            </dd>
          </div>
          <div className="flex items-center text-eavi-muted-text">
            <dt className="sr-only">Duration</dt>
            <dd>{program.duration}</dd>
          </div>
          <div className="flex items-center text-eavi-muted-text">
            <dt className="sr-only">{copy.students}</dt>
            <dd>
              {program.students} {copy.students.toLowerCase()}
            </dd>
          </div>
        </dl>

        {/* The fee is the number the office is asked about, so it gets its own line. */}
        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 pt-3">
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              program.feeSet ? "text-eavi-secondary-text" : "text-eavi-warn-text",
            )}
          >
            {program.fee}
          </p>
          <span
            aria-hidden
            className="inline-flex items-center gap-1 text-xs font-medium text-eavi-primary-text group-hover:underline group-hover:underline-offset-4"
          >
            {copy.open}
            <span aria-hidden>→</span>
          </span>
        </div>

        {program.missing.length > 0 ? (
          <p className="mt-2 border-t border-eavi-border pt-2 text-[11px] text-eavi-muted-text">
            {program.missing.join(" · ")}
          </p>
        ) : null}
      </Link>
    </li>
  );
}

/** The grid the cards sit in: one column on a phone, two or three on a wide screen. */
export function ProgramCardGrid({ children }: { children: ReactNode }) {
  return (
    <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">{children}</ul>
  );
}
