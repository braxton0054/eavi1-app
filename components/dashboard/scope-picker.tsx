"use client";

import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { shell } from "@/lib/content/dashboard";

import styles from "./scope-picker.module.css";

/**
 * The campus a super admin is working in. Read-only for everyone else: a campus admin's
 * scope is their own campus and the server decides it, never this control.
 */
export function ScopePicker({
  campusId,
  campuses,
}: {
  campusId: number | null;
  campuses: { id: number; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const value = campusId === null ? "all" : String(campusId);

  return (
    <div className={styles.root}>
      <label htmlFor="scope-campus" className="srOnly">
        {shell.scopeLabel}
      </label>
      <select
        id="scope-campus"
        className={styles.select}
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
      >
        <option value="all">{shell.allCampuses}</option>
        {campuses.map((campus) => (
          <option key={campus.id} value={campus.id}>
            {campus.name}
          </option>
        ))}
      </select>

      <span className={styles.chevron} aria-hidden="true">
        {pending ? <Loader2Icon className={styles.spinner} /> : <ChevronDownIcon />}
      </span>

      {/* The current pathname is only read so the control re-renders after a scope change. */}
      <span className="srOnly">{pathname}</span>
    </div>
  );
}
