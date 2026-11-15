"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";

import { icons } from "@/components/dashboard/icons";
import type { NavItem } from "@/lib/content/dashboard";

import styles from "./mobile-nav.module.css";

/**
 * The handful of destinations that matter on a phone, plus the way to the rest of the
 * menu. Icon and label together: an icon-only tab bar is a guessing game (NAV-04,
 * moble_frendly 4).
 */
export function MobileNav({
  items,
  home,
  onOpenMenu,
  menuOpen,
}: {
  items: NavItem[];
  home: string;
  onOpenMenu: () => void;
  menuOpen: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);

  const menuSelected = items.every((item) => !isActive(item.href));

  return (
    <nav className={`${styles.bar} noPrint`} aria-label="Portal sections">
      <ul className={styles.list}>
        {items.map((item) => {
          const Icon = icons[item.icon];
          const active = isActive(item.href);

          return (
            <li key={item.href} className={styles.cell}>
              <Link
                href={item.href}
                className={styles.link}
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                <span className={styles.label}>{item.label}</span>
              </Link>
            </li>
          );
        })}

        <li className={styles.cell}>
          <button
            type="button"
            className={styles.menuButton}
            data-active={menuSelected}
            aria-expanded={menuOpen}
            aria-controls="section-menu"
            onClick={onOpenMenu}
          >
            <MenuIcon aria-hidden="true" />
            <span className={styles.label}>Menu</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
