"use client";

import CircularGallery from "./circular-gallery/CircularGallery";
import { Section, SectionHeader } from "@/components/home/section";
import { gallerySection } from "@/lib/content/home";

/**
 * The campus-life gallery: a draggable WebGL carousel (React Bits' CircularGallery) over
 * the college's own photographs, served from /eavi-assets/web — those copies are resized
 * to 960px because the gallery holds every image as a GPU texture, and the originals in
 * "EAVI assets/" are up to 7 MB each.
 *
 * The titles are deliberately generic — they name the collection, not the specific
 * moment, because the office has not captioned the photographs yet.
 */

const TITLES = ["Campus life", "Around EAVI", "On campus", "Student life", "The college", "Campus scenes"];

// Every photograph the college sent, in the order the folders give them. The gallery
// loads textures lazily as cards approach, so the full set is safe on a phone.
const PHOTO_COUNT = 226;
const pad = (n: number) => String(n).padStart(3, "0");
const items = Array.from({ length: PHOTO_COUNT }, (_, index) => ({
  image: `/eavi-assets/web/${pad(index + 1)}.jpg`,
  text: TITLES[index % TITLES.length],
  alt: `A photograph of EAVI College — ${TITLES[index % TITLES.length].toLowerCase()}.`,
  description: "A photo from around EAVI College's campuses in Eldoret.",
}));

export function GallerySection() {
  return (
    <Section id={gallerySection.id} labelledBy="gallery-heading">
      <SectionHeader
        id="gallery-heading"
        eyebrow={gallerySection.eyebrow}
        heading={gallerySection.heading}
        subheading={gallerySection.subheading}
        onBackground
      />

      {/* The gallery renders its captions through WebGL with a fixed dark ink, so it
          keeps a light plate in the dark theme rather than inverting the text colour. */}
      <div
        className="mt-6 overflow-hidden rounded-2xl sm:mt-8"
        style={{ height: "min(68vh, 540px)", minHeight: 340, background: "var(--eavi-plate)" }}
      >
        <CircularGallery
          items={items}
          bend={2.4}
          // Dark ink on the light page: titles, focus ring and the loading placeholder.
          textColor="#1F2937"
          font="bold 30px system-ui"
          borderRadius={0.06}
          itemAspect={0.85}
          gap={0.24}
          scrollSpeed={1.6}
          scrollEase={0.06}
          wave={0.6}
          fadeEdges={0.14}
          shadow={0.3}
          autoScroll={0.35}
        />
      </div>
      <p className="mt-3 text-center text-xs text-eavi-muted-text">
        Drag through the photographs; click a card to open it.
      </p>
    </Section>
  );
}
