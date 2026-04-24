"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AlertForm } from "./alert-form";
import { updateAlert } from "@/lib/crypto-intel/actions/alerts";
import type { AlertRuleSerialized } from "@/lib/crypto-intel/queries/alerts";
import type { CreateAlertInput } from "@/lib/crypto-intel/schemas/alert";

interface AlertEditDrawerProps {
  alert: AlertRuleSerialized | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AlertEditDrawer({ alert, open, onOpenChange }: AlertEditDrawerProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (!alert) return null;

  async function handleSubmit(data: CreateAlertInput) {
    if (!alert) return;
    setIsLoading(true);
    try {
      const result = await updateAlert(alert.id, data);
      if (result.ok) {
        toast.success("Alerta actualizada");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Error al actualizar");
      }
    } catch {
      toast.error("Error inesperado");
    } finally {
      setIsLoading(false);
    }
  }

  const defaultValues: Partial<CreateAlertInput> = {
    symbol: alert.symbol,
    type: alert.type as CreateAlertInput["type"],
    threshold: alert.params.threshold,
    pctWindow: alert.params.window,
    pctDirection: alert.params.direction,
    channels: alert.channels,
    telegramChatId: alert.telegramChatId ?? "",
    cooldownMinutes: alert.cooldownMinutes,
    displayName: alert.displayName ?? "",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-white/[0.06] bg-zinc-950 text-white sm:max-w-lg"
      >
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white">
            Editar alerta{alert.displayName ? ` · ${alert.displayName}` : ""}
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {alert.symbol} · {alert.type.replace(/_/g, " ")}
          </SheetDescription>
        </SheetHeader>
        <AlertForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Guardar cambios"
        />
      </SheetContent>
    </Sheet>
  );
}
