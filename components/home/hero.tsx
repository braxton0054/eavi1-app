import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, ImagesIcon, LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { CountUp } from "@/components/home/count-up";
import { Reveal } from "@/components/home/reveal";
import { hero, pending } from "@/lib/content/home";

export function Hero({
  programmeCount,
  studentCount,
}: {
  /** Live counts from the database; null keeps the honest TODO chip. */
  programmeCount?: number | null;
  studentCount?: number | null;
}) {
  const liveValue = (item: { label: string; value: number | null }) => {
    if (item.value !== null) return item.value;
    if (item.label.startsWith("Programmes") && programmeCount != null) return programmeCount;
    if (item.label.startsWith("Students") && studentCount != null) return studentCount;
    return null;
  };

  return (
    <section className="eavi-mesh relative overflow-hidden border-b border-border">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pt-12 pb-8 sm:px-6 sm:pt-16 sm:pb-10 lg:grid-cols-12 lg:gap-12 lg:pt-20 lg:pb-12">
        <Reveal className="flex flex-col items-start gap-5 lg:col-span-7">
          <p className="rounded-full border border-border bg-eavi-primary-soft px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-eavi-primary-text sm:text-xs">
            {hero.eyebrow}
          </p>

          <h1 className="cn-font-heading text-balance text-[2.35rem] leading-[1.02] font-semibold tracking-tight text-eavi-on-bg sm:text-[3.25rem] lg:text-[3.9rem]">
            {hero.heading}
            <span className="mt-2 block text-[1.35rem] font-medium tracking-tight text-eavi-on-bg sm:text-2xl lg:text-[1.75rem]">
              {hero.headingAccent}
            </span>
          </h1>

          <p className="max-w-xl text-pretty text-base leading-7 text-eavi-on-bg sm:text-lg sm:leading-8">
            {hero.subheading}
          </p>

          {/* One primary action per view (rule 75): Apply carries the shimmer; the portal
              link stays a quiet outline pill so the eye lands on the apply button first. */}
          <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row">
            <ShimmerButton
              asChild
              className="w-full px-8 py-4 text-base sm:w-auto"
            >
              <Link href="/apply">
                {hero.apply}
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </ShimmerButton>
            <Button
              asChild
              variant="outline"
              className="h-14 w-full border-eavi-border/70 bg-eavi-primary-soft px-8 text-base text-eavi-on-bg hover:bg-eavi-info-soft hover:text-eavi-on-bg sm:w-auto"
            >
              <Link href="/login">
                <LogInIcon data-icon="inline-start" />
                {hero.portal}
              </Link>
            </Button>
          </div>
        </Reveal>

        <Reveal className="lg:col-span-5" delay={0.1}>
          {hero.photo ? (
            <Image
              src={hero.photo}
              alt={hero.photoAlt}
              width={1200}
              height={960}
              priority
              className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-foreground/10 sm:aspect-[5/4]"
            />
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-eavi-primary-soft p-6 text-center sm:aspect-[5/4]">
              <span className="rounded-2xl border border-border bg-eavi-plate p-3">
                <ImagesIcon className="size-7 text-eavi-primary-text" aria-hidden />
              </span>
              <p className="cn-font-heading text-sm font-semibold">{hero.photoLabel}</p>
              <p className="text-xs leading-5 text-eavi-muted-text">
                {pending.label} — {hero.photoPending}
              </p>
            </div>
          )}
        </Reveal>
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 pb-12 sm:px-6 sm:pb-16 lg:pb-20">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-eavi-on-bg">
          {hero.trustHeading}
        </h2>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
          {hero.trust.map((item) => (
            <div
              key={item.label}
              className="flex flex-col-reverse items-start gap-1 bg-card px-4 py-5"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="cn-font-heading text-2xl font-semibold text-eavi-primary-text sm:text-3xl">
                {liveValue(item) === null ? (
                  <span className="rounded-md border border-dashed border-border px-2 py-0.5 text-sm font-medium text-eavi-muted-text">
                    {hero.pendingValue}
                  </span>
                ) : (
                  <CountUp value={liveValue(item) as number} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
