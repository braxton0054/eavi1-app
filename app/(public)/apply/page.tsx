import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import { ApplicationForm } from "@/components/application-form";
import { Section, SectionHeader } from "@/components/home/section";
import { Skeleton } from "@/components/ui/skeleton";
import { applyPage } from "@/lib/content/apply";
import { campuses } from "@/lib/campuses";
import { getApplyOptions } from "@/lib/dal/public";

export const metadata: Metadata = {
  title: applyPage.title,
  description: applyPage.metaDescription,
};

/** Rendered per request: the build has no database, and the programme list changes. */
export const dynamic = "force-dynamic";

/** The programme list comes from the database, so it streams in after the page shell. */
async function ApplyForm() {
  const options = await getApplyOptions();
  return <ApplicationForm programs={options.programs} />;
}

function ApplyFormFallback() {
  return (
    <div className="flex w-full flex-col gap-4 rounded-2xl border border-eavi-border bg-eavi-plate p-6">
      <Skeleton className="h-6 w-40 rounded-md" />
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-11 w-full rounded-full" />
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Section className="pb-20">
      <SectionHeader
        eyebrow={applyPage.eyebrow}
        heading={applyPage.introHeading}
        subheading={applyPage.introSubheading}
      />

      <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Suspense fallback={<ApplyFormFallback />}>
          <ApplyForm />
        </Suspense>

        <aside className="flex flex-col gap-4 rounded-2xl border border-eavi-border bg-eavi-muted p-5">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-semibold">{applyPage.aside.heading}</p>
            <p className="text-sm leading-6 text-eavi-muted-text">{applyPage.aside.body}</p>
          </div>

          <ul className="flex flex-col gap-3">
            {campuses.map((campus) => (
              <li key={campus.name} className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-eavi-muted-text">
                  {campus.name}
                </span>
                <a
                  href={`tel:${campus.tel}`}
                  className="min-h-11 w-fit inline-flex items-center rounded-lg text-sm font-semibold text-eavi-primary-text underline-offset-4 hover:underline"
                >
                  <span className="tabular-nums">{campus.phone}</span>
                  <span className="sr-only">
                    {applyPage.aside.call} {campus.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            className="min-h-11 inline-flex items-center text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
          >
            {applyPage.aside.portal}
          </Link>
        </aside>
      </div>
    </Section>
  );
}
