import { cn } from "cn";
import type { ReactNode } from "react";

export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn("scroll-mt-24 py-14 sm:py-20", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionHeader({
  id,
  eyebrow,
  heading,
  subheading,
  action,
  className,
  onBackground = false,
}: {
  id?: string;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  action?: ReactNode;
  className?: string;
  /** Set when the header renders straight onto the magenta page background instead of
      a light section band, so the text switches to the on-background token. */
  onBackground?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end",
        className,
      )}
    >
      <div className="flex flex-col items-start gap-2">
        {eyebrow && (
          <p
            className={cn(
              "text-xs font-semibold uppercase tracking-[0.24em]",
              onBackground ? "text-eavi-on-bg" : "text-eavi-primary-text",
            )}
          >
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className={cn(
            "font-[var(--font-ui)] text-balance text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl",
            onBackground && "text-eavi-on-bg",
          )}
        >
          {heading}
        </h2>
        {subheading && (
          <p
            className={cn(
              "max-w-2xl text-pretty text-sm leading-6 sm:text-base sm:leading-7",
              onBackground ? "text-eavi-on-bg" : "text-muted-foreground",
            )}
          >
            {subheading}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
