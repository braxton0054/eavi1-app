import * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cx } from "@/lib/cx";

import styles from "./section-card.module.css";

/**
 * A card that owns a titled section of a page, with an optional action in its header.
 * Used for every block inside a record or a dashboard (CMP-05).
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cx(styles.root, className)}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </CardHeader>
      <CardContent className={styles.content}>{children}</CardContent>
    </Card>
  );
}
