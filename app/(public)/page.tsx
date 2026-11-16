import { prisma } from "@/lib/prisma";
import { labels } from "@/lib/content/dashboard";
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
import type { Program } from "@/lib/content/home";

// The programme list is read from the database on every request, so the public site
// cannot be statically prerendered: a build-time render would freeze today's courses
// onto the page (and CI builds with no database at all).
export const dynamic = "force-dynamic";

/** The college's real, currently-admitting programmes — the same rows the office works on. */
async function programCards(): Promise<Program[]> {
  const rows = await prisma.program.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      name: true,
      description: true,
      durationMonths: true,
      minKcseGrade: true,
      type: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    title: row.name,
    level: row.type.name,
    duration: `${row.durationMonths} ${row.durationMonths === 1 ? "month" : "months"}`,
    // The office's own blurb when it wrote one; otherwise the entry grade, which is
    // real data, rather than filler text.
    description:
      row.description?.trim() ||
      `Minimum entry grade: ${labels.entryGrade[row.minKcseGrade] ?? row.minKcseGrade}.`,
  }));
}

export default async function HomePage() {
  const [programs, students] = await Promise.all([
    programCards(),
    // The hero's "Students" figure: everyone currently enrolled, straight from the ledger.
    prisma.studentProfile.count({ where: { enrollments: { some: { status: "ACTIVE" } } } }),
  ]);

  return (
    <>
      <OrganizationJsonLd />
      <Hero programmeCount={programs.length} studentCount={students} />
      <PortalSection />
      <WhySection />
      <ProgramsSection programs={programs} />
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
