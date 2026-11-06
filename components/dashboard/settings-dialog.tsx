"use client";

import type { ReactNode } from "react";
import { SettingsIcon } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * The gear that opens the lists a programme is picked from. Everything inside is rendered
 * on the server and handed in as children, so opening it costs no extra data round trip.
 */
export function SettingsDialog({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-eavi-border bg-eavi-card px-3 text-sm font-medium text-eavi-on-card shadow-eavi-card transition-colors hover:bg-eavi-primary-soft focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <SettingsIcon aria-hidden className="size-4 text-eavi-primary-text" />
        {label}
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] gap-0 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2 pb-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
