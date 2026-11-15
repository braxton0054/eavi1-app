import { cx } from "@/lib/cx";

import styles from "./skeleton.module.css";

/**
 * A shape that mirrors the content it replaces, so the layout does not move when the
 * real data arrives (STA-01, STA-18).
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cx(styles.root, className)}
      {...props}
    />
  );
}

export { Skeleton };
