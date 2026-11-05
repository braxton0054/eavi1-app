"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "cn";
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
import { pending, programsSection } from "@/lib/content/home";

const filterClass = "rounded-full px-5";

export function ProgramsSection() {
  const levels = useMemo(
    () => [
      programsSection.allLevels,
      ...Array.from(new Set(programsSection.items.map((item) => item.level))),
    ],
    [],
  );
  const [active, setActive] = useState<string>(programsSection.allLevels);
  const visible =
    active === programsSection.allLevels
      ? programsSection.items
      : programsSection.items.filter((item) => item.level === active);

  return (
    <Section id={programsSection.id} labelledBy="programs-heading">
      <SectionHeader
        id="programs-heading"
        eyebrow={programsSection.eyebrow}
        heading={programsSection.heading}
        subheading={programsSection.subheading}
      />

      {programsSection.items.length === 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:mt-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((slot) => (
              <div
                key={slot}
                className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-eavi-primary-soft/50 px-4 text-center text-xs font-medium text-eavi-muted-text"
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
          <div
            role="group"
            aria-label={programsSection.filterLabel}
            className="mt-6 flex flex-wrap gap-2"
          >
            {levels.map((level) => (
              <Button
                key={level}
                type="button"
                variant={level === active ? "default" : "outline"}
                aria-pressed={level === active}
                onClick={() => setActive(level)}
                className={cn(filterClass, level === active && "hover:bg-eavi-fill-hover")}
              >
                {level}
              </Button>
            ))}
          </div>

          <ul className="mt-6 grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((program) => (
              <li key={program.title} className="flex">
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
                    <div className="mt-auto flex gap-2">
                      <Button asChild variant="outline" className="rounded-full">
                        <Link href="/apply">{programsSection.apply}</Link>
                      </Button>
                      <Button asChild variant="ghost" className="rounded-full">
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
