import Link from "next/link";
import { ArrowRightIcon, ImagesIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/home/count-up";
import { Reveal } from "@/components/home/reveal";
import { hero, pending } from "@/lib/content/home";

export function Hero() {
  return (
    <section className="eavi-mesh relative overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10 lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-12">
        <Reveal className="flex flex-col items-start gap-5 lg:col-span-7">
          <p className="rounded-full border border-border bg-eavi-primary-soft px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-eavi-primary-text sm:text-xs">
            {hero.eyebrow}
          </p>

          <h1 className="cn-font-heading text-balance text-[2.35rem] leading-[1.02] font-semibold tracking-tight sm:text-[3.25rem] lg:text-[3.9rem]">
            {hero.heading}
            <span className="mt-2 block text-[1.35rem] font-medium tracking-tight text-eavi-primary-text sm:text-2xl lg:text-[1.75rem]">
              {hero.headingAccent}
            </span>
          </h1>

          <p className="max-w-xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {hero.subheading}
          </p>

          <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row">
            <Button
              asChild
              size="lg"
              className="w-full rounded-full hover:bg-eavi-fill-hover sm:w-auto"
            >
              <Link href="/register">
                {hero.apply}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full rounded-full sm:w-auto"
            >
              <Link href="/login">
                <LogInIcon data-icon="inline-start" />
                {hero.portal}
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.1}>
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-eavi-primary-soft/70 p-6 text-center sm:aspect-[5/4]">
            <span className="rounded-2xl border border-border bg-eavi-plate p-3">
              <ImagesIcon className="size-7 text-eavi-primary-text" aria-hidden />
            </span>
            <p className="cn-font-heading text-sm font-semibold">{hero.photoLabel}</p>
            <p className="text-xs leading-5 text-eavi-muted-text">
              {pending.label} — {hero.photoPending}
            </p>
          </div>
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-6 sm:pb-16 lg:pb-20">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {hero.trustHeading}
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {hero.trust.map((item) => (
            <div
              key={item.label}
              className="flex flex-col-reverse items-start gap-1 bg-background px-4 py-5"
            >
              <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="cn-font-heading text-2xl font-semibold text-eavi-primary-text sm:text-3xl">
                {item.value === null ? (
                  <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-sm font-medium text-eavi-muted-text">
                    {hero.pendingValue}
                  </span>
                ) : (
                  <CountUp value={item.value} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
