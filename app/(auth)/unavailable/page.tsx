import Link from "next/link";
import { AlertTriangleIcon } from "lucide-react";

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
import { signOut } from "@/lib/actions/auth";
import { shell } from "@/lib/content/dashboard";

export const metadata = {
  title: shell.unavailable.title,
  robots: { index: false, follow: false },
};

// Reads `?reason=` from the guard redirect, so the route blocks rather than streams.

/**
 * Outside the portal route group on purpose: this screen is for people the portal guard
 * turns away, so it must never call that guard itself.
 */
export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{shell.unavailable.title}</CardTitle>
        <CardDescription>
          {reason === "unassigned"
            ? shell.unavailable.unassigned
            : shell.unavailable.body}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Alert variant="attention">
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>What you can do</AlertTitle>
          <AlertDescription>
            The college office can confirm which portal your account belongs to. If you
            signed in with the wrong address, sign out and use the one on your account.
          </AlertDescription>
        </Alert>
      </CardContent>

      <CardFooter>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            {shell.account.signOut}
          </Button>
        </form>
        <Button asChild variant="ghost">
          <Link href="/">Back to home</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
