import { WhatsAppPairing } from "@/components/dashboard/whatsapp-pairing";
import { PageHeader, Panel } from "@/components/dashboard/panel";
import { whatsappPairingState } from "@/lib/delivery/whatsapp";
import { requireSuperAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Super-admin pairing screen for the embedded OpenWA gateway. */
export default async function WhatsAppIntegrationPage() {
  await requireSuperAdmin();
  const state = await whatsappPairingState();

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp delivery"
        description="Link the college number once. Valid applications send their acknowledgement letter to email and WhatsApp."
      />
      <Panel title="Linked device" description="The QR code refreshes automatically until WhatsApp confirms the link.">
        <WhatsAppPairing initial={state} />
      </Panel>
    </div>
  );
}
