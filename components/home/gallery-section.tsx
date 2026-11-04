"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CameraIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Section, SectionHeader } from "@/components/home/section";
import { gallerySection, pending } from "@/lib/content/home";

type Photo = { src: string; caption: string; alt: string };

export function GallerySection() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<Photo | null>(null);

  const open = (photo: Photo) => {
    setActive(photo);
    dialogRef.current?.showModal();
  };

  return (
    <Section id={gallerySection.id} labelledBy="gallery-heading">
      <SectionHeader
        id="gallery-heading"
        eyebrow={gallerySection.eyebrow}
        heading={gallerySection.heading}
        subheading={gallerySection.subheading}
      />

      {gallerySection.items.length === 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((slot) => (
              <li key={slot}>
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-eavi-primary-soft/50">
                  <CameraIcon className="size-5 text-eavi-primary-text" aria-hidden />
                  <p className="px-3 text-center text-[11px] leading-4 text-eavi-muted-text">
                    {pending.label}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <ContentPlaceholder
            label={pending.label}
            note={pending.note}
            fields={gallerySection.pending}
          />
        </div>
      ) : (
        <>
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3">
            {gallerySection.items.map((photo) => (
              <li key={photo.src}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-auto rounded-2xl p-0 hover:bg-transparent"
                  onClick={() => open(photo)}
                  aria-label={gallerySection.openImage(photo.caption)}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    width={640}
                    height={480}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-foreground/10"
                  />
                </Button>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  {photo.caption}
                </p>
              </li>
            ))}
          </ul>

          <dialog
            ref={dialogRef}
            onClose={() => setActive(null)}
            aria-label={gallerySection.heading}
            className="m-auto rounded-2xl border border-border bg-card p-0 text-card-foreground backdrop:bg-eavi-band/70 backdrop:backdrop-blur-sm"
          >
            {active && (
              <div className="relative">
                <Image
                  src={active.src}
                  alt={active.alt}
                  width={1200}
                  height={900}
                  className="max-h-[70vh] w-auto max-w-[90vw] object-contain"
                />
                <p className="px-4 py-3 text-sm">{active.caption}</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => dialogRef.current?.close()}
                  aria-label={gallerySection.closeImage}
                  className="absolute top-2 right-2"
                >
                  <XIcon />
                </Button>
              </div>
            )}
          </dialog>
        </>
      )}
    </Section>
  );
}
