import Link from "next/link";
import { ArrowRightIcon, DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section, SectionHeader } from "@/components/home/section";
import { admissionsSection } from "@/lib/content/home";

export function AdmissionsSection() {
  return (
    <Section
      id={admissionsSection.id}
      className="bg-muted"
      labelledBy="admissions-heading"
    >
      <SectionHeader
        id="admissions-heading"
        eyebrow={admissionsSection.eyebrow}
        heading={admissionsSection.heading}
        subheading={admissionsSection.subheading}
        action={
          <Button asChild variant="outline" className="border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg">
            <Link href="/apply">
              {admissionsSection.apply}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        }
      />

      <ol className="mt-6 grid items-start gap-4 sm:mt-8 lg:grid-cols-3">
        {admissionsSection.steps.map((step, index) => (
          <li key={step.title} className="flex">
            <div className="flex w-full">
              <div className="eavi-lift flex w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="font-[var(--font-ui)] flex size-9 items-center justify-center rounded-full bg-eavi-fill text-sm font-semibold text-eavi-on-fill">
                    {index + 1}
                  </span>
                  <p className="font-[var(--font-ui)] text-base font-semibold tracking-tight">
                    {step.title}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{step.line}</p>
                {/* Step actions stay quiet: the section's one shimmer CTA is the header
                    Apply button, so the steps don't compete with it. */}
                {"href" in step && step.href && (
                  <Button
                    asChild
                    variant="outline"
                    className="self-start border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
                  >
                    <Link href={step.href}>{step.action}</Link>
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 sm:mt-8">
        {admissionsSection.requirements.href ? (
          <Button
            asChild
            variant="outline"
            className="border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
          >
            <a href={admissionsSection.requirements.href} download>
              <DownloadIcon data-icon="inline-start" />
              {admissionsSection.requirements.label}
            </a>
          </Button>
        ) : null}
      </div>
    </Section>
  );
}
