import { Loader2Icon } from "lucide-react";

import { cx } from "@/lib/cx";

import styles from "./spinner.module.css";

/**
 * The one spinner. It is for work that finishes in under two seconds; anything longer
 * shows a skeleton instead (CMP-13).
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Loading"
      className={cx(styles.root, className)}
      {...props}
    />
  );
}

export { Spinner };
