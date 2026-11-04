"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { isEmail } from "@/lib/validation";

type Errors = { email?: string; password?: string };

/**
 * Where a signed-in account belongs. The ?next= value only wins when it is a plain
 * in-app path, so the form cannot be turned into an open redirect.
 */
function landingFor(role: string, nextPath: string | undefined) {
  const safe =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : null;
  if (safe) return safe;
  return role === "SUPERADMIN" || role === "CAMPUS_ADMIN" ? "/dashboard" : "/unavailable";
}

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    setFailure("");

    if (!email.trim()) {
      nextErrors.email = "Enter the email address you registered with.";
    } else if (!isEmail(email)) {
      nextErrors.email = "That does not look like an email address.";
    }

    if (!password) {
      nextErrors.password = "Enter your password.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
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
    <Card className="w-full max-w-sm gap-0 py-0">
      <CardHeader className="gap-2 px-6 pt-7 pb-4">
        <CardTitle className="text-2xl">Sign in</CardTitle>
        <CardDescription className="text-sm leading-6 text-muted-foreground">
          No account yet?{" "}
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Register
          </Link>
          .
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-6">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            <Field>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="you@eavi.ac.ke"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              <FieldError id="email-error">{errors.email}</FieldError>
            </Field>

            <Field>
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-6 px-0"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? "Hide" : "Show"}
                </Button>
              </div>
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              <FieldError id="password-error">{errors.password}</FieldError>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="remember"
                name="remember"
                checked={remember}
                onCheckedChange={(checked) => setRemember(checked === true)}
              />
              <FieldLabel htmlFor="remember" className="text-sm font-normal">
                Keep me signed in on this device
              </FieldLabel>
            </Field>

            {failure && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {failure}
              </p>
            )}

            <Button type="submit" className="mt-1 w-full" disabled={busy}>
              {busy && <Spinner data-icon="inline-start" />}
              {busy ? "Signing in" : "Sign in"}
            </Button>
          </form>
      </CardContent>
    </Card>
  );
}
