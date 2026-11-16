/**
 * Where a signed-in account belongs.
 *
 * Lives on its own so the password form, which is a client component, and the Google
 * callback, which is a route handler, cannot drift: a student arriving by either route must
 * land on the same page. Both call this.
 */

/**
 * The ?next= value only wins when it is a plain in-app path, so neither sign-in route can
 * be turned into an open redirect.
 */
export function landingFor(role: string, nextPath?: string | null): string {
  const safe =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
  if (safe) return safe;
  if (role === "TUTOR") return "/tutor";
  if (role === "STUDENT") return "/student";
  return role === "SUPERADMIN" || role === "CAMPUS_ADMIN" ? "/dashboard" : "/unavailable";
}

/** Keeps the same rule for the `next` handed to Google, so it survives the round trip. */
export function safeNextPath(nextPath: string | null | undefined): string | null {
  return nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
}
