"use client";

import { FileText, RefreshCw, AlertCircle, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useVpsLogs } from "@/lib/vps-swr";
import type { VpsProject } from "@/lib/vps-types";

export function LogsSheet({
  project,
  open,
  onOpenChange,
}: {
  project: VpsProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectId = open && project ? project.id : null;
  const { data, error, isLoading, mutate } = useVpsLogs(projectId, 200);

  const logsText = data?.logs ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col border-zinc-800 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl sm:max-w-2xl"
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1 text-left">
            <SheetTitle className="font-poppins text-zinc-50">
              Logs — {project?.name ?? "—"}
            </SheetTitle>
            <SheetDescription className="font-roboto text-xs text-zinc-500">
              Últimas 200 líneas · one-shot (sin streaming)
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="shrink-0 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-hidden">
          {isLoading && !data && (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <div>
                <p className="font-poppins text-sm font-semibold text-red-300">
                  No se pudieron cargar los logs
                </p>
                <p className="mt-1 font-roboto text-xs text-zinc-500">
                  {error instanceof Error ? error.message : String(error)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                className="border-zinc-800 bg-zinc-900 hover:bg-zinc-800"
              >
                Reintentar
              </Button>
            </div>
          )}

          {!isLoading && !error && !logsText.trim() && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <FileText className="h-8 w-8 text-zinc-600" />
              <p className="font-poppins text-sm text-zinc-400">
                Sin logs recientes
              </p>
              <p className="font-roboto text-xs text-zinc-600">
                El proyecto no ha emitido salida en las últimas 200 líneas.
              </p>
            </div>
          )}

          {logsText.trim() && (
            <pre className="h-full overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/60 p-4 font-mono text-xs leading-relaxed text-zinc-300">
              {logsText}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
