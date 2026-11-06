import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { icons } from "@/components/dashboard/icons";
import { common, type DashboardIcon } from "@/lib/content/dashboard";

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
} & ComponentPropsWithoutRef<typeof Card>) {
  return (
    <Card className={cn("gap-0 py-0 shadow-eavi-card ring-0", props.className)}>
      {(title || aside) && (
        <CardHeader className="flex flex-col items-start gap-3 border-b border-eavi-border py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            {title ? <CardTitle className="text-base sm:truncate">{title}</CardTitle> : null}
            {description ? <CardDescription className="mt-0.5">{description}</CardDescription> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">{aside}</div>
        </CardHeader>
      )}
      <CardContent className="p-0">{children}</CardContent>
    </Card>
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
}: {
  label: string;
  value: string;
  icon: DashboardIcon;
  tone?: "neutral" | "money" | "attention";
}) {
  const Icon = icons[icon];
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-eavi-border bg-eavi-card p-4 shadow-eavi-card">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-eavi-muted-text">{label}</span>
        <Icon aria-hidden className={cn("size-4", tone === "money" ? "text-eavi-secondary-text" : tone === "attention" ? "text-eavi-warn-text" : "text-eavi-primary-text")} />
      </div>
      <p className={cn("text-2xl font-semibold tabular-nums tracking-tight", tone === "money" && "text-eavi-secondary-text", tone === "attention" && "text-eavi-warn-text")}>
        {value}
      </p>
    </div>
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
    <div className="space-y-3 p-5" role="status" aria-label={common.loading}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  );
}
