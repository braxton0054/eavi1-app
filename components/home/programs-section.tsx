"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "cn";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ContentPlaceholder } from "@/components/home/content-placeholder";
import { Section, SectionHeader } from "@/components/home/section";
import { pending, programsSection, type Program } from "@/lib/content/home";

export function ProgramsSection({ programs }: { programs?: Program[] }) {
  // The page hands in the live programme list; the content file's (empty) array is the
  // fallback so the section still renders if the caller has none.
  const items = programs && programs.length > 0 ? programs : programsSection.items;
  const levels = useMemo(
    () => [
      programsSection.allLevels,
      ...Array.from(new Set(items.map((item) => item.level))),
    ],
    [items],
  );
  const [active, setActive] = useState<string>(programsSection.allLevels);
  const visible =
    active === programsSection.allLevels
      ? items
      : items.filter((item) => item.level === active);

  return (
    <Section id={programsSection.id} labelledBy="programs-heading">
      <SectionHeader
        id="programs-heading"
        eyebrow={programsSection.eyebrow}
        heading={programsSection.heading}
        subheading={programsSection.subheading}
        onBackground
      />

      {items.length === 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-eavi-primary-soft px-4 text-center text-xs font-medium text-eavi-muted-text"
              >
                {pending.label}
              </div>
            ))}
          </div>
          <ContentPlaceholder
            label={programsSection.heading}
            note={pending.note}
            fields={programsSection.pending}
          />
        </div>
      ) : (
        <>
          {/* Filter chips are quiet toggles, not shimmer CTAs — the accent belongs to the
              apply buttons. The active chip fills so the state is visible, not just
              announced (rule 80), and every chip keeps a 44px touch target. */}
          <div
            role="group"
            aria-label={programsSection.filterLabel}
            className="mt-6 flex flex-wrap gap-2"
          >
            {levels.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={level === active}
                onClick={() => setActive(level)}
                className={cn(
                  "flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors",
                  level === active
                    ? "border-transparent bg-eavi-fill text-eavi-on-fill"
                    : "border-border bg-card text-eavi-on-bg hover:bg-eavi-primary-soft",
                )}
              >
                {level}
              </button>
            ))}
          </div>

          <ul className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((program) => (
              <li key={program.id} className="flex">
                <Card size="sm" className="eavi-lift h-full w-full">
                  <CardHeader>
                    <CardTitle className="text-base">{program.title}</CardTitle>
                    <CardDescription>
                      {program.level} · {program.duration}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {program.description}
                    </p>
                    {/* One primary action per card (rule 75): Apply shimmers, Learn more
                        is the quiet outline pill. */}
                    <div className="mt-auto flex flex-wrap gap-2">
                      <ShimmerButton asChild>
                        <Link href="/apply">{programsSection.apply}</Link>
                      </ShimmerButton>
                      <Button
                        asChild
                        variant="outline"
                        size="lg"
                        className="border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
                      >
                        <Link href={programsSection.learnMoreHref}>
                          {programsSection.learnMore}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}
