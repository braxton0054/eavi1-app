import { cn } from "@/lib/utils";

/**
 * The figures the imported template draws with a chart library, drawn here as plain CSS and
 * SVG on our own tokens: nothing extra for a campus phone to download, and the shapes read
 * the same light as the cards they sit in.
 */

export type Series = { label: string; value: number };

const largest = (series: Series[]) => Math.max(1, ...series.map((point) => point.value));

/** Columns for one figure per period, newest at the right. */
export function Columns({
  series,
  caption,
  tone = "primary",
  format = (value: number) => String(value),
}: {
  series: Series[];
  caption: string;
  tone?: "primary" | "money";
  format?: (value: number) => string;
}) {
  const top = largest(series);
  return (
    <div className="space-y-3">
      <div
        role="img"
        aria-label={caption}
        className="flex h-40 items-end gap-1.5 sm:gap-3"
      >
        {series.map((point) => (
          <div key={point.label} className="flex h-full flex-1 flex-col justify-end gap-2">
            <span className="text-center text-xs font-medium tabular-nums text-eavi-muted-text">
              {format(point.value)}
            </span>
            <div
              className={cn(
                "w-full rounded-t-lg bg-eavi-fill",
                tone === "money" && "bg-eavi-secondary",
              )}
              style={{ height: `${Math.max(2, Math.round((point.value / top) * 100))}%` }}
            />
            <span className="truncate text-center text-xs text-eavi-muted-text">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A trend line with the area under it filled, for a figure moving over time. */
export function Trend({
  series,
  caption,
  format = (value: number) => String(value),
}: {
  series: Series[];
  caption: string;
  format?: (value: number) => string;
}) {
  const top = largest(series);
  const step = series.length > 1 ? 100 / (series.length - 1) : 0;
  const at = (index: number) => `${index * step},${100 - (series[index].value / top) * 92}`;
  const line = series.map((_, index) => at(index)).join(" ");

  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={caption}
        className="relative h-40 w-full overflow-hidden rounded-xl bg-eavi-muted eavi-carved"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="eavi-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--eavi-fill)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--eavi-fill)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,100 ${line} 100,100`} fill="url(#eavi-trend-fill)" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--eavi-fill)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="flex justify-between text-xs text-eavi-muted-text">
        {series.map((point) => (
          <span key={point.label} className="tabular-nums">
            {point.label}
            <span className="ml-1 text-eavi-on-bg">{format(point.value)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A single share, drawn as a ring: what one figure is of another. */
export function Ring({
  ratio,
  label,
  caption,
}: {
  ratio: number;
  label: string;
  caption: string;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0)) * 100);
  return (
    <div className="flex items-center gap-4">
      <div role="img" aria-label={caption} className="relative size-24 shrink-0">
        <svg viewBox="0 0 42 42" className="size-full -rotate-90" aria-hidden>
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--eavi-muted)" strokeWidth="5" />
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="none"
            stroke="var(--eavi-secondary)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${percent} ${100 - percent}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
          {percent}%
        </span>
      </div>
      <p className="text-sm text-eavi-muted-text">{label}</p>
    </div>
  );
}

/** Ranked rows: the share each entry holds of the biggest one. */
export function Ranked({
  series,
  format = (value: number) => String(value),
}: {
  series: Series[];
  format?: (value: number) => string;
}) {
  const top = largest(series);
  return (
    <ul className="space-y-3">
      {series.map((point) => (
        <li key={point.label} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{point.label}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">{format(point.value)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-eavi-muted">
            <div
              className="h-full rounded-full bg-eavi-fill"
              style={{ width: `${Math.round((point.value / top) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
