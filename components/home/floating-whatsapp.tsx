"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { MessageCircleIcon } from "lucide-react";
import { ctaSection, mainCampus, site } from "@/lib/content/home";

export function FloatingWhatsApp() {
  /**
   * On a phone the docked corner sits over the content column, so the button steps out
   * of the way while a form field has focus instead of covering a control.
   */
  const [yielding, setYielding] = useState(false);

  useEffect(() => {
    const narrow = window.matchMedia("(max-width: 40rem)");

    const focusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      setYielding(narrow.matches && !!target?.closest("form"));
    };
    const focusOut = (event: FocusEvent) => {
      const next = event.relatedTarget as HTMLElement | null;
      if (!next?.closest("form")) setYielding(false);
    };

    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    return () => {
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
    };
  }, []);

  return (
    <a
      href={site.whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ctaSection.whatsapp(mainCampus.name)}
      aria-hidden={yielding || undefined}
      tabIndex={yielding ? -1 : undefined}
      style={{ opacity: yielding ? 0 : 1 }}
      className={cn(
        "shadow-eavi-lift fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-eavi-fill text-eavi-on-fill transition-opacity hover:bg-eavi-fill-hover focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none",
        yielding && "pointer-events-none",
      )}
    >
      <MessageCircleIcon className="size-6" aria-hidden />
    </a>
  );
}
