/**
 * Joins the class names that are actually present.
 *
 * There is no Tailwind in this project, so there are no conflicting utilities to
 * merge and no need for tailwind-merge: a CSS Module decides appearance from the
 * component's own classes and `data-*` attributes. This helper exists only so a
 * conditional modifier reads cleanly in JSX.
 */
export type ClassValue = string | number | false | null | undefined;

export function cx(...values: ClassValue[]): string {
  let out = "";
  for (const value of values) {
    if (!value && value !== 0) continue;
    out = out ? `${out} ${value}` : String(value);
  }
  return out;
}
