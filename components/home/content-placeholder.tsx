import { cn } from "cn";

/**
 * Shown wherever a section needs data the institute has not supplied yet, so the page
 * ships without fabricated numbers, photos or quotes.
 */
export function ContentPlaceholder({
  label,
  note,
  fields,
  className,
}: {
  label: string;
  note: string;
  fields?: readonly string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-eavi-primary-soft/60 p-5",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-eavi-primary-text">
        {label}
      </p>
      {fields && fields.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {fields.map((field) => (
            <li
              key={field}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-eavi-muted-text"
            >
              {field}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs leading-5 text-eavi-muted-text">{note}</p>
    </div>
  );
}
