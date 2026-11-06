import { SearchIcon } from "lucide-react";

import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { common, pagination } from "@/lib/content/dashboard";
import { cn } from "@/lib/utils";

export type Choice = { value: string; label: string };

function query(q: string | undefined, status: string | undefined) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const asString = params.toString();
  return asString ? `?${asString}` : "";
}

/**
 * A GET form rather than a client component: the filter survives a reload, can be
 * bookmarked, and costs no JavaScript on the campus laptop with the bad connection.
 */
export function ListFilters({
  basePath,
  q,
  status,
  statuses,
  searchLabel,
}: {
  basePath: string;
  q?: string;
  status?: string;
  statuses?: readonly Choice[];
  searchLabel: string;
}) {
  const searchId = `${basePath}-search`;
  const statusId = `${basePath}-status`;

  return (
    <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
      <div className="flex min-w-[12rem] flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor={searchId}>{searchLabel}</Label>
        <Input id={searchId} name="q" type="search" defaultValue={q} placeholder={common.searchPlaceholder} />
      </div>

      {statuses ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={statusId}>{common.filter}</Label>
          <select
            id={statusId}
            name="status"
            defaultValue={status ?? ""}
            className="h-11 rounded-lg border border-input bg-eavi-card eavi-carved px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">{common.allStatuses}</option>
            {statuses.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <input type="hidden" name="page" value="1" />

      <ShimmerButton type="submit" className="shrink-0">
        {common.search}
      </ShimmerButton>
      {q || status ? (
        <a
          href={basePath}
          className={cn(
            "inline-flex min-h-11 items-center px-2 text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline",
          )}
        >
          {common.clear}
        </a>
      ) : null}
    </form>
  );
}

export function Paginator({
  basePath,
  page,
  total,
  q,
  status,
}: {
  basePath: string;
  page: number;
  total: number;
  q?: string;
  status?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pagination.window));
  if (pages === 1) {
    return <p className="text-sm text-eavi-muted-text">{pagination.label(1, total, total)}</p>;
  }

  const tail = query(q, status);
  const link = (target: number) =>
    `${basePath}?page=${target}${tail ? `&${tail.slice(1)}` : ""}`;

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={common.page}>
      <p className="text-sm text-eavi-muted-text">{pagination.label(page, pagination.window, total)}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <a
            href={link(page - 1)}
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium hover:bg-eavi-muted"
          >
            {common.previous}
          </a>
        ) : null}
        <span className="text-sm tabular-nums text-eavi-muted-text">
          {page} / {pages}
        </span>
        {page < pages ? (
          <a
            href={link(page + 1)}
            className="inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium hover:bg-eavi-muted"
          >
            {common.next}
          </a>
        ) : null}
      </div>
    </nav>
  );
}

export function ResultCount({ total }: { total: number }) {
  return (
    <p className="flex items-center gap-2 text-sm text-eavi-muted-text">
      <SearchIcon aria-hidden className="size-4" />
      {total} {common.results}
    </p>
  );
}

/** A year step: a link while the window has road left, a plain label once it does not. */
export function StepLink({
  href,
  label,
  ariaLabel,
}: {
  href: string | null;
  label: string;
  ariaLabel: string;
}) {
  const className =
    "inline-flex min-h-11 items-center rounded-lg border border-eavi-border px-3 text-sm font-medium";

  return href ? (
    <a
      href={href}
      aria-label={ariaLabel}
      className={`${className} text-eavi-primary-text hover:bg-eavi-muted`}
    >
      {label}
    </a>
  ) : (
    <span aria-disabled="true" aria-label={ariaLabel} className={`${className} opacity-50`}>
      {label}
    </span>
  );
}
