/** Where a signed-in account belongs. Shared by password and Google sign-in. */
const CANONICAL_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
const ALLOWED_PREFIXES = ["/student", "/tutor", "/dashboard", "/portal", "/set-password"];

/** Only canonical, same-origin portal paths survive the login round trip. */
export function safeNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(nextPath)) return null;
  try {
    const resolved = new URL(nextPath, CANONICAL_ORIGIN);
    if (resolved.origin !== CANONICAL_ORIGIN) return null;
    if (!ALLOWED_PREFIXES.some((prefix) => resolved.pathname === prefix || resolved.pathname.startsWith(`${prefix}/`))) {
      return null;
    }
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return null;
  }
}

export function landingFor(role: string, nextPath?: string | null): string {
  const safe = safeNextPath(nextPath);
  if (safe) return safe;
  if (role === "TUTOR") return "/tutor";
  if (role === "STUDENT") return "/student";
  return role === "SUPERADMIN" || role === "CAMPUS_ADMIN" ? "/dashboard" : "/unavailable";
}
