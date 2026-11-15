import * as React from "react";

import { cx } from "@/lib/cx";

/**
 * Money in Kenyan shillings, always tabular and always labelled. The currency is never
 * implied by the absence of a word (TYP-26, CMP-68).
 */
export function Money({
  value,
  currency = "KES",
  className,
}: {
  value: number | string;
  currency?: string;
  className?: string;
}) {
  const numeric = typeof value === "string" ? Number(value) : value;
  const formatted = Number.isFinite(numeric)
    ? new Intl.NumberFormat("en-KE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
    : String(value);

  return (
    <span className={className} data-numeric>
      {currency} {formatted}
    </span>
  );
}
