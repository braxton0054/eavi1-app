import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SESSION_COOKIE, resolveSession } from "@/lib/auth";
import { landingFor } from "@/lib/landing";

import { setInitialPassword } from "./actions";

export const metadata: Metadata = {
  title: "Set a password — East Africa Vision Institute",
  description: "Finish setting up your EAVI account.",
  robots: { index: false, follow: false },
};

// The page reads the session cookie, so it can never be served from a cache.
export const dynamic = "force-dynamic";

/** Refusals come back as codes; the sentences live here. */
const REASONS: Record<string, { title: string; body: string }> = {
  short: {
    title: "That password is too short",
    body: "Use at least 10 characters.",
  },
  mismatch: {
    title: "The passwords do not match",
    body: "Type the same password in both fields.",
  },
};

/**
 * The gate between a session and the portal, for an account the office flagged as still
 * needing a password of its own.
 *
 * `mustChangePassword` is set when an administrator creates an account with a temporary
 * password (`lib/actions/college/enrolment.ts`). A person who signs in with Google has no
 * portal password at all, so this page is where they choose one — after this, either method
 * works, and the flag is cleared.
 */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = token ? await resolveSession(token) : null;

  // Not signed in at all: send them to sign in and come back here.
  if (!user) redirect("/login?next=%2Fset-password");

  // Nothing to do. Never a redirect loop, because the landing page is never this one.
  if (!user.mustChangePassword) redirect(landingFor(user.role));

  const reason = error ? (REASONS[error] ?? null) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a password</CardTitle>
        <CardDescription>
          You signed in with Google. Your EAVI account still needs a password of its own —
          set one now and you can use either way to sign in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={setInitialPassword} className="space-y-4">
          {reason ? (
            <Alert variant="destructive">
              <AlertTitle>{reason.title}</AlertTitle>
              <AlertDescription>{reason.body}</AlertDescription>
            </Alert>
          ) : null}

          <Field>
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 10 characters"
              required
              minLength={10}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              placeholder="Type it again"
              required
              minLength={10}
            />
          </Field>

          <Button type="submit" size="lg" className="w-full">
            Save password and continue
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
