import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-eavi-muted text-eavi-text",
  info: "bg-eavi-info-soft text-eavi-info-text",
  success: "bg-eavi-success-soft text-eavi-secondary-text",
  warning: "bg-eavi-warn-soft text-eavi-warn-text",
  danger: "bg-eavi-danger-soft text-eavi-destructive",
} as const;

export type ChipTone = keyof typeof tones;

const dot: Record<ChipTone, string> = {
  neutral: "bg-eavi-muted-text",
  info: "bg-eavi-info-text",
  success: "bg-eavi-secondary-text",
  warning: "bg-eavi-warn-text",
  danger: "bg-eavi-destructive",
};

/** The word carries the meaning; the dot only reinforces it. */
export function StatusChip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-eavi-border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dot[tone])} />
      {children}
    </span>
  );
}
