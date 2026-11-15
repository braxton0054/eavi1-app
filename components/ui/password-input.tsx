"use client";

import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cx } from "@/lib/cx";

import styles from "./password-input.module.css";

/**
 * A password field with a visibility toggle (FRM-19): people verify what they typed
 * instead of submitting blind. The toggle is a real button with an accessible name and
 * `aria-pressed`, and it never blocks paste (FRM-08).
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className={styles.root}>
      <Input
        ref={ref}
        type={visible ? "text" : "password"}
        className={cx(styles.input, className)}
        {...props}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
        className={styles.toggle}
      >
        {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
      </button>
    </div>
  );
});
