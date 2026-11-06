import Image from "next/image";
import Link from "next/link";
import { LogOutIcon, UserRoundIcon } from "lucide-react";

import { DashboardMobileBar } from "@/components/dashboard/dashboard-mobile-bar";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
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
                <span className="block text-sm leading-tight font-semibold sm:truncate">{shell.brandName}</span>
                <span className="block text-xs leading-tight text-eavi-muted-text sm:truncate">
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
                <SidebarMenuButton size="lg" asChild className="max-md:h-auto">
                  <div className="flex w-full min-w-0 flex-col items-start gap-0.5">
                    <span className="text-sm leading-tight font-medium sm:truncate">{scope.fullName}</span>
                    <span className="text-xs leading-tight text-eavi-muted-text sm:truncate">
                      {roles[scope.role]} · {scope.email}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="min-w-0">
          <header className="eavi-glass sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-eavi-border px-4 text-eavi-on-bg sm:px-6">
            <SidebarTrigger className="-ms-2" />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="text-sm leading-tight font-medium sm:truncate">{shell.brandNote}</span>
            </div>

            <Link
              href="/dashboard/profile"
              className="flex min-w-0 items-center gap-2 rounded-full py-1 ps-1 pe-3 outline-offset-2 hover:bg-eavi-plate focus-visible:ring-2 focus-visible:ring-ring"
            >
              <AccountBadge photoUrl={scope.photoUrl} />
              <span className="sr-only max-w-[14rem] truncate text-sm font-medium sm:not-sr-only sm:block">
                {scope.fullName}
              </span>
            </Link>

            <form action={signOut}>
              <ShimmerButton
                type="submit"
                aria-label={shell.account.signOut}
                className="min-h-11 px-3 text-sm sm:px-4"
              >
                <LogOutIcon aria-hidden />
                <span className="hidden sm:inline">{shell.account.signOut}</span>
              </ShimmerButton>
            </form>
          </header>

          <main id="main" className="flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-6 lg:px-8">
            {children}
          </main>

          <DashboardMobileBar />
        </SidebarInset>
      </TooltipProvider>
    </SidebarProvider>
  );
}

/**
 * The administrator's own picture, kept next to the sign-out control so the account is
 * reachable from any screen. The object host comes from the environment at runtime, so the
 * stored file is shown as-is instead of through the image optimiser.
 */
function AccountBadge({ photoUrl }: { photoUrl: string | null }) {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-eavi-plate ring-1 ring-eavi-border">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="size-full object-cover" />
      ) : (
        <UserRoundIcon aria-hidden className="size-4 text-eavi-muted-text" />
      )}
    </span>
  );
}
