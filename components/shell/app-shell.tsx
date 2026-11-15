"use client";

import { useState, type ReactNode } from "react";

import { ScopePicker } from "@/components/dashboard/scope-picker";
import { roles, shell, type NavGroup, type NavItem } from "@/lib/content/dashboard";

import { MobileNav } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import styles from "./app-shell.module.css";

/** The account details the frame shows, shared by every portal that uses it. */
export type FrameScope = {
  fullName: string;
  email: string;
  role: keyof typeof roles;
  photoUrl: string | null;
  campusName: string;
  /** Set only for a super admin: the campus switcher is theirs to use. */
  campusPicker?: { campusId: number | null; campuses: { id: number; name: string }[] };
};

/**
 * The chrome around every signed-in screen: section menu, campus scope, account and the
 * bottom bar on a phone. Which portal is open decides only where the links go.
 */
export function AppShell({
  children,
  scope,
  home,
  note,
  profileHref,
  nav,
  mobile,
  fill = false,
  signOut,
}: {
  children: ReactNode;
  scope: FrameScope;
  home: string;
  note: string;
  profileHref: string;
  nav: NavGroup[];
  mobile: NavItem[];
  /** Locks the page to the viewport so the content scrolls inside itself (chat). */
  fill?: boolean;
  signOut: () => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={styles.root}
      data-fill={fill || undefined}
      data-collapsed={collapsed || undefined}
    >
      <a href="#main" className="skipLink">
        {shell.skipToContent}
      </a>

      <Sidebar
        groups={nav}
        home={home}
        brandName={shell.brandName}
        campusName={scope.campusName}
        fullName={scope.fullName}
        email={scope.email}
        role={scope.role}
        collapsed={collapsed}
        open={menuOpen}
        onNavigate={() => setMenuOpen(false)}
        onClose={() => setMenuOpen(false)}
      />

      <div className={styles.main}>
        <Topbar
          campusName={scope.campusName}
          note={note}
          fullName={scope.fullName}
          email={scope.email}
          role={roles[scope.role]}
          photoUrl={scope.photoUrl}
          profileHref={profileHref}
          scope={
            scope.campusPicker ? (
              <ScopePicker
                campusId={scope.campusPicker.campusId}
                campuses={scope.campusPicker.campuses}
              />
            ) : undefined
          }
          onOpenMenu={() => setMenuOpen(true)}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          signOut={signOut}
        />

        <main id="main" className={styles.content} data-fill={fill || undefined}>
          {children}
        </main>

        <MobileNav
          items={mobile}
          home={home}
          onOpenMenu={() => setMenuOpen(true)}
          menuOpen={menuOpen}
        />
      </div>
    </div>
  );
}
