import { cn } from "@/lib/utils";

/**
 * One tick, used everywhere a person is named: contacts, the chat list, the thread header,
 * message bubbles, member lists and search results.
 *
 * The role comes from the server and is never taken from a client payload, so a tick cannot be
 * forged by asking for one. Colour is decoration; the glyph, the accessible name and the
 * tooltip all carry the same meaning, so the tick still reads correctly to someone who cannot
 * distinguish the three colours.
 */
export type TickRole = "admin" | "tutor" | "student";

const ROLE_META: Record<TickRole, { label: string; className: string; description: string }> = {
  admin: {
    label: "Campus Admin",
    className: "text-[var(--eavi-tick-admin)]",
    description: "Verified campus administrator",
  },
  tutor: {
    label: "Tutor",
    className: "text-[var(--eavi-tick-tutor)]",
    description: "Verified tutor",
  },
  student: {
    label: "Student",
    className: "text-[var(--eavi-tick-student)]",
    description: "Verified student",
  },
};

export function VerifiedBadge({
  role,
  size = "md",
  className,
}: {
  role: TickRole;
  size?: "sm" | "md";
  className?: string;
}) {
  /*
   * A role the map does not know renders nothing rather than throwing. One unexpected value
   * from a mixed-version deploy must not take down the entire chat screen.
   */
  const meta = ROLE_META[role];
  if (!meta) return null;
  const px = size === "sm" ? 12 : 15;

  return (
    <span
      className={cn("inline-flex shrink-0 items-center", meta.className, className)}
      title={meta.label}
      role="img"
      aria-label={meta.description}
    >
      {/* A filled seal with a check: the shape survives greyscale and colour blindness. */}
      <svg width={px} height={px} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 1.8l2.6 2 3.2-.5 1 3.1 2.6 2-1.3 3 .5 3.2-3 1.3-1.9 2.7-3.2-.6-2.6 1.9-2.4-2.2-3.2-.6.5-3.2-1.9-2.7 1.9-2.5-.4-3.2 3.1-1.1L9.4 3z"
        />
        <path
          fill="var(--eavi-card, #fff)"
          d="M10.6 15.4l-2.8-2.7 1.3-1.3 1.5 1.4 4-4 1.3 1.4z"
        />
      </svg>
    </span>
  );
}

/** The legend, shown once on the Contacts page so the colours are explainable. */
export function TickLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--eavi-muted-text)]",
        className,
      )}
    >
      {(["admin", "tutor", "student"] as const).map((role) => (
        <span key={role} className="inline-flex items-center gap-1.5">
          <VerifiedBadge role={role} size="sm" />
          {ROLE_META[role].label}
        </span>
      ))}
    </div>
  );
}
