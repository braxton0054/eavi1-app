# Sign in with Google

The login page offers a second way in: "Sign in with Google". It uses Google's OpenID Connect
authorization-code flow, run entirely in server-side route handlers, and it ends in **the same
`eavi_session` cookie** the password form produces — `resolveSession()` and the role guards
(`requireStudent`, `requireCollegeAdmin`, `requireTutor`) are untouched.

There is no Firebase, Supabase, Auth0, Clerk or NextAuth. Two route handlers and one table.

## What it does, step by step

```
GET /api/auth/google            mint a state nonce → set it in an httpOnly cookie → redirect to Google
   ↓  (Google account chooser; the browser leaves the site)
GET /api/auth/google/callback   check state, exchange the code for a token, read the verified
                                profile, find the EAVI account, create a session
   ↓
/eavi_session cookie            → redirect by role, exactly as landingFor() decides
```

| Route | File |
| --- | --- |
| `/api/auth/google` | `app/api/auth/google/route.ts` |
| `/api/auth/google/callback` | `app/api/auth/google/callback/route.ts` |
| `/set-password` | `app/(auth)/set-password/page.tsx` |

## Who may sign in

**Only an email that already belongs to an EAVI account.** Google proves who someone is; it
never decides whether they exist here. If the verified Google address has no `users` row, the
callback sends the browser back to `/login?error=noaccount`, which reads:

> **No EAVI account uses that Google email** — Sign-in only works for an address the college has
> already registered. Check the address on the Google account, or sign in with your EAVI password.

On the first successful Google sign-in the identity is linked in `oauth_accounts`, keyed by
Google's `sub` (not the email — an address can be renamed, a subject id cannot). Later sign-ins
resolve through that link.

Other refusals, worded the same way the password route words them:

| Case | Result |
| --- | --- |
| `status = PENDING` | "A superadmin still needs to approve this account." |
| `status = DISABLED` | "This account has been disabled." |
| `email_verified` false or absent | refused — an unverified address proves nothing |
| state missing or mismatched | refused, back to `/login?error=state` |
| `mustChangePassword` true | session created, then sent to `/set-password` |

## Why `oauth_accounts` and not a `googleSub` column

`prisma/migrations/20261123140000_oauth_accounts/`:

