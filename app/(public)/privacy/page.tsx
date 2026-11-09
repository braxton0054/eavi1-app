import { LegalPage, legalMetadata } from "@/components/home/legal-page";
import { privacyNotice } from "@/lib/content/legal";

export const metadata = legalMetadata(privacyNotice);

export default function PrivacyPage() {
  return <LegalPage document={privacyNotice} />;
}
