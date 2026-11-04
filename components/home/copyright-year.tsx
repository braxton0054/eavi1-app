"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Cache Components refuses `new Date()` during prerendering, so the year is read on the
 * client only. The server renders an empty slot for it.
 */
export function CopyrightYear({ template }: { template: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => template.replace("{year}", String(new Date().getFullYear())),
    () => "",
  );
  return <span suppressHydrationWarning>{text}</span>;
}
