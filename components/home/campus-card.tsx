import {
  CheckIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { campusesSection, type Campus } from "@/lib/content/home";

const rows = (campus: Campus) =>
  [
    { label: campusesSection.addressLabel, value: campus.place, href: null },
    { label: campusesSection.phoneLabel, value: campus.phone, href: `tel:${campus.tel}` },
    campus.altPhone && {
      label: campusesSection.alternateLabel,
      value: campus.altPhone.phone,
      href: `tel:${campus.altPhone.tel}`,
    },
  ].filter(Boolean) as { label: string; value: string; href: string | null }[];

export function CampusCard({ campus }: { campus: Campus }) {
  const onWhatsApp = campusesSection.whatsappCampusNames.includes(campus.name);
  const directionsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${campus.place}, Eldoret, Kenya`,
  )}`;

  return (
    <Card size="sm" className="eavi-lift h-full">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-eavi-primary-soft">
            <PhoneIcon className="size-5 text-eavi-primary-text" aria-hidden />
          </span>
          <CardTitle className="text-base">{campus.name}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3">
        <dl className="flex flex-col gap-2.5">
          {rows(campus).map((row) => (
            <div key={row.label} className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {row.label}
              </dt>
              <dd className="text-sm leading-6 font-medium">
                {row.href ? (
                  <a
                    href={row.href}
                    className="min-h-11 inline-flex items-center rounded-lg text-eavi-primary-text underline-offset-4 hover:underline"
                  >
                    <span className="tabular-nums">{row.value}</span>
                  </a>
                ) : (
                  <span className="text-pretty leading-6 text-muted-foreground">
                    {row.value}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {campus.note && (
          <p className="flex items-center gap-2 text-xs font-medium text-eavi-secondary-text">
            <span className="flex size-5 items-center justify-center rounded-full bg-eavi-success-fill">
              <CheckIcon className="size-3 text-eavi-on-success" aria-hidden />
            </span>
            {campus.note}
          </p>
        )}

        <div className="mt-auto flex aspect-[16/7] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-eavi-primary-soft/50 px-3 text-center">
          <MapPinIcon className="size-5 text-eavi-primary-text" aria-hidden />
          <p className="text-xs leading-4 font-medium text-eavi-muted-text">
            {campusesSection.mapLabel(campus.name)} — {campusesSection.mapPending}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-2">
        {/* One primary action per card (rule 75): Call shimmers, WhatsApp is the
            quiet outline pill beside it. */}
        <div className="flex w-full gap-2">
          <ShimmerButton asChild className="flex-1">
            <a href={`tel:${campus.tel}`}>
              {campusesSection.call}
              <span className="sr-only"> {campus.name}</span>
            </a>
          </ShimmerButton>
          {onWhatsApp && (
            <Button
              asChild
              variant="outline"
              className="flex-1 border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
            >
              <a
                href={`https://wa.me/${campus.tel.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                {campusesSection.whatsapp}
              </a>
            </Button>
          )}
        </div>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold text-eavi-primary-text underline-offset-4 hover:underline"
        >
          {campusesSection.directions}
          <MapPinIcon className="size-3.5" aria-hidden />
        </a>
      </CardFooter>
    </Card>
  );
}
