import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accesos — PixelTEC OS",
};

export default function AccesosPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center px-4">
      <h1 className="text-2xl font-semibold text-zinc-100">Accesos</h1>
      <p className="text-zinc-500 text-sm max-w-xs">
        Próximamente · llega en Semana 5
      </p>
    </div>
  );
}
