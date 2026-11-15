import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./metric-row.module.css";

/**
 * A single labelled figure in a dense list. Used for the rows of a record, a summary
 * panel, or a fee breakdown.
 */
export function MetricRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div data-slot="metric-row" className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
