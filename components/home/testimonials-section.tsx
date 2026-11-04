"use client";

import { ChevronLeftIcon, ChevronRightIcon, QuoteIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Section, SectionHeader } from "@/components/home/section";
import { pending, testimonialsSection } from "@/lib/content/home";

export function TestimonialsSection() {
  const [index, setIndex] = useState(0);
  const total = testimonialsSection.items.length;
  const current = testimonialsSection.items[index];

  const step = (delta: number) =>
    setIndex((value) => (value + delta + total) % total);

  return (
    <Section
      id={testimonialsSection.id}
      className="bg-muted"
      labelledBy="stories-heading"
    >
      <SectionHeader
        id="stories-heading"
        eyebrow={testimonialsSection.eyebrow}
        heading={testimonialsSection.heading}
        subheading={testimonialsSection.subheading}
      />

      {total === 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <div className="flex min-h-40 flex-col items-start justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6">
            <QuoteIcon className="size-6 text-eavi-primary-soft" aria-hidden />
            <p className="text-sm text-eavi-muted-text">{pending.label}</p>
          </div>
          <ContentPlaceholder
            label={pending.label}
            note={pending.note}
            fields={testimonialsSection.pending}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <figure
            className="rounded-2xl border border-border bg-card p-6"
            aria-live="polite"
          >
            <QuoteIcon className="size-6 text-eavi-primary-text" aria-hidden />
            <blockquote className="mt-3 text-pretty text-base leading-7 sm:text-lg sm:leading-8">
              {current?.quote}
            </blockquote>
            <figcaption className="mt-4 text-sm">
              <span className="font-semibold">{current?.name}</span>
              <span className="text-muted-foreground"> · {current?.detail}</span>
            </figcaption>
          </figure>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => step(-1)}
              aria-label={testimonialsSection.previous}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={() => step(1)}
              aria-label={testimonialsSection.next}
            >
              <ChevronRightIcon />
            </Button>
            <p className="text-xs font-medium text-muted-foreground tabular-nums">
              {testimonialsSection.slidePosition(index + 1, total)}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}
