import { WhatsAppModule } from "@/components/whatsapp-inbox/WhatsAppModule";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WhatsApp | PixelTEC OS",
};

export default function WhatsAppInboxPage() {
  const tenantId = process.env.PIXELBOT_TENANT_ID ?? "";
  return <WhatsAppModule tenantId={tenantId} />;
}
