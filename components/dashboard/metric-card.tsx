import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { icons } from "@/components/dashboard/icons";
import type { DashboardIcon } from "@/lib/content/dashboard";

/**
 * The metric tile the imported dashboard template is built on: an icon chip, the figure
 * and, when there is one, how it moved since the last period.
 */
export function MetricCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
  href,
}: {
  label: string;
  value: string;
  icon: DashboardIcon;
  tone?: "neutral" | "money" | "attention";
  /** What sits under the figure: a comparison, a share, a next step. */
  hint?: ReactNode;
  /** Set when the tile leads somewhere; the whole card becomes the link. */
  href?: string;
}) {
  const Icon = icons[icon];
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-2xl border border-eavi-border bg-eavi-card p-4 shadow-eavi-card sm:p-5",
        href && "transition-shadow hover:shadow-eavi-lift",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-eavi-muted-text">{label}</span>
        <span
          aria-hidden
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl bg-eavi-primary-soft",
            tone === "money" && "bg-eavi-success-soft",
            tone === "attention" && "bg-eavi-warn-soft",
          )}
        >
          <Icon
            className={cn(
              "size-4",
              tone === "money" ? "text-eavi-secondary-text" : tone === "attention" ? "text-eavi-warn-text" : "text-eavi-primary-text",
            )}
          />
        </span>
      </div>
      <p
        className={cn(
          "text-3xl font-semibold tabular-nums tracking-tight",
          tone === "money" && "text-eavi-secondary-text",
          tone === "attention" && "text-eavi-warn-text",
        )}
      >
        {value}
      </p>
      {hint ? <div className="mt-auto text-xs text-eavi-muted-text">{hint}</div> : null}
    </div>
  );

  if (!href) return body;
  return <a href={href}>{body}</a>;
}

/** One figure beside a caption, used inside a card that already carries a title. */
export function Figure({ label, value, tone }: { label: string; value: string; tone?: "money" | "attention" }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wider text-eavi-muted-text">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "money" && "text-eavi-secondary-text",
          tone === "attention" && "text-eavi-warn-text",
        )}
      >
        {value}
      </p>
    </div>
  );
}
