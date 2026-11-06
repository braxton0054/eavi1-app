"use client";

import { Loader2Icon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { common } from "@/lib/content/dashboard";

/** useFormStatus only reports the form this button sits inside, so each form owns one. */
export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <ShimmerButton type="submit" disabled={pending} className="shrink-0">
      {pending ? <Loader2Icon aria-hidden className="animate-spin" data-slot="icon" /> : null}
      {pending ? common.loading : label}
    </ShimmerButton>
  );
}
