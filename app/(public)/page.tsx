import { AdmissionsSection } from "@/components/home/admissions-section";
import { CampusesSection } from "@/components/home/campuses-section";
import { CtaBand } from "@/components/home/cta-band";
import { FaqSection } from "@/components/home/faq-section";
import { FeesSection } from "@/components/home/fees-section";
import { GallerySection } from "@/components/home/gallery-section";
import { Hero } from "@/components/home/hero";
import { OrganizationJsonLd } from "@/components/home/organization-json-ld";
import { PortalSection } from "@/components/home/portal-section";
import { ProgramsSection } from "@/components/home/programs-section";
import { TestimonialsSection } from "@/components/home/testimonials-section";
import { WhySection } from "@/components/home/why-section";

export default function HomePage() {
  return (
    <>
      <OrganizationJsonLd />
      <Hero />
      <PortalSection />
      <WhySection />
      <ProgramsSection />
      <AdmissionsSection />
      <FeesSection />
      <CampusesSection />
      <GallerySection />
      <TestimonialsSection />
      <FaqSection />
      <CtaBand />
    </>
  );
}
