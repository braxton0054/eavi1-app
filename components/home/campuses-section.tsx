import { CampusCard } from "@/components/home/campus-card";
import { Reveal } from "@/components/home/reveal";
import { Section, SectionHeader } from "@/components/home/section";
import { campuses, campusesSection } from "@/lib/content/home";

export function CampusesSection() {
  return (
    <Section id={campusesSection.id} className="bg-muted" labelledBy="campuses-heading">
      <SectionHeader
        id="campuses-heading"
        eyebrow={campusesSection.eyebrow}
        heading={campusesSection.heading}
        subheading={campusesSection.subheading}
      />

      <div className="mt-6 grid items-stretch gap-4 sm:mt-8 md:grid-cols-2 lg:grid-cols-3">
        {campuses.map((campus, index) => (
          <Reveal key={campus.name} delay={index * 0.06} className="flex">
            <CampusCard campus={campus} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
