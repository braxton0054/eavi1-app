import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Reveal } from "@/components/home/reveal";
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
        {portalSection.roles.map((role, index) => {
          const Icon = iconMap[role.icon];
          return (
            <Reveal key={role.role} delay={index * 0.05} className="flex">
              <Card size="sm" className="eavi-lift h-full w-full">
                <CardHeader>
                  <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-eavi-primary-soft">
                    <Icon className="size-5 text-eavi-primary-text" aria-hidden />
                  </span>
                  <CardTitle className="text-base">{role.label}</CardTitle>
                  <CardDescription>{role.line}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ShimmerButton asChild className="w-full font-semibold">
                    <Link href={portalSection.loginHref(role.role)}>
                      {portalSection.openPortal}
                      <ArrowRightIcon data-icon="inline-end" />
                    </Link>
                  </ShimmerButton>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}
