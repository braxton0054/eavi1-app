import Link from "next/link";
import { ArrowRightIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Reveal } from "@/components/home/reveal";
import { ctaSection, contactSection, mainCampus, site } from "@/lib/content/home";

export function CtaBand() {
  return (
    <section
      id={contactSection.id}
      aria-labelledby="cta-heading"
      className="bg-eavi-band text-eavi-band-foreground"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-14 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-16">
        <Reveal className="flex flex-col items-start gap-2">
          <h2
            id="cta-heading"
            className="font-[var(--font-ui)] text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
            {ctaSection.heading}
          </h2>
          <p className="max-w-lg text-pretty text-sm leading-6 text-eavi-band-muted sm:text-base sm:leading-7">
            {ctaSection.subheading}
          </p>
        </Reveal>

        <Reveal delay={0.08} className="w-full sm:w-auto">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ShimmerButton
              asChild
              className="w-full px-8 py-4 text-base sm:w-auto"
            >
              <Link href="/apply">
                {ctaSection.apply}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </ShimmerButton>
            {/* Apply is the one primary action here; WhatsApp stays a quiet outline pill. */}
            <Button
              asChild
              variant="outline"
              className="h-14 w-full border-eavi-band-muted/50 bg-transparent px-8 text-base text-eavi-band-foreground hover:bg-eavi-band-muted/15 hover:text-eavi-band-foreground sm:w-auto"
            >
              <a
                href={site.whatsapp.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                {ctaSection.whatsapp(mainCampus.name)}
              </a>
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
