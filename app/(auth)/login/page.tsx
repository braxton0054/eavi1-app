import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in — East Africa Vision Institute",
  description: "Sign in to EAVI student and staff services in Eldoret.",
  robots: { index: false, follow: false },
};

// The `?next=` destination has to be read before the form renders, so this route
// blocks instead of streaming. Without it the post-login redirect is refused.

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return <LoginForm nextPath={next} />;
}
