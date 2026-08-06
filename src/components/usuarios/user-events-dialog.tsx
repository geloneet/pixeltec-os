"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  getUserSecurityEventsAction,
  type AdminUserRow,
  type UserSecurityEventRow,
} from "@/lib/users-admin/actions";

const EVENT_LABELS: Record<string, string> = {
  login_success: "Inicio de sesión",
  login_failed: "Login fallido",
  password_changed: "Contraseña cambiada",
  password_reset_requested: "Reset de contraseña solicitado",
  password_reset_completed: "Reset de contraseña completado",
  sessions_revoked: "Sesiones revocadas",
  mfa_enabled: "2FA activada",
  mfa_disabled: "2FA desactivada",
  mfa_reset_by_admin: "2FA restablecida por admin",
  user_invited: "Invitación emitida",
  invitation_resent: "Invitación reenviada",
  invitation_accepted: "Invitación aceptada",
  role_changed: "Rol cambiado",
  user_suspended: "Cuenta suspendida",
  user_reactivated: "Cuenta reactivada",
};

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Últimos 20 security_events del usuario (C-PR5). */
export function UserEventsDialog({
  user,
  onClose,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<UserSecurityEventRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setEvents(null);
    setFailed(false);
    getUserSecurityEventsAction(user.id, 20).then((res) => {
      if (cancelled) return;
      if (res.ok) setEvents(res.events);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Eventos de seguridad</DialogTitle>
          <DialogDescription>
            {user ? `Últimos 20 eventos de ${user.name}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {failed && (
          <p className="text-sm text-red-400">No se pudieron cargar los eventos.</p>
        )}
        {!failed && events === null && (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        )}
        {events !== null && events.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin eventos registrados.
          </p>
        )}
        {events !== null && events.length > 0 && (
          <ul className="divide-y divide-border">
            {events.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <Badge variant="outline" className="font-normal">
                    {EVENT_LABELS[e.type] ?? e.type}
                  </Badge>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {e.ip && <span>IP {e.ip}</span>}
                    {e.actorUserId && e.actorUserId !== user?.id && (
                      <span className="ml-2">· ejecutado por un admin</span>
                    )}
                  </div>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateFmt.format(new Date(e.createdAt))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
