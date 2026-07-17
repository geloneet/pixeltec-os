"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary propio de PixelForge (cubre `/proyectos/pixelforge/**`,
 * incluida la ruta de proyecto y sus estaciones — no hay `layout.tsx` a este
 * nivel, así que este boundary envuelve todo lo que cuelga debajo).
 *
 * No reemplaza el fix del crash de navegación (ver `pixelforge/page.tsx`):
 * existe para que, si algo más falla, el usuario vea un estado de
 * recuperación en vez de un stack trace de Next.js. No se expone
 * `error.message`/`error.digest` crudo — solo un mensaje genérico; el detalle
 * técnico va a consola para desarrollo.
 */
export default function PixelforgeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("PixelForge error:", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col items-center justify-center gap-4 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-amber-400" />
      <h2 className="text-xl font-semibold text-foreground">
        No se pudo cargar este proyecto de PixelForge
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Ocurrió un error inesperado. Tu proyecto y su progreso no se
        perdieron — puedes reintentar o volver al listado.
      </p>
      <div className="flex items-center gap-3">
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
        <Link
          href="/proyectos/pixelforge"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Volver a PixelForge
        </Link>
      </div>
    </div>
  );
}
