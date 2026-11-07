import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The list card used by the people screens. A row of a register is not a table to scroll
 * sideways on a phone: it is one person, one card, and the card is the way in. The same
 * card renders at every width, in a grid, so there is no second mobile-only layout to keep
 * in step with the table.
 */
export type RecordCardData = {
  id: string;
  /** Where the card goes. Every card in this app opens a record. */
  href: string;
  /** Small caps line above the name: an admission number, a reference. */
  eyebrow: string;
  /** The record's own name, the strongest thing on the card. */
  title: string;
  /** One supporting line — a programme, an intake. */
  subtitle?: ReactNode;
  /** Short facts, each already formatted. */
  facts?: {
    label: string;
    value: ReactNode;
    tone?: "default" | "muted" | "money" | "danger";
    /** Show the label on screen, not only to screen readers. */
    showLabel?: boolean;
  }[];
  /** Top-right state chip. */
  status?: ReactNode;
  /** The one number that matters — a fee balance. */
  figure?: { label: string; value: string; danger?: boolean };
  /** A row-level form (change status) that stays on the list. */
  action?: ReactNode;
  /** Quiet footnote, e.g. what the record is still missing. */
  note?: string;
  /**
   * A profile picture. Rendered only when the record actually has one — a placeholder
   * silhouette on every card would be noise, and absence is already visible.
   */
  avatarUrl?: string | null;
  /** Read out in place of the image for a screen reader. */
  avatarAlt?: string;
};

export function RecordCard({
  card,
  openLabel,
}: {
  card: RecordCardData;
  openLabel: string;
}) {
  return (
    <li className="min-w-0">
      <div
        className={cn(
          "flex h-full flex-col rounded-2xl border border-eavi-border bg-eavi-card shadow-eavi-card",
          "transition-colors focus-within:border-eavi-primary-text hover:border-eavi-primary-text",
        )}
      >
        {/* The link covers the card body; the action form below stays outside it. */}
        <Link
          href={card.href}
          aria-label={`${openLabel}: ${card.title}`}
          className="flex flex-1 flex-col rounded-t-2xl p-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-[11px] font-medium tracking-wide text-eavi-muted-text tabular-nums uppercase">
              {card.eyebrow}
            </p>
            {card.status}
          </div>

          <div className="mt-1.5 flex items-start gap-2.5">
            {card.avatarUrl ? (
              // The photo keeps its own shape. A portrait is not square and was never taken
              // to be seen through a circle, so a fixed rounded box with `object-contain`
              // shows the whole face and leaves the empty edges to the card's own surface
              // rather than cropping the person to fit a decoration.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.avatarUrl}
                alt={card.avatarAlt ?? ""}
                loading="lazy"
                className="h-14 w-11 shrink-0 rounded-md border border-eavi-border bg-eavi-primary-soft object-contain"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-sm leading-snug font-semibold text-balance text-eavi-on-bg">
                {card.title}
              </p>

              {card.subtitle ? (
                <p className="mt-1 text-xs leading-snug text-eavi-muted-text">{card.subtitle}</p>
              ) : null}
            </div>
          </div>

          {card.facts && card.facts.length > 0 ? (
            <dl className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {card.facts.map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-1">
                  <dt className={fact.showLabel ? "text-[11px] text-eavi-muted-text" : "sr-only"}>
                    {fact.showLabel ? `${fact.label}:` : fact.label}
                  </dt>
                  <dd
                    className={cn(
                      "rounded-md px-1.5 py-0.5",
                      fact.tone === "money" && "bg-eavi-primary-soft font-medium text-eavi-secondary-text tabular-nums",
                      fact.tone === "danger" && "font-medium text-eavi-destructive tabular-nums",
                      fact.tone === "muted" && "text-eavi-muted-text",
                      (!fact.tone || fact.tone === "default") && "bg-eavi-primary-soft font-medium text-eavi-primary-text",
                    )}
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-auto flex flex-wrap items-baseline justify-between gap-2 pt-3">
            {card.figure ? (
              <div>
                <p className="text-[11px] text-eavi-muted-text">{card.figure.label}</p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    card.figure.danger ? "text-eavi-destructive" : "text-eavi-on-bg",
                  )}
                >
                  {card.figure.value}
                </p>
              </div>
            ) : (
              <span />
            )}
            <span
              aria-hidden
              className="inline-flex items-center gap-1 text-xs font-medium text-eavi-primary-text"
            >
              {openLabel}
              <span aria-hidden>→</span>
            </span>
          </div>

          {card.note ? (
            <p className="mt-2 border-t border-eavi-border pt-2 text-[11px] text-eavi-muted-text">
              {card.note}
            </p>
          ) : null}
        </Link>

        {card.action ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-eavi-border px-4 py-2.5">
            {card.action}
          </div>
        ) : null}
      </div>
    </li>
  );
}

/** One column on a phone, two on a tablet, three on a wide screen. */
export function RecordCardGrid({ children }: { children: ReactNode }) {
  return <ul className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">{children}</ul>;
}
