import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./stat-card.module.css";

/**
 * A headline figure for a dashboard: a label, a tabular value, and an optional delta
 * with its period. The delta is always an arrow plus a number plus a period, never
 * colour alone (COL-05).
 */
export function StatCard({
  label,
  value,
  delta,
  period,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; direction: "up" | "down" | "neutral" };
  period?: string;
  hint?: string;
}) {
  return (
    <article data-slot="stat-card" className={styles.root}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{value}</p>
      {(delta || period) && (
        <p className={styles.deltaRow}>
          {delta ? (
            <span className={styles.delta} data-direction={delta.direction}>
              {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "·"} {delta.value}
            </span>
          ) : null}
          {period ? <span className={styles.period}>{period}</span> : null}
        </p>
      )}
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </article>
  );
}
