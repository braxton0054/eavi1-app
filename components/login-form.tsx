"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { landingFor } from "@/lib/landing";
import { isEmail } from "@/lib/validation";

import styles from "./login-form.module.css";

type Errors = { email?: string; password?: string };

/** A sign-in refusal, with a title that names the actual problem. */
type Failure = { title: string; body: string };

/**
 * What the Google callback's `?error=` code means, in words a person can act on.
 *
 * The codes come from `app/api/auth/google/callback/route.ts`; the sentences live here so
 * the callback can stay free of copy and only ever redirects with a short reason.
 */
const GOOGLE_FAILURES: Record<string, Failure> = {
  noaccount: {
    title: "No EAVI account uses that Google email",
    body: "Sign-in only works for an address the college has already registered. Check the address on the Google account, or sign in with your EAVI password.",
  },
  unverified: {
    title: "That Google address is not verified",
    body: "Google could not confirm the address belongs to you, so it cannot be used to sign in. Verify it with Google and try again.",
  },
  unconfigured: {
    title: "Google sign-in is not available",
    body: "This site has no Google client configured. Sign in with your EAVI password.",
  },
  denied: {
    title: "Google sign-in was cancelled",
    body: "Nothing was changed. Choose an account and try again, or sign in with your password.",
  },
  state: {
    title: "That sign-in expired",
    body: "For safety, a sign-in attempt only lasts ten minutes and cannot be reused. Start again.",
  },
  pending: {
    title: "Account needs approval",
    body: "A superadmin still needs to approve this account.",
  },
  disabled: {
    title: "Account needs attention",
    body: "This account has been disabled.",
  },
  exchange: {
    title: "Google sign-in failed",
    body: "Google did not confirm the sign-in. Try again in a moment, or use your password.",
  },
  failed: {
    title: "Google sign-in failed",
    body: "Something went wrong on the way back from Google. Try again, or use your password.",
  },
};

/** Google's mark, drawn here so the page needs no third-party asset or request. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.2l7.8 6.1C12.1 13.6 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z" />
      <path fill="#FBBC05" d="M10.3 28.7a14.5 14.5 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.2 2.3-6.4 0-11.9-4.1-13.7-9.8l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function LoginForm({
  nextPath,
  initialError,
}: {
  nextPath?: string;
  /** A `?error=` code from the Google callback, shown before anything is typed. */
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(() =>
    initialError ? (GOOGLE_FAILURES[initialError] ?? GOOGLE_FAILURES.failed) : null,
  );
  const [capsLock, setCapsLock] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    setFailure(null);

    if (!email.trim()) {
      nextErrors.email = "Enter the email address you registered with.";
    } else if (!isEmail(email)) {
      nextErrors.email = "That does not look like an email address. It should look like name@example.com.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);

    // Focus the first field that needs attention instead of making the user hunt
    // for the message (FRM-11).
    if (nextErrors.email) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember: true }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const detail =
          typeof data.error === "string" && data.error.trim()
            ? data.error
            : "We could not sign you in. Try again.";

        if (response.status === 401) {
          // Name the problem plainly, then put the caret back where the typo most
          // likely is — the password — so the retry is one keystroke away (FRM-11).
          setFailure({
            title: "Incorrect email or password",
            body: "Check both fields and try again.",
          });
          passwordRef.current?.focus();
          passwordRef.current?.select();
        } else if (response.status === 429) {
          setFailure({ title: "Too many attempts", body: "Wait a few minutes, then try again." });
        } else if (response.status === 403) {
          setFailure({ title: "Account needs attention", body: detail });
        } else {
          setFailure({ title: "Sign-in failed", body: detail });
        }
        setBusy(false);
        return;
      }

      // The cookie is set by the route handler; refresh() so the server components
      // behind the portal guard see it before the first render of the landing screen.
      router.replace(landingFor(data.role, nextPath));
      router.refresh();
    } catch {
      setFailure({
        title: "Connection problem",
        body: "We could not reach the server. Check your connection and try again.",
      });
      setBusy(false);
    }
  }

  return (
    <>
      <Card className={styles.card}>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use the email address and password for your EAVI account.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form id="login-form" onSubmit={handleSubmit} noValidate className={styles.form}>
            <Field data-invalid={errors.email ? "true" : undefined}>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                spellCheck={false}
                autoCapitalize="off"
                placeholder="name@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              <FieldError id="email-error">{errors.email}</FieldError>
            </Field>

            <Field data-invalid={errors.password ? "true" : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <PasswordInput
                ref={passwordRef}
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                onBlur={() => setCapsLock(false)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? "password-error" : capsLock ? "password-caps" : undefined
                }
              />
              <FieldError id="password-error">{errors.password}</FieldError>
              {capsLock && (
                <p id="password-caps" className={styles.caps} aria-live="polite">
                  Caps Lock is on.
                </p>
              )}
            </Field>

            {failure && (
              <Alert variant="destructive" className={styles.alert}>
                <AlertTitle>{failure.title}</AlertTitle>
                <AlertDescription>{failure.body}</AlertDescription>
              </Alert>
            )}

            <div className={styles.actions}>
              <Button
                type="submit"
                size="lg"
                loading={busy}
                className={styles.submit}
                form="login-form"
              >
                {busy ? "Signing in" : "Sign in"}
              </Button>
            </div>
          </form>

          {/*
           * A plain link, not a popup: the browser leaves the page, sets the CSRF cookie on
           * the way out, and comes back to the same session cookie the password form sets.
           * `next` is carried so a deep link survives the round trip through Google.
           */}
          <div className={styles.actions}>
            <div
              className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide opacity-60"
              aria-hidden="true"
            >
              <span className="h-px flex-1 bg-current" />
              <span>or</span>
              <span className="h-px flex-1 bg-current" />
            </div>

            <Button asChild variant="outline" size="lg" className={styles.submit}>
              <a
                href={`/api/auth/google${
                  nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""
                }`}
              >
                <GoogleMark />
                Sign in with Google
              </a>
            </Button>
          </div>
        </CardContent>

        <CardFooter>
          <div className={styles.footer}>
            <span className={styles.footerText}>No account yet?</span>
            <Button asChild variant="secondary" size="sm">
              <Link href="/register">Create an account</Link>
            </Button>
          </div>
        </CardFooter>
      </Card>

      <p className={styles.legal}>
        Sign in is for enrolled students, tutors and college staff. Applications do not
        need an account. Read the{" "}
        <Link href="/terms">terms of use</Link> and the{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>
    </>
  );
}
