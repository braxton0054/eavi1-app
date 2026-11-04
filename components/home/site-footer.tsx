import Link from "next/link";
import { CopyrightYear } from "@/components/home/copyright-year";
import { campuses, footer, nav, phoneDirectory } from "@/lib/content/home";

const directionsHref = (place: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place}, Eldoret, Kenya`,
  )}`;

const linkClass =
  "inline-flex min-h-11 items-center text-sm text-eavi-band-muted underline-offset-4 transition-colors hover:text-eavi-band-foreground hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-eavi-band-muted/20 bg-eavi-band text-eavi-band-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-12 sm:px-6 lg:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-4">
          {/* The badge stays in the sticky header so the page never shows two logos at
              once; the footer carries the name in type only. */}
          <Link href="/" className="cn-font-heading min-h-11 inline-flex items-center text-base font-semibold tracking-tight text-eavi-band-foreground">
            {footer.name}
          </Link>
          <p className="max-w-xs text-pretty text-xs leading-5 text-eavi-band-muted">
            {footer.tagline}
          </p>
        </div>

        <nav aria-label={footer.quickLinks} className="flex flex-col gap-2 lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-band-muted">
            {footer.quickLinks}
          </p>
          {nav.links.map((link) => (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ))}
          <Link href="/login" className={linkClass}>
            {nav.portalLogin}
          </Link>
          <Link href="/register" className={linkClass}>
            {nav.apply}
          </Link>
        </nav>

        <div className="flex flex-col gap-2 lg:col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-band-muted">
            {footer.campusesHeading}
          </p>
          {campuses.map((campus) => (
            <a
              key={campus.name}
              href={directionsHref(campus.place)}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              {campus.name}
            </a>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:col-span-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-band-muted">
            {footer.contactHeading}
          </p>
          <ul className="flex flex-col gap-2.5">
            {phoneDirectory.map((entry) => (
              <li key={entry.tel}>
                <a
                  href={`tel:${entry.tel}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-eavi-band-foreground underline-offset-4 hover:underline"
                >
                  <span className="tabular-nums">{entry.phone}</span>
                </a>
                <p className="text-xs leading-5 text-eavi-band-muted">
                  {entry.campuses.join(" · ")}
                </p>
              </li>
            ))}
          </ul>

          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-band-muted">
            {footer.socialHeading}
          </p>
          {footer.socials.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {footer.socials.map((social) => (
                <li key={social.href}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-eavi-band-muted">{footer.socialPending}</p>
          )}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 border-t border-eavi-band-muted/20 px-5 py-5 text-xs text-eavi-band-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <CopyrightYear template={footer.copyrightTemplate} />
        </p>
        <p className="flex flex-wrap items-center gap-2">
          <span>{footer.privacy}</span>
          <span aria-hidden>·</span>
          <span>{footer.terms}</span>
          <span className="rounded border border-dashed border-eavi-band-muted/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
            {footer.legalPending}
          </span>
        </p>
      </div>
    </footer>
  );
}
