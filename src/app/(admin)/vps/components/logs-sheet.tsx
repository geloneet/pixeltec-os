"use client";

import { FileText, RefreshCw, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
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
        className="flex w-full flex-col border-border bg-background/95 text-foreground backdrop-blur-xl sm:max-w-2xl"
      >
        <SheetHeader className="flex-row items-start justify-between gap-3">
          <div className="space-y-1 text-left">
            <SheetTitle className="font-poppins text-foreground">
              Logs — {project?.name ?? "—"}
            </SheetTitle>
            <SheetDescription className="font-roboto text-xs text-muted-foreground">
              Últimas 200 líneas · one-shot (sin streaming)
            </SheetDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mutate()}
            disabled={isLoading}
            className="shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
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
              <Spinner size="md" className="text-muted-foreground" />
            </div>
          )}

          {error && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <div>
                <p className="font-poppins text-sm font-semibold text-red-300">
                  No se pudieron cargar los logs
                </p>
                <p className="mt-1 font-roboto text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : String(error)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => mutate()}
                className="border-border bg-card hover:bg-secondary"
              >
                Reintentar
              </Button>
            </div>
          )}

          {!isLoading && !error && !logsText.trim() && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="font-poppins text-sm text-muted-foreground">
                Sin logs recientes
              </p>
              <p className="font-roboto text-xs text-muted-foreground">
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
