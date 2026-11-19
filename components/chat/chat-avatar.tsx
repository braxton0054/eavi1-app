"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * A person's picture in chat.
 *
 * The URL is chat's own avatar route, which is small, cropped and only served to someone signed
 * in — the full-size enrolment photo never reaches the browser. Staff without a picture, and
 * students whose enrolment photo failed to capture, fall back to initials so a row is never a
 * blank hole.
 */
const PALETTE = [
  "bg-[#6b2d8f]",
  "bg-[#7d3c58]",
  "bg-[#2f6f63]",
  "bg-[#4a5d8f]",
  "bg-[#8a5a2b]",
  "bg-[#7a3f6b]",
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colourFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return PALETTE[hash % PALETTE.length];
}

export function ChatAvatar({
  name,
  photoThumbUrl,
  size = 40,
  online,
  className,
}: {
  name: string;
  photoThumbUrl: string | null;
  size?: number;
  /** Adds a presence dot. Omitted where presence would be meaningless, e.g. group members. */
  online?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoThumbUrl) && !failed;

  // Passport-format 3:4 frame for the picture, never a circle. The presence dot stays
  // round — it is a status marker, not a photograph.
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: Math.round(size * 0.75), height: size }}
    >
      {showPhoto ? (
        /* eslint-disable-next-line @next/next/no-img-element -- authenticated route, already
           a small cropped thumbnail; next/image would need the route allow-listed and would
           re-encode an image that is already optimal. */
        <img
          src={photoThumbUrl!}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full rounded-md border border-[var(--eavi-border)] object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex h-full w-full items-center justify-center rounded-md border border-[var(--eavi-border)] font-semibold text-[var(--eavi-on-bg)]",
            colourFor(name),
          )}
          style={{ fontSize: Math.max(11, size * 0.36) }}
        >
          {initials(name)}
        </span>
      )}

      {online !== undefined ? (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 block rounded-full border-2 border-[var(--eavi-card)]",
            online ? "bg-[var(--eavi-tick-student)]" : "bg-[var(--eavi-muted-text)]",
          )}
          style={{ width: Math.max(9, size * 0.28), height: Math.max(9, size * 0.28) }}
          title={online ? "Online" : "Offline"}
          aria-label={online ? "Online" : "Offline"}
        />
      ) : null}
    </span>
  );
}
