"use client";

import * as React from "react";
import { Separator as SeparatorPrimitive } from "radix-ui";

import { cx } from "@/lib/cx";

import styles from "./separator.module.css";

/**
 * A hairline between two blocks. Horizontal by default; a vertical one is used inside
 * rows and toolbars.
 */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cx(styles.root, className)}
      {...props}
    />
  );
}

export { Separator };
