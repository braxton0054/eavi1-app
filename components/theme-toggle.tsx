"use client";

import { useEffect, useState } from "react";
import { MoonIcon, SunIcon } from "lucide-react";

type Theme = "light" | "dark";

/**
 * Theme switch (DRK-07). The stored choice is applied to <html> before paint by the
 * inline script in app/layout.tsx; this component only keeps the button icon in sync
 * and writes the next choice. No layout flash, no injected styles.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // Deferred: setting state synchronously in an effect can cascade renders.
    const frame = requestAnimationFrame(() => {
      const current = document.documentElement.dataset.theme as Theme | undefined;
      if (current === "light" || current === "dark") setTheme(current);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("eavi-theme", next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      title={theme === "light" ? "Dark theme" : "Light theme"}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-eavi-muted-text hover:text-eavi-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-eavi-primary ${className}`}
    >
      {theme === "light" ? <MoonIcon aria-hidden className="size-5" /> : <SunIcon aria-hidden className="size-5" />}
    </button>
  );
}
