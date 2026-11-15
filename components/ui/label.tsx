"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cx } from "@/lib/cx";

import styles from "./label.module.css";

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root data-slot="label" className={cx(styles.root, className)} {...props} />
  );
}

export { Label };
