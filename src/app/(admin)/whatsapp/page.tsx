import { InboxShell } from "@/components/whatsapp-inbox/InboxShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WhatsApp | PixelTEC OS",
};

export default function WhatsAppInboxPage() {
  const tenantId = process.env.PIXELBOT_TENANT_ID ?? "";
  return <InboxShell tenantId={tenantId} />;
}
