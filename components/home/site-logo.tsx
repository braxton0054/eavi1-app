import Image from "next/image";
import Link from "next/link";
import { cn } from "cn";

/**
 * The one logo mark on a screen. Used by the header and the footer, never twice inside
 * the same viewport.
 */
export function SiteLogo({
  href,
  name,
  shortName,
  alt,
  size = "md",
  tone = "default",
  labelFor = "Home",
}: {
  href: string;
  name: string;
  shortName: string;
  alt: string;
  size?: "sm" | "md";
  tone?: "default" | "band";
  labelFor?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={labelFor}
      className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg"
    >
      <span
        className={cn(
          "shrink-0 rounded-xl border border-eavi-border bg-eavi-plate",
          size === "sm" ? "size-9 p-1" : "size-11 p-1.5",
        )}
      >
        <Image
          src="/logo.png"
          alt={alt}
          width={40}
          height={38}
          className={cn("h-full w-auto", size === "sm" ? "size-7" : "size-8")}
        />
      </span>
      <span
        className={cn(
          "cn-font-heading min-w-0 truncate text-[15px] leading-tight font-semibold tracking-tight sm:text-base",
          tone === "band" && "text-eavi-band-foreground",
        )}
      >
        <span className="sm:hidden">{shortName}</span>
        <span className="hidden sm:inline">{name}</span>
      </span>
    </Link>
  );
}
