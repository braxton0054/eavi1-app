import type { Metadata } from "next";

import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Create an account — East Africa Vision Institute",
  description: "Create an EAVI student account in Eldoret.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return <RegisterForm />;
}
