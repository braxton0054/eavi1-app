import { Reveal } from "@/components/home/reveal";
import { Section, SectionHeader } from "@/components/home/section";
import { iconMap } from "@/components/home/icon-map";
import { whySection } from "@/lib/content/home";

export function WhySection() {
  return (
    <Section id={whySection.id} className="bg-muted" labelledBy="why-heading">
      <SectionHeader
        id="why-heading"
        eyebrow={whySection.eyebrow}
        heading={whySection.heading}
        subheading={whySection.subheading}
      />

      <ul className="mt-6 grid items-stretch gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {whySection.reasons.map((reason, index) => {
          const Icon = iconMap[reason.icon];
          return (
            <li key={reason.title} className="flex">
              <Reveal delay={index * 0.04} className="flex">
                <div className="eavi-lift flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-eavi-primary-soft">
                    <Icon className="size-5 text-eavi-primary-text" aria-hidden />
                  </span>
                  <p className="cn-font-heading text-base leading-snug font-semibold tracking-tight">
                    {reason.title}
                  </p>
                  {reason.detail && (
                    <p className="mt-auto text-xs leading-5 text-eavi-muted-text">
                      {reason.detail}
                    </p>
                  )}
                </div>
              </Reveal>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
