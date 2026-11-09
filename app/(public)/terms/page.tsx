import { LegalPage, legalMetadata } from "@/components/home/legal-page";
import { termsOfUse } from "@/lib/content/legal";

export const metadata = legalMetadata(termsOfUse);

export default function TermsPage() {
  return <LegalPage document={termsOfUse} />;
}
