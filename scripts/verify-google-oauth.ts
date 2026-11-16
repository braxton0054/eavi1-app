/**
 * Verifies the parts of Google sign-in that do not need Google.
 *
 * Real end-to-end sign-in needs a configured client and a person at an account chooser, so
 * this covers everything on our side of the boundary: the start route's redirect and state
 * cookie, the callback's CSRF check, and the refusal codes the login page turns into
 * sentences. The exchange itself is asserted only up to "Google refused, so we refuse".
 *
 * Run: npx tsx scripts/verify-google-oauth.ts
 */
import "../load-env";

import { NextRequest } from "next/server";

import { GET as callback } from "../app/api/auth/google/callback/route";
import { GET as start } from "../app/api/auth/google/route";
import { authorizeUrl, callbackUrl, googleConfigured, OAUTH_STATE_COOKIE } from "../lib/oauth/google";
import { landingFor, safeNextPath } from "../lib/landing";

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const ORIGIN = "http://localhost:3000";

function request(path: string, cookie?: string) {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

function location(response: Response): string {
  return response.headers.get("location") ?? "";
}

function errorCode(response: Response): string | null {
  try {
    return new URL(location(response)).searchParams.get("error");
  } catch {
    return null;
  }
}

function stateCookie(response: Response): string | null {
  const raw = response.headers.getSetCookie?.() ?? [];
  const match = raw.find((line) => line.startsWith(`${OAUTH_STATE_COOKIE}=`));
  return match ?? null;
}

async function main() {
console.log("\nconfiguration");
{
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  check("disabled when the client id and secret are absent", googleConfigured() === false);

  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  check("still disabled with only a client id", googleConfigured() === false);

  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  check("enabled once both are present", googleConfigured() === true);

  process.env.GOOGLE_REDIRECT_URI = "https://eavi.college.eavi.shop/api/auth/google/callback";
  check(
    "an explicit redirect URI wins over the request origin",
    callbackUrl(ORIGIN) === "https://eavi.college.eavi.shop/api/auth/google/callback",
    callbackUrl(ORIGIN),
  );
  delete process.env.GOOGLE_REDIRECT_URI;
  check(
    "falls back to the request origin in development",
    callbackUrl(ORIGIN) === `${ORIGIN}/api/auth/google/callback`,
    callbackUrl(ORIGIN),
  );
}

console.log("\nauthorize URL");
{
  const url = new URL(authorizeUrl({ state: "nonce-123", redirectUri: `${ORIGIN}/api/auth/google/callback` }));
  check("points at Google's consent endpoint", url.hostname === "accounts.google.com");
  check("asks for an authorization code", url.searchParams.get("response_type") === "code");
  check("requests only openid/email/profile", url.searchParams.get("scope") === "openid email profile");
  check("carries the state nonce", url.searchParams.get("state") === "nonce-123");
  check(
    "sends the exact redirect URI",
    url.searchParams.get("redirect_uri") === `${ORIGIN}/api/auth/google/callback`,
  );
  check("never puts the client secret in the URL", !url.searchParams.has("client_secret"));
}

console.log("\nstart route");
{
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  const off = await start(request("/api/auth/google"));
  check("refuses politely when unconfigured", errorCode(off) === "unconfigured", location(off));

  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const on = await start(request("/api/auth/google?next=%2Fstudent%2Ffees"));
  check("redirects to Google", location(on).startsWith("https://accounts.google.com/"), location(on));

  const cookie = stateCookie(on);
  check("sets the state cookie", Boolean(cookie), cookie ?? "no Set-Cookie");
  check("state cookie is httpOnly", Boolean(cookie?.toLowerCase().includes("httponly")), cookie ?? "");
  check("state cookie is sameSite=lax", Boolean(cookie?.toLowerCase().includes("samesite=lax")), cookie ?? "");
  check("state cookie is short-lived", Boolean(cookie?.toLowerCase().includes("max-age=600")), cookie ?? "");

  // The nonce in the cookie must be the one sent to Google, or nothing can match later.
  const cookieValue = cookie ? decodeURIComponent(cookie.split(";")[0].split("=").slice(1).join("=")) : "";
  let parsed: { state?: string; next?: string | null } = {};
  try {
    parsed = JSON.parse(cookieValue);
  } catch {
    parsed = {};
  }
  const sentState = new URL(location(on)).searchParams.get("state");
  check("cookie holds the same nonce sent to Google", Boolean(parsed.state) && parsed.state === sentState);
  check("the next path rides in the cookie, not the URL", parsed.next === "/student/fees", String(parsed.next));
  check("the next path is not sent to Google", !location(on).includes("student"));

  const hostile = await start(request("/api/auth/google?next=https%3A%2F%2Fevil.test%2Fsteal"));
  const hostileCookie = stateCookie(hostile);
  const hostileValue = hostileCookie
    ? JSON.parse(decodeURIComponent(hostileCookie.split(";")[0].split("=").slice(1).join("=")))
    : {};
  check("an off-site next is dropped", hostileValue.next === null, JSON.stringify(hostileValue));
}

console.log("\ncallback: CSRF and refusals");
{
  process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";

  const noCookie = await callback(request("/api/auth/google/callback?state=abc&code=xyz"));
  check("no state cookie is refused", errorCode(noCookie) === "state", location(noCookie));

  const mismatched = await callback(
    request(
      "/api/auth/google/callback?state=attacker&code=xyz",
      `${OAUTH_STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "expected", next: null }))}`,
    ),
  );
  check("a mismatched state is refused", errorCode(mismatched) === "state", location(mismatched));

  const missingStateParam = await callback(
    request(
      "/api/auth/google/callback?code=xyz",
      `${OAUTH_STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "expected", next: null }))}`,
    ),
  );
  check("a missing state parameter is refused", errorCode(missingStateParam) === "state");

  const cancelled = await callback(request("/api/auth/google/callback?error=access_denied"));
  check("cancelling at Google is reported as denied", errorCode(cancelled) === "denied");

  const noCode = await callback(
    request(
      "/api/auth/google/callback?state=expected",
      `${OAUTH_STATE_COOKIE}=${encodeURIComponent(JSON.stringify({ state: "expected", next: null }))}`,
    ),
  );
  check("a matching state with no code is refused", errorCode(noCode) === "exchange", location(noCode));

  const anyRefusal = await callback(request("/api/auth/google/callback?state=abc&code=xyz"));
  check(
    "every refusal clears the state cookie",
    Boolean(stateCookie(anyRefusal)?.toLowerCase().includes("max-age=0")),
    stateCookie(anyRefusal) ?? "",
  );
  check(
    "no refusal sets a session cookie",
    !(anyRefusal.headers.getSetCookie?.() ?? []).some((line) => line.startsWith("eavi_session=")),
  );
}

console.log("\nrole landing");
{
  check("a student lands on /student", landingFor("STUDENT") === "/student");
  check("a tutor lands on /tutor", landingFor("TUTOR") === "/tutor");
  check("a campus admin lands on /dashboard", landingFor("CAMPUS_ADMIN") === "/dashboard");
  check("a super admin lands on /dashboard", landingFor("SUPERADMIN") === "/dashboard");
  check("an unknown role lands on /unavailable", landingFor("SOMETHING") === "/unavailable");
  check("an in-app next wins", landingFor("STUDENT", "/student/fees") === "/student/fees");
  check("a protocol-relative next is refused", safeNextPath("//evil.test") === null);
  check("an absolute next is refused", safeNextPath("https://evil.test") === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
}

// tsx compiles this file as CommonJS (the package is not `type: module`), where a
// top-level await is a syntax error — so the body runs inside main().
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
