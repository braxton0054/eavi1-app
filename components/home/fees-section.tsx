import { Section, SectionHeader } from "@/components/home/section";
import { Button } from "@/components/ui/button";
import { feesSection, mainCampus } from "@/lib/content/home";

export function FeesSection() {
  return (
    <Section id={feesSection.id} labelledBy="fees-heading">
      <SectionHeader
        id="fees-heading"
        eyebrow={feesSection.eyebrow}
        heading={feesSection.heading}
        subheading={feesSection.subheading}
        onBackground
        action={
          <Button
            asChild
            variant="outline"
            className="border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
          >
            <a href={`tel:${mainCampus.tel}`}>
              {feesSection.enquire}
              <span className="sr-only">{mainCampus.phone}</span>
            </a>
          </Button>
        }
      />

      {feesSection.items.length === 0 ? (
        /* No invented fee figures: a compact, honest panel instead of an empty table. */
        <div className="mt-6 rounded-2xl border border-border bg-card px-5 py-6 sm:mt-8 sm:px-7 sm:py-8">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Fee structures are published per programme by the finance office. Call the
            campus you plan to join for the current tuition, other charges and payment
            plan — the office will confirm the figures for your intake.
          </p>
          <a
            href={`tel:${mainCampus.tel}`}
            className="mt-4 inline-flex min-h-11 items-center font-medium text-eavi-primary-text underline underline-offset-4 hover:text-eavi-primary-hover"
          >
            Call {mainCampus.name} · {mainCampus.phone}
          </a>
        </div>
      ) : null}
    </Section>
  );
}
