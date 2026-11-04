import { FloatingWhatsApp } from "@/components/home/floating-whatsapp";
import { SiteFooter } from "@/components/home/site-footer";
import { SiteHeader } from "@/components/home/site-header";
import { nav } from "@/lib/content/home";
import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-60 focus:rounded-lg focus:bg-eavi-fill focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-eavi-on-fill"
      >
        {nav.skipToContent}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
