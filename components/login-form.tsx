"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card className="relative w-full max-w-[350px] overflow-hidden">
      <CardHeader>
        <CardTitle>Login</CardTitle>
        <CardDescription>Enter your credentials to access your account.</CardDescription>
      </CardHeader>

      <CardContent>
        <form id="login-form" onSubmit={handleSubmit} noValidate>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                placeholder="Enter your email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "email-error" : undefined}
              />
              {errors.email && (
                <p id="email-error" className="text-sm font-medium text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={errors.password ? "password-error" : undefined}
              />
              {errors.password && (
                <p id="password-error" className="text-sm font-medium text-destructive">
                  {errors.password}
                </p>
              )}
            </div>
          </div>

          {failure && (
            <p role="alert" className="mt-4 text-sm font-medium text-destructive">
              {failure}
            </p>
          )}
        </form>
      </CardContent>

      <CardFooter className="flex justify-between">
        <ShimmerButton asChild>
          <Link href="/register">Register</Link>
        </ShimmerButton>
        <ShimmerButton type="submit" form="login-form" disabled={busy}>
          {busy && <Spinner data-icon="inline-start" />}
          {busy ? "Signing in" : "Login"}
        </ShimmerButton>
      </CardFooter>

      <BorderBeam
        duration={4}
        size={300}
        reverse
        className="from-transparent via-green-500 to-transparent"
      />
    </Card>
  );
}