```sql
CREATE TABLE "oauth_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "providerAccountId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_accounts_provider_providerAccountId_key"
  ON "oauth_accounts"("provider", "providerAccountId");
CREATE INDEX "oauth_accounts_userId_idx" ON "oauth_accounts"("userId");
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- A column (`users.googleSub TEXT UNIQUE`) would be nullable for every one of ~1,000 existing
  users, and a second provider would need a second nullable column and a second unique index.
  Here the provider is *data*, so adding one is an insert, not a migration.
- The uniqueness that actually matters is the pair `(provider, providerAccountId)`, and the
  database is what enforces it. A check in the route handler loses the race between two
  simultaneous first sign-ins.
- It is not a credential store: there is no token column. Sign-in is the only thing the app
  does with Google, so no durable access to the Google account is kept.

Deleting a user cascades the link away; nothing has to be cleaned up by hand.

## Google Cloud Console setup (free, no billing)

Google sign-in needs **no billing account and no credit card**. OAuth client credentials are
free at any volume. (Only APIs such as Maps or Vertex AI bill; identity does not.)

1. Sign in at <https://console.cloud.google.com/>.
2. **Create a project** (top bar → project picker → New project). Name it e.g. `eavi-portal`.
   Wait for it to be selected.
3. **Configure the consent screen**: *APIs & Services → OAuth consent screen*.
   - User type: **External**.
   - App name: `EAVI College`, support email: the college's address.
   - Audience: **External**, publishing status **Testing** is fine to start; press
     **Publish app** when you are ready for students (no Google review is needed for the
     `openid email profile` scopes — they are non-sensitive).
   - While the app is in *Testing*, only accounts listed under **Test users** can sign in
     (up to 100). Add your own address first, and other addresses you want to try.
4. **Create the client**: *APIs & Services → Credentials → Create credentials → OAuth client ID*.
   - Application type: **Web application**.
   - Name: `EAVI portal`.
   - **Authorized JavaScript origins** — not used by this flow, leave empty.
   - **Authorized redirect URIs** — add both, exactly (character for character):
     ```
     https://eavi.college.eavi.shop/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback
     ```
5. **Copy the client ID and client secret** from the dialog. The secret is shown once; if you
   lose it, create a new client.

## Environment variables

Set these on the server. **Never commit the values.**

```bash
GOOGLE_CLIENT_ID=…            # from the credentials dialog, ends in .apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…        # shown once; server-side only, never reaches the browser
GOOGLE_REDIRECT_URI=https://eavi.college.eavi.shop/api/auth/google/callback
```

`GOOGLE_REDIRECT_URI` is the exact URI Google will call back. Set it explicitly in production:
it must be the HTTPS production origin, and it must not be derived from a request header (behind
a proxy the `Host` header is attacker-influenced, and Google compares the URI byte for byte).
Local development may omit it and the request origin is used.

With `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` unset, the login page still renders and the
button leads to `/login?error=unconfigured` — the app never half-enables the feature.

Values live in `deploy.example.env` as empty placeholders. `docker-compose.yml` passes
`GOOGLE_*` through to the app and the worker, so a Compose deploy needs them in its `.env`.

## How a student uses it

1. Open `/login`.
2. Press **Sign in with Google**.
3. Pick the Google account whose address matches the one the college registered.
4. You land on `/student` — or `/tutor`, `/dashboard` for staff — with the usual session cookie.

If the office created the account with a temporary password, the first Google sign-in goes to
**Set a password** first; after saving, either sign-in method works.

## Security notes

- **CSRF / login CSRF**: a 32-byte random nonce goes to Google as `state` and is kept in an
  httpOnly cookie (`eavi_oauth_state`, 10-minute TTL, `sameSite=lax`, `secure` in production).
  The callback compares them in constant time and refuses on any mismatch, deletion or replay.
  The nonce is cleared on both success and failure.
- **Nothing trusted from the URL**: the email comes from Google's userinfo endpoint, called with
  the access token obtained by exchanging the code with the client secret. `email_verified`
  must be exactly `true`.
- **Open redirect**: `next` only survives if it is a single-slash in-app path, and it travels in
  the state cookie rather than through Google.
- **No privilege from Google**: the role always comes from the `users` row. Nothing in the
  Google profile can create a user or raise a role.
- **Audit log**: password sign-ins are not recorded (`app/api/auth/login/route.ts` writes no
  audit row), so neither is this. Recording only one of the two would make the log a partial
  account of how people get in. Worth revisiting as a pair, not alone.

## Test list

| # | Case | Expected |
| --- | --- | --- |
| 1 | Linked/known email signs in with Google | `/student`, `/tutor` or `/dashboard` by role; `eavi_session` set; row in `oauth_accounts` |
| 2 | Google email with no EAVI account | back at `/login` with "No EAVI account uses that Google email"; no session cookie |
| 3 | Disabled account (`status = DISABLED`) | back at `/login` with "This account has been disabled."; no session |
| 4 | Pending account (`status = PENDING`) | "A superadmin still needs to approve this account." |
| 5 | Wrong role landing | a tutor lands on `/tutor`, not `/dashboard`; a student on `/student` |
| 6 | State mismatch | delete/edit the `eavi_oauth_state` cookie before the callback → `/login?error=state`, no session |
| 7 | State replay | reuse a callback URL twice → second is refused (`error=state`) |
| 8 | Cancelled at Google | `/login?error=denied`, nothing changed |
| 9 | `mustChangePassword` set | session exists, but `/set-password` is shown; other pages unreachable until saved |
| 10 | Unverified Google email | refused (`error=unverified`) |
| 11 | No `GOOGLE_CLIENT_ID` configured | button → `/login?error=unconfigured`; password sign-in unaffected |
| 12 | Password sign-in still works | unchanged behaviour |

## Not implemented (optional in the brief)

Linking and unlinking Google from the profile page. The table and the callback already support a
link being created; an explicit "unlink" control would be a small addition to the profile screen,
and it needs a guard so a Google-only account cannot remove its only way in.
