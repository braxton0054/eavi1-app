import Link from "next/link";
import { ArrowRightIcon, DownloadIcon } from "lucide-react";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Reveal } from "@/components/home/reveal";
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
          <ShimmerButton asChild className="px-8 py-4 text-base">
            <Link href="/apply">
              {admissionsSection.apply}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </ShimmerButton>
        }
      />

      <ol className="mt-6 grid items-stretch gap-4 sm:mt-8 lg:grid-cols-3">
        {admissionsSection.steps.map((step, index) => (
          <li key={step.title} className="flex">
            <Reveal delay={index * 0.06} className="flex">
              <div className="eavi-lift flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <span className="cn-font-heading flex size-9 items-center justify-center rounded-full bg-eavi-fill text-sm font-semibold text-eavi-on-fill">
                    {index + 1}
                  </span>
                  <p className="cn-font-heading text-base font-semibold tracking-tight">
                    {step.title}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{step.line}</p>
                {"href" in step && step.href && (
                  <ShimmerButton
                    asChild
                    className="mt-auto self-start"
                  >
                    <Link href={step.href}>{step.action}</Link>
                  </ShimmerButton>
                )}
              </div>
            </Reveal>
          </li>
        ))}
      </ol>

      <div className="mt-6 sm:mt-8">
        {admissionsSection.requirements.href ? (
          <ShimmerButton asChild>
            <a href={admissionsSection.requirements.href} download>
              <DownloadIcon data-icon="inline-start" />
              {admissionsSection.requirements.label}
            </a>
          </ShimmerButton>
        ) : (
          <ContentPlaceholder
            className="sm:max-w-md"
            label={admissionsSection.requirements.label}
            note={admissionsSection.requirements.pending}
          />
        )}
      </div>
    </Section>
  );
}
