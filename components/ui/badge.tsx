import * as React from "react";
import { Slot } from "radix-ui";

import { cx } from "@/lib/cx";

import styles from "./badge.module.css";

type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "ghost"
  | "positive"
  | "attention"
  | "info"
  | "link";

export type BadgeProps = React.ComponentProps<"span"> & {
  variant?: BadgeVariant;
  asChild?: boolean;
};

/**
 * Status and tags. Colour is never the only signal: a status badge carries an icon and
 * a word (COL-05). Six visual variants plus the state set covers the whole product.
 */
function Badge({ className, variant = "default", asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cx(styles.root, className)}
      {...props}
    />
  );
}

export { Badge };
