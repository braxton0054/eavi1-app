import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-eavi-bg font-sans text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-lg"
          >
            <span className="shrink-0 rounded-lg border border-border bg-eavi-plate p-1">
              <Image
                src="/logo.png"
                alt="East Africa Vision Institute"
                width={36}
                height={34}
                className="h-8 w-auto"
              />
            </span>
            <span className="font-display text-[15px] leading-tight font-semibold tracking-tight text-eavi-on-bg sm:text-base">
              <span className="sm:hidden">EAVI</span>
              <span className="hidden sm:inline">
                East Africa Vision Institute
              </span>
            </span>
          </Link>
          <Link
            href="/"
            className="flex min-h-11 items-center px-2 text-sm font-medium text-eavi-on-bg underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        {children}
      </main>
    </div>
  );
}
