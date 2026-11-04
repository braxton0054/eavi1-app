import { MessageCircleIcon } from "lucide-react";
import { ctaSection, mainCampus, site } from "@/lib/content/home";

export function FloatingWhatsApp() {
  return (
    <a
      href={site.whatsapp.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ctaSection.whatsapp(mainCampus.name)}
      className="shadow-eavi-lift fixed right-4 bottom-4 z-40 flex size-12 items-center justify-center rounded-full bg-eavi-fill text-eavi-on-fill transition-colors hover:bg-eavi-fill-hover focus-visible:outline-2 focus-visible:outline-offset-4 motion-reduce:transition-none"
    >
      <MessageCircleIcon className="size-6" aria-hidden />
    </a>
  );
}
