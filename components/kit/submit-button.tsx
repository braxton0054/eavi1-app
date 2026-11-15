import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * The submit button for a form. It is disabled while pending and will not accept a
 * second click, so a double submit is impossible (FRM-15).
 */
export function SubmitButton({
  pending = false,
  children,
  ...props
}: ButtonProps & { pending?: boolean }) {
  return (
    <Button type="submit" loading={pending} disabled={pending} {...props}>
      {children}
    </Button>
  );
}
