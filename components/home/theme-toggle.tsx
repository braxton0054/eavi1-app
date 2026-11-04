"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nav } from "@/lib/content/home";

const order = ["system", "light", "dark"] as const;
type ThemeChoice = (typeof order)[number];

const subscribe = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes reads the applied class during the client's first render while the server
  // has no theme at all, so hydration must both render "system" and re-render after mount.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current: ThemeChoice =
    mounted && (resolvedTheme === "light" || resolvedTheme === "dark")
      ? resolvedTheme
      : "system";
  const nextChoice = order[(order.indexOf(current) + 1) % order.length];
  const label = nav.theme[current];
  const Icon = current === "light" ? SunIcon : current === "dark" ? MoonIcon : MonitorIcon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(nextChoice)}
      title={`${nav.theme.label}: ${label}`}
      aria-label={`${nav.theme.label}: ${label}. Select ${nav.theme[nextChoice]}.`}
    >
      <Icon />
    </Button>
  );
}
