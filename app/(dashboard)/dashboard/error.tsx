"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { common } from "@/lib/content/dashboard";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 py-16">
      <h1 className="text-xl font-semibold">{common.errorTitle}</h1>
      <p className="text-sm text-eavi-muted-text">{common.loadError}</p>
      {error.digest ? (
        <p className="text-xs text-eavi-muted-text">Ref: {error.digest}</p>
      ) : null}
      <Button onClick={reset}>{common.retry}</Button>
    </div>
  );
}
