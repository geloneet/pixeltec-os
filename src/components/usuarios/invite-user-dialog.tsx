"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteUserAction, type UserRole } from "@/lib/users-admin/actions";

const INVITE_ERRORS: Record<string, string> = {
  "invalid-email": "Revisa el nombre y el correo.",
  "invalid-role": "Rol inválido.",
  "email-exists": "Ya existe un usuario con ese correo.",
  forbidden: "Solo un administrador puede invitar.",
  unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
  unknown: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

export function InviteUserDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await inviteUserAction({ name, email, role });
      if (res.ok) {
        toast.success(
          res.emailSent
            ? `Invitación enviada a ${email.trim().toLowerCase()}.`
            : "Usuario creado, pero el correo de invitación no pudo enviarse. Usa «Reenviar invitación»."
        );
        setOpen(false);
        setName("");
        setEmail("");
        setRole("staff");
        router.refresh();
      } else {
        toast.error(INVITE_ERRORS[res.error] ?? INVITE_ERRORS.unknown);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invitar usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invitar usuario</DialogTitle>
          <DialogDescription>
            Recibirá un correo con un enlace (válido 7 días) para elegir su
            contraseña y activar su cuenta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Nombre</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Correo</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="persona@pixeltec.mx"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue placeholder="Rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="reviewer">Revisor externo (solo WhatsApp)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || !name.trim() || !email.trim()}>
            {pending ? "Enviando…" : "Enviar invitación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
