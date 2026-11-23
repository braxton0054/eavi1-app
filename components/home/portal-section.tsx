import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/home/section";
import { iconMap } from "@/components/home/icon-map";
import { portalSection } from "@/lib/content/home";

export function PortalSection() {
  return (
    <Section labelledBy="portal-heading">
      <SectionHeader
        id="portal-heading"
        heading={portalSection.heading}
        subheading={portalSection.subheading}
        onBackground
      />

      <div className="mt-6 grid items-stretch gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
        {portalSection.roles.map((role) => {
          const Icon = iconMap[role.icon];
          return (
            <div key={role.role} className="flex">
              <Card size="sm" className="eavi-lift h-full w-full">
                <CardHeader>
                  <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-eavi-primary-soft">
                    <Icon className="size-5 text-eavi-primary-text" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{role.label}</CardTitle>
                  <CardDescription>{role.line}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    asChild
                    variant="outline"
                    className="w-full border-eavi-border/70 bg-transparent text-eavi-on-bg hover:bg-eavi-primary-soft hover:text-eavi-on-bg"
                  >
                    <Link href={portalSection.loginHref(role.role)}>
                      {portalSection.openPortal}
                      <ArrowRightIcon data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
