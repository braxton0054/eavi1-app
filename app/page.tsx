import Image from "next/image";
import Link from "next/link";
import { campuses, phoneDirectory, type Campus } from "@/lib/campuses";

const directionsUrl = (campus: Campus) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${campus.place}, Eldoret, Kenya`,
  )}`;

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-eavi-bg font-sans text-eavi-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-eavi-fill focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-eavi-on-fill"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-10 border-b border-eavi-border bg-eavi-bg/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link href="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded-lg border border-eavi-border bg-white p-1">
              <Image
                src="/logo.png"
                alt="East Africa Vision Institute"
                width={36}
                height={34}
                className="h-8 w-auto"
              />
            </span>
            <span className="min-w-0 truncate font-display text-[15px] font-semibold leading-tight tracking-tight sm:text-base">
              <span className="sm:hidden">EAVI</span>
              <span className="hidden sm:inline">
                East Africa Vision Institute
              </span>
            </span>
          </Link>
          <Link
            href="/login"
            className="flex min-h-11 shrink-0 items-center justify-center rounded-full bg-eavi-fill px-5 text-sm font-medium text-eavi-on-fill transition-colors hover:bg-eavi-fill-hover"
          >
            Login
          </Link>
        </div>
      </header>

      <main id="main" className="flex-1">
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-2 lg:gap-12 lg:py-20">
          <div className="flex flex-col items-start gap-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-eavi-secondary-text sm:text-xs">
              Eldoret &middot; Kenya
            </p>
            <h1 className="font-display text-balance text-[2.4rem] font-semibold leading-[1.04] tracking-tight sm:text-[3.1rem] lg:text-[3.9rem]">
              East Africa Vision Institute
            </h1>
            <p className="font-display text-xl font-medium leading-none text-eavi-primary-text sm:text-2xl">
              Leading the Leaders
            </p>
            <p className="max-w-md text-pretty text-base leading-7 text-eavi-text/75 sm:text-lg sm:leading-8">
              Nurturing quality and{" "}
              <span className="font-semibold text-eavi-text">affordable</span>{" "}
              education across three campuses in Eldoret.
            </p>
            <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row">
              <a
                href={`tel:${campuses[0].tel}`}
                className="flex h-12 w-full items-center justify-center rounded-full bg-eavi-fill px-6 text-sm font-medium text-eavi-on-fill transition-colors hover:bg-eavi-fill-hover sm:w-auto sm:text-base"
              >
                Call the main campus
              </a>
              <a
                href="#campuses"
                className="flex h-12 w-full items-center justify-center rounded-full border border-eavi-border px-6 text-sm font-medium transition-colors hover:bg-eavi-muted sm:w-auto sm:text-base"
              >
                See all campuses
              </a>
            </div>
          </div>

          <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-3xl border border-eavi-border bg-eavi-muted sm:aspect-[4/3] lg:aspect-[5/4]">
            <div className="absolute -left-10 -top-10 h-48 w-48 rounded-full bg-eavi-primary/20 blur-2xl sm:h-56 sm:w-56" />
            <div className="absolute -bottom-12 -right-8 h-48 w-48 rounded-full bg-eavi-secondary/20 blur-2xl sm:h-56 sm:w-56" />
            <div className="relative flex flex-col items-center gap-3 px-6 text-center">
              <span className="font-display text-5xl font-semibold tracking-tight text-eavi-primary-text sm:text-6xl lg:text-7xl">
                EAVI
              </span>
              <span className="h-px w-16 bg-eavi-border" />
              <span className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] uppercase tracking-[0.18em] text-eavi-text/70 sm:text-[11px]">
                {campuses.map((campus) => (
                  <span key={campus.name}>{campus.name}</span>
                ))}
              </span>
            </div>
          </div>
        </section>

        <section className="border-y border-eavi-border bg-eavi-card">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-0 divide-y divide-eavi-border px-5 sm:grid-cols-3 sm:divide-x sm:px-6">
            {[
              { label: "Campuses", value: "Three in Eldoret" },
              { label: "Focus", value: "Quality & affordability" },
              { label: "Reach us", value: "Phone & WhatsApp" },
            ].map((item) => (
              <div key={item.label} className="py-5 sm:py-6">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-text/70">
                  {item.label}
                </dt>
                <dd className="mt-1.5 text-base font-semibold tracking-tight">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="campuses"
          className="scroll-mt-16 bg-eavi-muted py-10 sm:py-14 lg:py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              Find us in Eldoret
            </h2>
            <p className="mt-2 max-w-lg text-pretty text-sm leading-6 text-eavi-text/75">
              Three locations, each easy to reach and each answering the phone.
            </p>

            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {campuses.map((campus) => (
                <div
                  key={campus.name}
                  className="flex flex-col gap-3 rounded-2xl border border-eavi-border bg-eavi-card p-5 sm:p-6"
                >
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-eavi-primary-text">
                    {campus.name}
                  </h3>
                  <p className="text-pretty text-sm leading-6 text-eavi-text/75">
                    {campus.place}
                  </p>
                  <div className="mt-auto flex flex-col gap-2 pt-2">
                    <a
                      href={`tel:${campus.tel}`}
                      className="flex min-h-11 items-center justify-center rounded-xl bg-eavi-fill/10 text-sm font-semibold text-eavi-primary-text transition-colors hover:bg-eavi-fill hover:text-eavi-on-fill"
                    >
                      {campus.phone}
                    </a>
                    {campus.note && (
                      <p className="text-xs leading-5 text-eavi-text/75">
                        {campus.note}
                      </p>
                    )}
                    {campus.altPhone && (
                      <a
                        href={`tel:${campus.altPhone.tel}`}
                        className="inline-flex min-h-6 items-center self-start text-xs font-medium text-eavi-secondary-text underline-offset-4 hover:underline"
                      >
                        Alt: {campus.altPhone.phone}
                      </a>
                    )}
                    <a
                      href={directionsUrl(campus)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-6 items-center self-start text-xs font-medium text-eavi-secondary-text underline-offset-4 hover:underline"
                    >
                      Get directions
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-eavi-border">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2 lg:col-span-2">
            <p className="font-display text-base font-semibold tracking-tight sm:text-lg">
              East Africa Vision Institute
            </p>
            <p className="max-w-xs text-pretty text-xs leading-5 text-eavi-text/75">
              Leading the Leaders &mdash; nurturing quality and affordable
              education in Eldoret, Kenya.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-primary-text">
              Campuses
            </p>
            <ul className="flex flex-col gap-1.5 text-xs leading-5 text-eavi-text/75">
              {campuses.map((campus) => (
                <li key={campus.name}>
                  <a
                    href={directionsUrl(campus)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-6 items-center transition-colors hover:text-eavi-primary-text"
                  >
                    {campus.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-primary-text">
              Talk to us
            </p>
            <ul className="flex flex-col gap-2.5 text-xs leading-5">
              {phoneDirectory.map((entry) => (
                <li key={entry.tel}>
                  <a
                    href={`tel:${entry.tel}`}
                    className="inline-flex min-h-6 items-center font-medium text-eavi-secondary-text transition-colors hover:text-eavi-primary-text"
                  >
                    {entry.phone}
                  </a>
                  <p className="text-eavi-text/75">{entry.campuses.join(" · ")}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
