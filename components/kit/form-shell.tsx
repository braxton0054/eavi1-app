import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./form-shell.module.css";

/**
 * The wrapper for every long form: fieldsets stacked, a sticky action bar on a phone
 * so Save and Cancel are always reachable (FRM-15, MOB-36).
 */
export function FormShell({
  children,
  actions,
  title,
  description,
  className,
}: {
  children: React.ReactNode;
  actions: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <form className={cx(styles.root, className)} noValidate>
      {title || description ? (
        <header className={styles.head}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {description ? <p className={styles.description}>{description}</p> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </form>
  );
}
