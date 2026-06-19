import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notificaciones — PixelTEC OS",
};

export default function NotificacionesPage() {
  return <NotificationsPage />;
}
