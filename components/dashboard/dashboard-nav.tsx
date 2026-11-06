"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";

import { icons } from "@/components/dashboard/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { NavGroup } from "@/lib/content/dashboard";

/**
 * The section list of whichever portal is open. Each group animates in after the one above
 * it, so the menu reads top to bottom instead of appearing all at once.
 */
export function DashboardNav({ groups, home }: { groups: NavGroup[]; home: string }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  let position = 0;

  return groups.map((group) => (
    <SidebarGroup key={group.id}>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduceMotion ? 0 : position * 0.05, duration: 0.3 }}
      >
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      </motion.div>
      <SidebarMenu>
        {group.items.map((item) => {
          const Icon = icons[item.icon];
          const active =
            item.href === home
              ? pathname === home
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const index = position++;

          return (
            <SidebarMenuItem key={item.href}>
              {active && (
                <motion.span
                  layoutId="nav-active-edge"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  className="absolute inset-y-1 left-0 z-10 w-[3px] rounded-full bg-eavi-fill"
                />
              )}
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={reduceMotion ? undefined : { x: 3 }}
                transition={{
                  delay: reduceMotion ? 0 : index * 0.045,
                  duration: 0.32,
                }}
                className="w-full"
              >
                <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                  <Link href={item.href} aria-current={active ? "page" : undefined}>
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </motion.div>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  ));
}
