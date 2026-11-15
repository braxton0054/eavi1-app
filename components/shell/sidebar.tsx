"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { XIcon } from "lucide-react";

import { icons } from "@/components/dashboard/icons";
import type { NavGroup, roles } from "@/lib/content/dashboard";
import type { NavItem } from "@/lib/content/dashboard";

import styles from "./sidebar.module.css";

/**
 * The section list of whichever portal is open. No entrance animation: a menu that slides
 * its items in is decoration, and the active row already says where you are (MOT-01).
 */
export function Sidebar({
  groups,
  home,
  brandName,
  campusName,
  fullName,
  email,
  role,
  collapsed,
  open,
  onNavigate,
  onClose,
}: {
  groups: NavGroup[];
  home: string;
  brandName: string;
  campusName: string;
  fullName: string;
  email: string;
  role: keyof typeof roles;
  collapsed: boolean;
  open: boolean;
  onNavigate: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();

  const isActive = (item: NavItem) =>
    item.href === home
      ? pathname === home
      : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <>
      {open && (
        <button
          type="button"
          className={styles.overlay}
          aria-label="Close section menu"
          onClick={onClose}
        />
      )}

      <div
        className={styles.sidebar}
        data-open={open}
        data-collapsed={collapsed}
        id="section-menu"
      >
        <button type="button" className={styles.close} aria-label="Close section menu" onClick={onClose}>
          <XIcon aria-hidden="true" />
        </button>

        <Link href={home} className={styles.brand} onClick={onNavigate}>
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={34}
            className={styles.brandLogo}
            sizes="36px"
          />
          <span className={styles.brandText}>
            <span className={styles.brandName}>{brandName}</span>
            <span className={styles.brandCampus}>{campusName}</span>
          </span>
        </Link>

        <nav className={styles.nav} aria-label="Portal sections">
          {groups.map((group) => (
            <div key={group.id} className={styles.group}>
              <span className={styles.groupLabel}>{group.label}</span>
              <ul className={styles.list}>
                {group.items.map((item) => {
                  const Icon = icons[item.icon];
                  const active = isActive(item);

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={styles.item}
                        data-active={active}
                        aria-current={active ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                      >
                        <Icon aria-hidden="true" />
                        <span className={styles.label}>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <span className={styles.accountName}>{fullName}</span>
          <span className={styles.accountMeta}>
            {role} · {email}
          </span>
        </div>
      </div>
    </>
  );
}
