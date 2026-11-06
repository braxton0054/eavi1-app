"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { motion } from "motion/react";

import { icons } from "@/components/dashboard/icons";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/applications", label: "Applications", icon: "applications" },
  { href: "/dashboard/students", label: "Students", icon: "students" },
  { href: "/dashboard/enrollments", label: "Enrollments", icon: "enrollments" },
] as const;

function ActiveEdge() {
  return (
    <motion.span
      layoutId="mobile-bar-active"
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-eavi-primary-text"
    />
  );
}

export function DashboardMobileBar() {
  const pathname = usePathname();
  const { open, setOpen } = useSidebar();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const menuSelected = primary.every((item) => !isActive(item.href));

  return (
    <nav
      aria-label="Portal sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-eavi-border bg-eavi-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch">
        {primary.map((item) => {
          const Icon = icons[item.icon];
          const active = isActive(item.href);
          return (
            <li key={item.href} className="relative flex-1">
              {active && <ActiveEdge />}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-xs leading-none transition-colors",
                  active ? "text-eavi-primary-text" : "text-eavi-muted-text",
                )}
              >
                <Icon aria-hidden className="size-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="relative flex-1">
          {menuSelected && <ActiveEdge />}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            className={cn(
              "flex min-h-14 w-full flex-col items-center justify-center gap-1 px-1 text-xs leading-none transition-colors",
              menuSelected ? "text-eavi-primary-text" : "text-eavi-muted-text",
            )}
          >
            <MenuIcon aria-hidden className="size-5" />
            <span>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
