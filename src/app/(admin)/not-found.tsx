import type { Metadata } from "next";
import { AdminNotFoundClient } from "./_not-found-client";

export const metadata: Metadata = {
  title: "Página no encontrada · PixelTEC OS",
};

export default function AdminNotFound() {
  return <AdminNotFoundClient />;
}
