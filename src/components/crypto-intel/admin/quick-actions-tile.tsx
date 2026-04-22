"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, BellRing, Archive, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminForceSync, adminForceEvaluate } from "@/lib/crypto-intel/actions/admin";

type ActionKey = "sync" | "evaluate" | "clean" | null;

interface ActionConfig {
  key: ActionKey;
  label: string;
  description: string;
  icon: React.ReactNode;
  confirmText: string;
  variant?: "default" | "destructive";
  placeholder?: boolean;
}

const ACTIONS: ActionConfig[] = [
  {
    key: "sync",
    label: "Forzar sync de precios",
    description: "Llama a CoinGecko y actualiza todos los precios en Firestore.",
    icon: <RefreshCw className="h-4 w-4" />,
    confirmText: "Ejecutar sync",
  },
  {
    key: "evaluate",
    label: "Forzar evaluación de alertas",
    description: "Evalúa todas las reglas activas y dispara alertas si corresponde.",
    icon: <BellRing className="h-4 w-4" />,
    confirmText: "Ejecutar evaluación",
  },
  {
    key: "clean",
    label: "Limpiar logs >30d",
    description: "Elimina logs de más de 30 días. Función en desarrollo.",
    icon: <Archive className="h-4 w-4" />,
    confirmText: "Limpiar",
    placeholder: true,
  },
];

export function QuickActionsTile() {
  const [pendingAction, setPendingAction] = useState<ActionKey>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState<ActionKey>(null);

  function openConfirm(key: ActionKey) {
    setPendingAction(key);
    setConfirmOpen(true);
  }

  async function executeAction() {
    if (!pendingAction || pendingAction === "clean") {
      if (pendingAction === "clean") {
        toast.info("Función próximamente disponible");
      }
      setConfirmOpen(false);
      return;
    }

    setExecuting(pendingAction);
    setConfirmOpen(false);

    try {
      if (pendingAction === "sync") {
        const result = await adminForceSync();
        if (result.ok && result.data) {
          toast.success(
            `Sync completado: ${result.data.synced} assets en ${result.data.durationMs}ms`
          );
        } else {
          toast.error(result.error ?? "Error en sync");
        }
      } else if (pendingAction === "evaluate") {
        const result = await adminForceEvaluate();
        if (result.ok && result.data) {
          toast.success(`Evaluación completada: ${result.data.triggered} alertas disparadas`);
        } else {
          toast.error(result.error ?? "Error en evaluación");
        }
      }
    } catch {
      toast.error("Error inesperado al ejecutar la acción");
    } finally {
      setExecuting(null);
      setPendingAction(null);
    }
  }

  const currentConfig = ACTIONS.find((a) => a.key === pendingAction);

  return (
    <>
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            Control
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Acciones rápidas</h2>
        </div>

        <div className="space-y-2">
          {ACTIONS.map((action) => (
            <div
              key={action.key}
              className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-zinc-400">{action.icon}</span>
                <div>
                  <p className="text-sm text-zinc-200">{action.label}</p>
                  {action.placeholder && (
                    <p className="text-[10px] text-zinc-600">próximamente</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={executing !== null || action.placeholder}
                onClick={() => openConfirm(action.key)}
                className="h-7 border-white/10 bg-white/[0.04] text-xs text-zinc-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
              >
                {executing === action.key ? "Ejecutando..." : "Ejecutar"}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-white/[0.04] bg-white/[0.01] px-4 py-3 text-xs text-zinc-600">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Las acciones rápidas son para uso manual y debugging. El cron las ejecuta
            automáticamente cada minuto.
          </p>
        </div>
      </div>

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-white/[0.06] bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {currentConfig?.label ?? "Confirmar"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {currentConfig?.description ?? ""}
              {currentConfig?.placeholder && (
                <span className="mt-2 block text-amber-400">Esta función aún no está implementada.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              className={
                currentConfig?.placeholder
                  ? "bg-zinc-700 text-zinc-300"
                  : "bg-emerald-600 text-white hover:bg-emerald-500"
              }
            >
              {currentConfig?.placeholder ? "Entendido" : currentConfig?.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
