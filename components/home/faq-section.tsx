import { ChevronDownIcon } from "lucide-react";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Section, SectionHeader } from "@/components/home/section";
import { faqSection, pending } from "@/lib/content/home";

export function FaqSection() {
  return (
    <Section id={faqSection.id} labelledBy="faq-heading">
      <SectionHeader
        id="faq-heading"
        eyebrow={faqSection.eyebrow}
        heading={faqSection.heading}
        subheading={faqSection.subheading}
      />

      <div className="mt-6 flex flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card sm:mt-8">
        {faqSection.items.map((item) => (
          <details key={item.question} className="group/faq">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold transition-colors hover:bg-eavi-primary-soft/60 [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDownIcon
                className="size-4 shrink-0 text-eavi-primary-text transition-transform group-open/faq:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-5 pb-5 text-sm leading-6 text-muted-foreground">
              {item.answer ?? (
                <ContentPlaceholder
                  label={pending.label}
                  note={faqSection.pendingAnswer}
                />
              )}
            </div>
          </details>
        ))}
      </div>
    </Section>
  );
}
