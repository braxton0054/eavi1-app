import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { icons } from "@/components/dashboard/icons";
import { common, type DashboardIcon } from "@/lib/content/dashboard";

import styles from "./panel.module.css";

export function PageHeader({
  title,
  description,
  action,
  meta,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-eavi-on-bg sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-eavi-on-bg">{description}</p> : null}
        {meta}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  aside,
  children,
  ...props
}: {
  title?: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
} & ComponentPropsWithoutRef<"section">) {
  const hasHeader = Boolean(title || aside);
  return (
    <section
      {...props}
      className={cn(styles.root, props.className)}
    >
      {hasHeader && (
        <div className={styles.header} data-row={Boolean(aside) || undefined}>
          <div className={styles.heading}>
            {title ? <h2 className={styles.title}>{title}</h2> : null}
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {aside ? <div className={styles.aside}>{aside}</div> : null}
        </div>
      )}
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  body,
  icon = "overview",
  action,
}: {
  title?: string;
  body: string;
  icon?: DashboardIcon;
  action?: ReactNode;
}) {
  const Icon = icons[icon];
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-eavi-primary-soft text-eavi-primary-text">
        <Icon aria-hidden className="size-5" />
      </span>
      {title ? <p className="font-medium">{title}</p> : null}
      <p className="max-w-md text-sm text-eavi-muted-text">{body}</p>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  tone = "neutral",
  compact = false,
  hint,
}: {
  label: string;
  value: string;
  icon: DashboardIcon;
  tone?: "neutral" | "money" | "attention";
  /** A short reading — counts, not money — laid out in a row so four fit one screen. */
  compact?: boolean;
  /** One supporting line, e.g. what a count is missing. */
  hint?: string;
}) {
  const Icon = icons[icon];

  if (compact) {
    return (
      <div className={cn(styles.tile, styles.tileCompact)} data-tone={tone}>
        <Icon aria-hidden className={cn(styles.tileIcon)} data-tone={tone} />
        <p className={cn(styles.tileValue)} data-tone={tone === "neutral" ? undefined : tone}>
          {value}
        </p>
        <div className={styles.tileCompactBody}>
          <p className={styles.tileLabel}>{label}</p>
          {hint ? <p className={styles.tileHint}>{hint}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tile} data-tone={tone}>
      <div className={styles.tileHead}>
        <span className={styles.tileLabel}>{label}</span>
        <Icon aria-hidden className={styles.tileIcon} data-tone={tone === "neutral" ? undefined : tone} />
      </div>
      <p className={styles.tileValue} data-tone={tone === "neutral" ? undefined : tone}>
        {value}
      </p>
      {hint ? <p className={styles.tileHint}>{hint}</p> : null}
    </div>
  );
}

/**
 * A label/value pair that reads correctly at any width: a definition row on a phone and a
 * two-column grid on a wide screen, instead of columns that collapse into a ragged block.
 */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-eavi-border">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5"
          style={{ paddingInline: "var(--card-pad)" }}
        >
          <dt className="text-xs text-eavi-muted-text sm:text-sm">{item.label}</dt>
          <dd className="min-w-0 text-sm font-medium break-words text-right">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A CSS bar instead of a chart library: no extra JavaScript to download. */
export function Bar({ ratio, label }: { ratio: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-eavi-muted"
      role="img"
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-eavi-fill"
        style={{ width: `${Math.round(clamped * 100)}%` }}
      />
    </div>
  );
}

/** Database text stays text; it is never reparsed as HTML. */
export function SafeText({ value, className }: { value: string; className?: string }) {
  return <span className={className}>{value}</span>;
}

/** A one-line message the administrator acts on: a failed save or a locked period. */
export function Notice({
  tone = "warning",
  title,
  body,
}: {
  tone?: "warning" | "success" | "neutral";
  title: string;
  body?: string;
}) {
  return (
    <div
      role={tone === "warning" ? "alert" : "status"}
      className={cn(
        "rounded-xl border px-4 py-3",
        tone === "warning" && "border-eavi-border bg-eavi-warn-soft text-eavi-warn-text",
        tone === "success" && "border-eavi-border bg-eavi-success-soft text-eavi-secondary-text",
        tone === "neutral" && "border-eavi-border bg-eavi-info-soft text-eavi-info-text",
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      {body ? <p className="mt-0.5 text-sm opacity-90">{body}</p> : null}
    </div>
  );
}

export function PanelSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={common.loading}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}
