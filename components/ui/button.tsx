import * as React from "react";
import { Loader2Icon } from "lucide-react";
import { Slot } from "radix-ui";

import { cx } from "@/lib/cx";

import styles from "./button.module.css";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "destructive"
  | "link";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg";

export type ButtonProps = React.ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  asChild?: boolean;
  /** Shows a spinner in place of the label and blocks a second submit (FRM-15). */
  loading?: boolean;
};

/**
 * The one button. Appearance lives in button.module.css and is selected by
 * `data-variant` / `data-size`, so callers pass props instead of class strings.
 */
function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cx(styles.root, className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          <span className={styles.label}>{children}</span>
          {loading && (
            <span className={styles.spinner} data-slot="button-spinner" aria-hidden="true">
              <Loader2Icon />
            </span>
          )}
        </>
      )}
    </Comp>
  );
}

export { Button };
