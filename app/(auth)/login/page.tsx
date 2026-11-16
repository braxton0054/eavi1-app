import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in — East Africa Vision Institute",
  description: "Sign in to EAVI student and staff services in Eldoret.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  /*
   * `error` is a short code from the Google callback, not a sentence: the form owns the
   * wording, so a code that means nothing here simply shows the generic failure instead of
   * putting an arbitrary string from the URL on the page.
   */
  const { next, error } = await searchParams;

  return <LoginForm nextPath={next} initialError={error} />;
}
