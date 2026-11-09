import Link from "next/link";
import type { Metadata } from "next";

import { Section } from "@/components/home/section";
import { legal, type LegalDocument } from "@/lib/content/legal";

/**
 * The shell both legal pages share.
 *
 * One component rather than two near-identical pages: a privacy notice and a set of terms read
 * best when they look the same, and keeping the layout in one place means a change to the
 * reading width or the heading rhythm cannot land on one and miss the other.
 *
 * Prose is set to a narrow measure at a comfortable line height, because these are the only
 * pages on the site someone actually reads end to end.
 */
export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <Section className="pt-28 pb-20">
      <article className="mx-auto w-full max-w-3xl">
        <header className="border-b border-eavi-border pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eavi-muted-text">
            {legal.updatedLabel} {document.updated}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-eavi-on-bg sm:text-4xl">
            {document.title}
          </h1>
          <p className="mt-3 text-pretty text-base leading-7 text-eavi-muted-text">
            {document.summary}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10">
          {document.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold tracking-tight text-eavi-on-bg">
                {section.heading}
              </h2>
              <div className="mt-3 flex flex-col gap-3">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="text-pretty text-base leading-7 text-eavi-muted-text">
                    {paragraph}
                  </p>
                ))}
              </div>
              {section.points ? (
                <ul className="mt-4 flex list-none flex-col gap-2 pl-0">
                  {section.points.map((point) => (
                    <li
                      key={point}
                      className="relative pl-5 text-pretty text-base leading-7 text-eavi-muted-text before:absolute before:left-0 before:top-[0.7em] before:size-1.5 before:rounded-full before:bg-eavi-primary-text"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {/*
          Bottom clearance for the floating WhatsApp button, which is fixed to the viewport
          corner. These pages are long enough that it otherwise sits over the last paragraph
          no matter where the reader is — on the apply page it only ever overlaps a short form.
        */}
        <footer className="mt-12 flex flex-col gap-3 border-t border-eavi-border pt-6 pb-20">
          <p className="text-sm leading-6 text-eavi-muted-text">{legal.contactBody("Eldoret")}</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-medium text-eavi-primary-text underline-offset-4 hover:underline"
          >
            {legal.backHome}
          </Link>
        </footer>
      </article>
    </Section>
  );
}

/** Metadata is built from the same document, so the title cannot drift from the heading. */
export function legalMetadata(document: LegalDocument): Metadata {
  return {
    title: document.title,
    description: document.summary,
    robots: { index: true, follow: true },
  };
}

export { legal };
