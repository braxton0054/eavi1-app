import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./empty-state.module.css";

/**
 * A reserved space when there is nothing to show. The headline names the state, the
 * single line of explanation says why, and the one action says what to do next
 * (CMP-12). First-use and no-results are visually distinct so the user is never
 * confused about which one they are looking at.
 */
export function EmptyState({
  title,
  description,
  action,
  variant = "no-results",
  icon,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  variant?: "first-use" | "no-results" | "cleared" | "error";
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      className={styles.root}
    >
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
