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
import { isEmail } from "@/lib/validation";

import styles from "./login-form.module.css";

type Errors = { email?: string; password?: string };

/**
 * Where a signed-in account belongs. The ?next= value only wins when it is a plain
 * in-app path, so the form cannot be turned into an open redirect.
 */
function landingFor(role: string, nextPath: string | undefined) {
  const safe =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
  if (safe) return safe;
  if (role === "TUTOR") return "/tutor";
  if (role === "STUDENT") return "/student";
  return role === "SUPERADMIN" || role === "CAMPUS_ADMIN" ? "/dashboard" : "/unavailable";
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    setFailure("");

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
        setFailure(data.error ?? "We could not sign you in. Try again.");
        setBusy(false);
        return;
      }

      // The cookie is set by the route handler; refresh() so the server components
      // behind the portal guard see it before the first render of the landing screen.
      router.replace(landingFor(data.role, nextPath));
      router.refresh();
    } catch {
      setFailure("We could not reach the server. Check your connection and try again.");
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
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <FieldError id="password-error">{errors.password}</FieldError>
            </Field>

            {failure && (
              <Alert variant="destructive" className={styles.alert}>
                <AlertTitle>That sign-in was not accepted</AlertTitle>
                <AlertDescription>{failure}</AlertDescription>
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
        Sign-in is for enrolled students, tutors and college staff. Applications do not
        need an account.
      </p>
    </>
  );
}
