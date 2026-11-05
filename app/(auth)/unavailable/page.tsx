import { AlertTriangleIcon } from "lucide-react";

import { signOut } from "@/lib/actions/auth";
import { shell } from "@/lib/content/dashboard";

export const metadata = {
  title: shell.unavailable.title,
  robots: { index: false, follow: false },
};

// Reads `?reason=` from the guard redirect, so the route blocks rather than streams.

/**
 * Outside the portal route group on purpose: this screen is for people the portal guard
 * turns away, so it must never call that guard itself.
 */
export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="w-full max-w-md rounded-3xl border border-eavi-border bg-eavi-card p-6 shadow-eavi-card sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-eavi-warn-soft text-eavi-warn-text">
        <AlertTriangleIcon aria-hidden className="size-5" />
      </span>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">{shell.unavailable.title}</h1>
      <p className="mt-2 text-sm text-eavi-muted-text">
        {reason === "unassigned" ? shell.unavailable.unassigned : shell.unavailable.body}
      </p>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-eavi-fill px-4 text-sm font-semibold text-eavi-on-fill transition-colors hover:bg-eavi-fill-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eavi-primary"
        >
          {shell.account.signOut}
        </button>
      </form>
    </div>
  );
}
