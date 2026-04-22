"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertForm } from "@/components/crypto-intel/alerts/alert-form";
import { createAlert } from "@/lib/crypto-intel/actions/alerts";
import type { CreateAlertInput } from "@/lib/crypto-intel/schemas/alert";

export default function NuevaAlertaPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(data: CreateAlertInput) {
    setIsLoading(true);
    try {
      const result = await createAlert(data);
      if (result.ok) {
        toast.success("Alerta creada exitosamente");
        router.push("/crypto-intel/alertas");
      } else {
        toast.error(result.error ?? "Error al crear la alerta");
      }
    } catch {
      toast.error("Error inesperado al crear la alerta");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 text-white">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 text-zinc-400 hover:text-white"
        >
          <Link href="/crypto-intel/alertas">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-logo text-3xl font-bold tracking-tight">Nueva alerta</h1>
          <p className="mt-0.5 text-sm text-zinc-400">
            Configura una nueva regla de alerta de precios
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <AlertForm
          onSubmit={handleSubmit}
          isLoading={isLoading}
          submitLabel="Crear alerta"
        />
      </div>
    </div>
  );
}
