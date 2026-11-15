import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./textarea.module.css";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea data-slot="textarea" className={cx(styles.root, className)} {...props} />
  );
}

export { Textarea };
