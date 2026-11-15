import * as React from "react";

import { cx } from "@/lib/cx";

import styles from "./alert.module.css";

type AlertVariant = "default" | "info" | "positive" | "attention" | "destructive";

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      data-slot="alert"
      role="alert"
      data-variant={variant}
      className={cx(styles.root, className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cx(styles.title, className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-description" className={cx(styles.description, className)} {...props} />
  );
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cx(styles.action, className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription, AlertAction };
