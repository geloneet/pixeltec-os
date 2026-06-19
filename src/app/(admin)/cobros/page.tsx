import type { Metadata } from "next";
import { CobrosView } from "@/components/cobros/cobros-view";

export const metadata: Metadata = {
  title: "Cobros — PixelTEC OS",
};

export default function CobrosPage() {
  return <CobrosView />;
}
