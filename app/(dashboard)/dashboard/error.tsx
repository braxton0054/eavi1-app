"use client";

import { useEffect } from "react";

import { ShimmerButton } from "@/components/magicui/shimmer-button";
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
      <h1 className="text-xl font-semibold text-eavi-on-bg">{common.errorTitle}</h1>
      <p className="text-sm text-eavi-on-bg">{common.loadError}</p>
      {error.digest ? (
        <p className="text-xs text-eavi-on-bg">Ref: {error.digest}</p>
      ) : null}
      <ShimmerButton onClick={reset}>{common.retry}</ShimmerButton>
    </div>
  );
}
