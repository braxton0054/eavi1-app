"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { common } from "@/lib/content/dashboard";

/** useFormStatus only reports the form this button sits inside, so each form owns one. */
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2Icon aria-hidden className="animate-spin" data-slot="icon" /> : null}
      {pending ? common.loading : label}
    </Button>
  );
}
