"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { acceptInvitationAction } from "@/lib/users-admin/invitation-actions";

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-token": "Este enlace no es válido o expiró.",
  "too-short": "La contraseña debe tener al menos 8 caracteres.",
  weak: "La contraseña debe incluir al menos una letra y un número.",
  mismatch: "Las contraseñas no coinciden.",
  "rate-limited": "Demasiados intentos. Inténtalo más tarde.",
  unknown: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    // Mismos requisitos que C-PR2 (el server los revalida).
    if (password.length < 8) {
      setError(ERROR_MESSAGES["too-short"]);
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(ERROR_MESSAGES.weak);
      return;
    }
    if (password !== confirm) {
      setError(ERROR_MESSAGES.mismatch);
      return;
    }

    setLoading(true);
    const res = await acceptInvitationAction(token, password, confirm);
    setLoading(false);

    if (res.ok) {
      setDone(true);
      // Redirección suave al login: se muestra la confirmación un instante
      // para que el cambio de pantalla no parezca un error.
      setTimeout(() => router.push("/login"), 1800);
    } else {
      setError(ERROR_MESSAGES[res.error] ?? ERROR_MESSAGES.unknown);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <p className="mb-2 font-semibold text-white">Cuenta activada</p>
        <p className="mb-6 text-sm text-zinc-400">
          Ya puedes iniciar sesión con tu correo y tu nueva contraseña. Te
          llevamos al login…
        </p>
        <Link href="/login" className="text-sm text-cyan-400 hover:underline">
          Ir a login →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="group relative">
        <Label htmlFor="password" className="sr-only">
          Contraseña
        </Label>
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
        />
      </div>
      <div className="group relative">
        <Label htmlFor="confirm" className="sr-only">
          Confirmar contraseña
        </Label>
        <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          placeholder="Confirmar contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-14 w-full rounded-lg border-white/10 bg-black/50 pl-12 text-white placeholder:text-zinc-500"
        />
      </div>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
      <Button type="submit" disabled={loading} className="h-14 w-full text-base font-semibold">
        {loading ? <Spinner size="sm" label="Activando" /> : "Activar cuenta"}
      </Button>
    </form>
  );
}
