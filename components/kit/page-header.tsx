import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./page-header.module.css";

/**
 * The one header every screen uses. It retires the ad-hoc heading rows that used to sit
 * above every list and record (PRM-01).
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** A short label above the title, e.g. a section name. */
  eyebrow?: string;
}) {
  return (
    <header data-slot="page-header" className={styles.root}>
      <div className={styles.row}>
        <div className={styles.text}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
          <h1 className={styles.title}>{title}</h1>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
