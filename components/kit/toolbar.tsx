import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./toolbar.module.css";

/**
 * The bar above a list: a search field on the left, filters in the middle, and at most
 * one primary action on the right (CMP-20, CMP-21).
 */
export function Toolbar({
  search,
  filters,
  actions,
}: {
  search?: React.ReactNode;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div data-slot="toolbar" className={styles.root}>
      {search ? <div className={styles.search}>{search}</div> : null}
      {filters ? <div className={styles.filters}>{filters}</div> : null}
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}
