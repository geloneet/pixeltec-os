import type { Metadata } from "next";
import { NotificationsPage } from "@/components/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notificaciones — Pixeltec.mx",
};

export default function NotificacionesPage() {
  return <NotificationsPage />;
}
