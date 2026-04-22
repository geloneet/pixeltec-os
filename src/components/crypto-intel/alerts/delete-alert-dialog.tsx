"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { deleteAlert } from "@/lib/crypto-intel/actions/alerts";
import type { AlertRuleWithId } from "@/lib/crypto-intel/queries/alerts";

interface DeleteAlertDialogProps {
  alert: AlertRuleWithId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}

export function DeleteAlertDialog({
  alert,
  open,
  onOpenChange,
  onDeleted,
}: DeleteAlertDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!alert) return null;

  async function handleDelete() {
    if (!alert) return;
    setIsDeleting(true);
    try {
      const result = await deleteAlert(alert.id);
      if (result.ok) {
        toast.success("Alerta eliminada");
        onDeleted(alert.id);
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Error al eliminar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setIsDeleting(false);
    }
  }

  const name = alert.displayName ?? `${alert.symbol} · ${alert.type.replace(/_/g, " ")}`;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/[0.06] bg-zinc-950 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">¿Eliminar alerta?</AlertDialogTitle>
          <AlertDialogDescription className="text-zinc-400">
            La alerta <span className="font-medium text-zinc-200">{name}</span> será
            desactivada y marcada como eliminada. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={isDeleting}
            className="border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-700 text-white hover:bg-red-600"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
