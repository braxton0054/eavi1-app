"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { shell } from "@/lib/content/dashboard";
import { cn } from "@/lib/utils";

/**
 * The campus a super admin is working in. Read-only for everyone else: a campus admin's
 * scope is their own campus and the server decides it, never this control.
 */
export function ScopePicker({ campusId, campuses }: { campusId: number | null; campuses: { id: number; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const value = campusId === null ? "all" : String(campusId);

  return (
    <div className="relative flex min-w-0 items-center">
      <label htmlFor="scope-campus" className="sr-only">
        {shell.scopeLabel}
      </label>
      <select
        id="scope-campus"
        value={value}
        disabled={pending}
        onChange={(event) => {
          // The scope is a server cookie, so the change is applied by the route handler and
          // the current screen is re-read afterwards: no client-side campus filtering.
          startTransition(async () => {
            await fetch(`/dashboard/scope?campus=${event.target.value}`, { method: "POST" });
            router.refresh();
          });
        }}
        className={cn(
          "h-11 max-w-[8.5rem] min-w-0 appearance-none truncate rounded-lg border border-eavi-border bg-eavi-card pr-7 pl-2 text-sm font-medium sm:max-w-[12rem]",
          pending && "opacity-60",
        )}
      >
        <option value="all">{shell.allCampuses}</option>
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 text-xs text-eavi-muted-text">
        {pending ? <Spinner className="size-3" /> : "▾"}
      </span>
      {/* The current pathname is only read so the control re-renders after a scope change. */}
      <span className="sr-only">{pathname}</span>
    </div>
  );
}
