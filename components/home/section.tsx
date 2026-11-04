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
}: {
  id?: string;
  eyebrow?: string;
  heading: string;
  subheading?: string;
  action?: ReactNode;
  className?: string;
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
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-eavi-primary-text">
            {eyebrow}
          </p>
        )}
        <h2
          id={id}
          className="cn-font-heading text-balance text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-3xl"
        >
          {heading}
        </h2>
        {subheading && (
          <p className="max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
            {subheading}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
