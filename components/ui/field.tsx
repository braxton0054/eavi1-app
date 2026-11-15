"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import { cx } from "@/lib/cx";

import styles from "./field.module.css";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cx(styles.set, className)} {...props} />;
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cx(styles.legend, className)}
      {...props}
    />
  );
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cx(styles.group, className)} {...props} />;
}

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & {
  orientation?: "vertical" | "horizontal" | "responsive";
}) {
  return (
    <div
      role="group"
      data-slot="field"
      /* "responsive" is treated as vertical: a form field is never narrowed to fit a
         label beside it (FRM-01). Checkboxes and radios ask for horizontal explicitly. */
      data-orientation={orientation === "horizontal" ? "horizontal" : "vertical"}
      className={cx(styles.field, className)}
      {...props}
    />
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-content" className={cx(styles.content, className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label data-slot="field-label" className={cx(styles.label, className)} {...props} />
  );
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-title" className={cx(styles.title, className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cx(styles.description, className)}
      {...props}
    />
  );
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & { children?: React.ReactNode }) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cx(styles.separator, className)}
      {...props}
    >
      {children && <span className={styles.separatorLabel}>{children}</span>}
    </div>
  );
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) return children;
    if (!errors?.length) return null;

    const unique = [...new Map(errors.map((error) => [error?.message, error])).values()];

    if (unique.length === 1) return unique[0]?.message;

    return (
      <ul className={styles.errorList}>
        {unique.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>,
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) return null;

  return (
    <div role="alert" data-slot="field-error" className={cx(styles.error, className)} {...props}>
      {content}
    </div>
  );
}

export {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
};
