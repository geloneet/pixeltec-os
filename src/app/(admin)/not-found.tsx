import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <FileQuestion className="h-12 w-12 text-zinc-500" />
      <h2 className="font-logo text-xl font-bold text-zinc-200">
        Página no encontrada
      </h2>
      <p className="max-w-md text-center text-sm text-zinc-400">
        La ruta que buscas no existe en PixelTEC OS.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Ir al Dashboard</Link>
      </Button>
    </div>
  );
}
