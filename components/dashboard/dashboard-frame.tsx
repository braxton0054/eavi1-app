import Image from "next/image";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";

import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ThemeToggle } from "@/components/home/theme-toggle";
import { signOut } from "@/lib/actions/auth";
import { roles, shell } from "@/lib/content/dashboard";
import type { AdminScope } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function DashboardFrame({ children, scope }: { children: React.ReactNode; scope: AdminScope }) {

  // Collapsed menu buttons render a Radix tooltip and this registry's SidebarProvider
  // ships without the matching provider, which fails every portal navigation.
  return (
    <SidebarProvider className="min-h-dvh bg-eavi-bg">
      <TooltipProvider delayDuration={0}>
        <Sidebar collapsible="offcanvas" className="border-eavi-border">
          <SidebarHeader className="border-b border-eavi-border">
            <Link href="/dashboard" className="flex items-center gap-3 rounded-lg px-1 py-1">
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-eavi-plate ring-1 ring-eavi-border">
                <Image src="/logo.png" alt="" width={44} height={44} className="size-11" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{shell.brandName}</span>
                <span className="block truncate text-xs text-eavi-muted-text">
                  {scope.campusName}
                </span>
              </span>
            </Link>
          </SidebarHeader>

          <SidebarContent aria-label={shell.navLabel}>
            <DashboardNav />
          </SidebarContent>

          <SidebarFooter className="border-t border-eavi-border">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                  <div className="flex-col items-start gap-0.5">
                    <span className="truncate text-sm font-medium">{scope.fullName}</span>
                    <span className="truncate text-xs text-eavi-muted-text">
                      {roles[scope.role]} · {scope.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2"
                  >
                    <LogOutIcon aria-hidden className="size-4" />
                    {shell.account.signOut}
                  </button>
                </form>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="eavi-glass sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-eavi-border px-4 sm:px-6">
            <SidebarTrigger className="-ms-2" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="truncate text-sm font-medium">{shell.brandNote}</span>
            </div>
            <ThemeToggle />
          </header>

          <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}
