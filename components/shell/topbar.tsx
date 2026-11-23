"use client";

import Link from "next/link";
import { FileTextIcon, LogOutIcon, MenuIcon, PanelLeftIcon, ShieldCheckIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTransition } from "react";

import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

import styles from "./topbar.module.css";

/**
 * The bar above every signed-in screen: the menu toggle, the campus being worked in, and
 * the account. Sign-out lives in the account menu instead of sitting on the bar, where it
 * competed with the campus scope (NAV-15, NAV-22).
 */
export function Topbar({
  campusName,
  note,
  fullName,
  email,
  role,
  photoUrl,
  profileHref,
  scope,
  onOpenMenu,
  onToggleCollapse,
  signOut,
}: {
  campusName: string;
  note: string;
  fullName: string;
  email: string;
  role: string;
  photoUrl: string | null;
  profileHref: string;
  scope?: ReactNode;
  onOpenMenu: () => void;
  onToggleCollapse: () => void;
  signOut: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOut();
    });
  }

  return (
    <header className={styles.bar}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open section menu"
        aria-controls="section-menu"
        onClick={onOpenMenu}
      >
        <MenuIcon aria-hidden="true" />
      </button>

      <button
        type="button"
        className={`${styles.menuButton} ${styles.collapse}`}
        aria-label="Collapse section menu"
        aria-controls="section-menu"
        onClick={onToggleCollapse}
      >
        <PanelLeftIcon aria-hidden="true" />
      </button>

      <div className={styles.scope}>{scope ?? <span className={styles.campusName}>{campusName}</span>}</div>

      <span className={styles.note}>{note}</span>

      <div className={styles.actions}>
        <ThemeToggle />
        <NotificationBell />

        <Menu>
          <MenuTrigger asChild>
            <button type="button" className={styles.account} aria-label={`Account: ${fullName}`}>
              <span className={styles.avatar}>
                {photoUrl ? (
                  // The object host comes from the environment at runtime, so the stored
                  // file is shown as-is instead of through the image optimiser.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" />
                ) : (
                  <UserRoundIcon aria-hidden="true" />
                )}
              </span>
              <span className={styles.accountName}>{fullName}</span>
            </button>
          </MenuTrigger>

          <MenuContent>
            <MenuLabel>
              <span className={styles.menuName}>{fullName}</span>
              <br />
              <span className={styles.menuMeta}>
                {role} · {email}
              </span>
            </MenuLabel>
            <MenuSeparator />
            <MenuItem asChild>
              <Link href={profileHref}>
                <UserRoundIcon aria-hidden="true" />
                Profile and settings
              </Link>
            </MenuItem>
            <MenuItem asChild>
              {/* The legal pages are public; a new tab keeps the person's place in the portal. */}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                <FileTextIcon aria-hidden="true" />
                Terms of use
              </a>
            </MenuItem>
            <MenuItem asChild>
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                <ShieldCheckIcon aria-hidden="true" />
                Privacy notice
              </a>
            </MenuItem>
            <MenuSeparator />
            <MenuItem variant="danger" disabled={pending} onSelect={handleSignOut}>
              <LogOutIcon aria-hidden="true" />
              {pending ? "Signing out" : "Sign out"}
            </MenuItem>
          </MenuContent>
        </Menu>
      </div>
    </header>
  );
}
