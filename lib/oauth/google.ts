/**
 * Google sign-in, server side.
 *
 * This is the OpenID Connect authorization-code flow, run entirely in route handlers:
 * the browser is redirected to Google, comes back with a `code`, and this module trades
 * that code for an access token using the client secret — which never leaves the server
 * and is never exposed to the browser or the client bundle.
 *
 * It deliberately does not use `id_token` decoding. Google's userinfo endpoint is asked
 * with the access token we just obtained for our own `client_id`, so the answer is bound
 * to this application by construction, and `email_verified` arrives as a real field
 * rather than a claim we would have to verify a signature to trust.
 *
 * Nothing here runs at import time: every function reads the environment when it is
 * called, so `next build` with no Google credentials still succeeds.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

/** Holds the CSRF nonce between the redirect out and the callback back in. */
export const OAUTH_STATE_COOKIE = "eavi_oauth_state";

/** Ten minutes: long enough to pick an account, short enough to be useless if leaked. */
export const OAUTH_STATE_TTL_SECONDS = 600;

export type GoogleProfile = {
  /** Google's stable subject id, never the email — an email can be renamed. */
  subject: string;
  email: string;
};

/** Whether the deployment has been given a Google client at all. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

/**
 * The exact URI Google will send the browser back to.
 *
 * Google compares it character for character against what the Cloud Console has, so it
 * cannot be derived from whatever `Host` header arrived: behind a proxy that header is
 * attacker-influenced, and a mismatch would also break the flow at random. `GOOGLE_REDIRECT_URI`
 * is the source of truth in production; the request origin is only a development fallback.
 */
export function callbackUrl(origin: string): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  return new URL("/api/auth/google/callback", origin).toString();
}

/**
 * The public origin a browser should be sent back to.
 *
 * Behind the reverse proxy the bare request origin is the container's own
 * `localhost:3000` — a login that ends there is a login that ends nowhere. The
 * deployment's own origin wins when set; otherwise the proxy's forwarded host is
 * exactly what the user's browser used to reach us.
 */
export function publicOrigin(request: {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string };
}): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/** Where to send the browser to choose a Google account. */
export function authorizeUrl(input: { state: string; redirectUri: string }): string {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  // Only what is needed to identify the person. No Drive, no Calendar, no Gmail.
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  // Makes the account chooser appear even when a Google session already exists, so a
  // shared computer does not silently sign the next person into the previous account.
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Trades the one-time code for an access token. Null means Google refused the exchange. */
export async function exchangeCode(code: string, redirectUri: string): Promise<string | null> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    // A token response must never be cached by a proxy.
    cache: "no-store",
  });

  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    error?: unknown;
  } | null;

  if (!body || typeof body.access_token !== "string" || body.error) return null;
  return body.access_token;
}

/**
 * The verified identity behind an access token.
 *
 * Both conditions are required, and neither is negotiable:
 *   - `email_verified` must be true. An unverified Google address is just a claim someone
 *     typed into a profile field, and linking it would let a stranger claim an account.
 *   - `email` must be present.
 */
export async function googleProfile(accessToken: string): Promise<GoogleProfile | null> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const body = (await response.json().catch(() => null)) as {
    sub?: unknown;
    email?: unknown;
    email_verified?: unknown;
  } | null;

  if (!body) return null;
  if (typeof body.sub !== "string" || !body.sub) return null;
  if (typeof body.email !== "string" || !body.email) return null;
  if (body.email_verified !== true) return null;

  return { subject: body.sub, email: body.email.trim().toLowerCase() };
}
