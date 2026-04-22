"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin shell error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <AlertTriangle className="h-12 w-12 text-amber-400" />
      <h2 className="font-logo text-xl font-bold text-zinc-200">
        Algo salió mal
      </h2>
      <p className="max-w-md text-center text-sm text-zinc-400">
        {error.message || "Ocurrió un error inesperado. Intenta recargar."}
      </p>
      <Button onClick={reset} variant="outline">
        Reintentar
      </Button>
    </div>
  );
}
