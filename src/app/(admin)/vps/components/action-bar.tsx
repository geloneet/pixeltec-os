"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DatabaseBackup,
  RefreshCw,
  Stethoscope,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ActionConfirmDialog } from "./action-confirm-dialog";
import { SymptomReport } from "./symptom-report";
import { runVpsBackup, useVpsAudit } from "@/lib/vps-swr";
import type { VpsBackupResult } from "@/lib/vps-types";

type BackupOutcome =
  | { status: "success"; result: VpsBackupResult }
  | { status: "error"; message: string };

export function VpsActionBar() {
  const [confirmBackupOpen, setConfirmBackupOpen] = useState(false);
  const [backupRunning, setBackupRunning] = useState(false);
  const [backupOutcome, setBackupOutcome] = useState<BackupOutcome | null>(
    null
  );

  const [auditOpen, setAuditOpen] = useState(false);
  const {
    data: auditReport,
    error: auditError,
    isValidating: auditLoading,
    mutate: mutateAudit,
  } = useVpsAudit();

  const handleBackupConfirm = async () => {
    setConfirmBackupOpen(false);
    setBackupRunning(true);
    setBackupOutcome(null);
    try {
      const result = await runVpsBackup();
      setBackupOutcome({ status: "success", result });
    } catch (err) {
      setBackupOutcome({
        status: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setBackupRunning(false);
    }
  };

  const handleAuditClick = () => {
    setAuditOpen(true);
    void mutateAudit();
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmBackupOpen(true)}
          disabled={backupRunning}
          className="gap-2 border border-border/70 bg-card/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          {backupRunning ? (
            <Spinner size="sm" />
          ) : (
            <DatabaseBackup className="h-3.5 w-3.5" />
          )}
          Ejecutar backup
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAuditClick}
          className="gap-2 border border-border/70 bg-card/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Stethoscope className="h-3.5 w-3.5" />
          Auditoría de salud
        </Button>
      </div>

      {backupOutcome && (
        <div
          className={`mt-3 flex items-start gap-3 rounded-xl border p-3 backdrop-blur-xl ${
            backupOutcome.status === "success"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-red-500/30 bg-red-500/5"
          }`}
        >
          {backupOutcome.status === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={`font-poppins text-sm font-semibold ${
                backupOutcome.status === "success"
                  ? "text-emerald-200"
                  : "text-red-200"
              }`}
            >
              {backupOutcome.status === "success"
                ? `Backup completado (${backupOutcome.result.durationMs} ms)`
                : "Backup falló"}
            </p>
            <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
              {backupOutcome.status === "success"
                ? backupOutcome.result.tail
                : backupOutcome.message}
            </pre>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setBackupOutcome(null)}
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Cerrar</span>
          </Button>
        </div>
      )}

      <ActionConfirmDialog
        open={confirmBackupOpen}
        onOpenChange={setConfirmBackupOpen}
        title="Ejecutar backup"
        description="¿Ejecutar backup de todas las bases de datos? Puede tardar varios segundos y consumir recursos del VPS mientras corre."
        confirmLabel="Confirmar backup"
        onConfirm={() => void handleBackupConfirm()}
      />

      <Sheet open={auditOpen} onOpenChange={setAuditOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col border-border bg-background/95 text-foreground backdrop-blur-xl sm:max-w-2xl"
        >
          <SheetHeader className="flex-row items-start justify-between gap-3">
            <div className="space-y-1 text-left">
              <SheetTitle className="font-poppins text-foreground">
                Auditoría de salud
              </SheetTitle>
              <SheetDescription className="font-roboto text-xs text-muted-foreground">
                Disco, certificados, backups y seguridad del VPS
              </SheetDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void mutateAudit()}
              disabled={auditLoading}
              className="shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <RefreshCw
                className={`mr-2 h-3.5 w-3.5 ${
                  auditLoading ? "animate-spin" : ""
                }`}
              />
              Actualizar
            </Button>
          </SheetHeader>

          <div className="mt-4 flex-1 overflow-auto">
            {auditLoading && !auditReport && (
              <div className="flex h-full items-center justify-center py-16">
                <Spinner size="md" className="text-muted-foreground" />
              </div>
            )}

            {auditError && !auditLoading && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <div>
                  <p className="font-poppins text-sm font-semibold text-red-300">
                    No se pudo cargar la auditoría
                  </p>
                  <p className="mt-1 font-roboto text-xs text-muted-foreground">
                    {auditError instanceof Error
                      ? auditError.message
                      : String(auditError)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void mutateAudit()}
                  className="border-border bg-card hover:bg-secondary"
                >
                  Reintentar
                </Button>
              </div>
            )}

            {auditReport && !auditError && (
              <SymptomReport report={auditReport} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
