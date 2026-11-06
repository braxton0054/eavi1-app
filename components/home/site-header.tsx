"use client";

import Link from "next/link";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/home/site-logo";
import { nav, site } from "@/lib/content/home";

const menuButtonClass =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <header className="eavi-glass sticky top-0 z-50 border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <SiteLogo
          href="/"
          name={site.name}
          shortName={site.shortName}
          alt={site.logoAlt}
        />

        <nav aria-label={nav.ariaLabel} className="hidden items-center lg:flex">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                menuButtonClass,
                "text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-primary-text",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Button
            asChild
            variant="outline"
            className="hidden rounded-full md:inline-flex"
          >
            <Link href="/login">{nav.portalLogin}</Link>
          </Button>
          <Button
            asChild
            className="rounded-full px-4 hover:bg-eavi-fill-hover"
          >
            <Link href="/apply">{nav.apply}</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-expanded={open}
            aria-controls="site-menu"
            aria-label={open ? nav.closeMenu : nav.menu}
            className="lg:hidden"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>

      <div
        id="site-menu"
        hidden={!open}
        className="border-t border-border bg-eavi-card lg:hidden"
      >
        <nav
          aria-label={nav.ariaLabel}
          className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-3 sm:px-6"
        >
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={cn(
                menuButtonClass,
                "text-foreground hover:bg-eavi-primary-soft hover:text-eavi-primary-text",
              )}
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/login" onClick={() => setOpen(false)}>
                {nav.portalLogin}
              </Link>
            </Button>
            <Button asChild className="rounded-full hover:bg-eavi-fill-hover">
              <Link href="/apply" onClick={() => setOpen(false)}>
                {nav.apply}
              </Link>
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
