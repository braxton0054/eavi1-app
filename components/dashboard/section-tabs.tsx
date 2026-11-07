import Link from "next/link";

import { cn } from "@/lib/utils";

export type Tab = { href: string; label: string; active?: boolean };

/**
 * The screens that belong to one record: overview first, then each editor. It is a row of
 * links rather than a menu because a phone has no room for a second navigation and an
 * administrator moving between programme, units, fees and attachment needs one tap, not
 * a dropdown per hop. The row scrolls sideways on a narrow screen and every target keeps a
 * 44px height, so the strip never wraps into three lines of half-tappable chips.
 */
export function SectionTabs({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max items-stretch gap-1 border-b border-eavi-border">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={cn(
                "relative inline-flex min-h-11 items-center rounded-t-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                tab.active
                  ? "text-eavi-on-bg after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-eavi-primary-text"
                  : "text-eavi-muted-text hover:bg-eavi-muted hover:text-eavi-on-bg",
              )}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
