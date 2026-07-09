"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface LegacyClient {
  id: string;
  name: string;
  email: string | null;
  hasPassword: boolean;
}

export function PortalLegadoAdmin() {
  const [clients, setClients] = useState<LegacyClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<LegacyClient | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/portal-legado/clients")
      .then((res) => res.json())
      .then((data) => setClients(data.clients ?? []))
      .catch(() => toast.error("No se pudo cargar la lista de clientes"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!target) return;
    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/portal-legado/clients/${target.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(`Contraseña actualizada para ${target.name}`);
      setClients((prev) => prev.map((c) => (c.id === target.id ? { ...c, hasPassword: true } : c)));
      setTarget(null);
      setNewPassword("");
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" className="text-zinc-500" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-white/5 bg-white/[0.03] divide-y divide-white/5">
        {clients.map((client) => (
          <div key={client.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-zinc-200">{client.name}</p>
              <p className="text-sm text-zinc-500">{client.email ?? "sin correo"}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs ${client.hasPassword ? "text-emerald-400" : "text-zinc-500"}`}>
                {client.hasPassword ? "Contraseña activa" : "Sin contraseña"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTarget(client);
                  setNewPassword("");
                }}
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                {client.hasPassword ? "Reiniciar" : "Fijar"}
              </Button>
            </div>
          </div>
        ))}
        {clients.length === 0 && (
          <p className="p-6 text-center text-sm text-zinc-500">No hay clientes del portal legado.</p>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña para {target?.name}</DialogTitle>
          </DialogHeader>
          <Input
            type="text"
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="off"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Spinner size="sm" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
