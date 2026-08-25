"use client";

/**
 * Sistema → Usuarios y acceso (C-PR5). Tabla del equipo interno + acciones
 * por fila (rol, suspensión, invitación, sesiones, 2FA, eventos). Todas las
 * mutaciones llaman server actions con guard admin y refrescan la carga del
 * Server Component con router.refresh().
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MoreHorizontal,
  ShieldCheck,
  UserCog,
  UserX,
  UserCheck,
  MailPlus,
  MonitorX,
  ScrollText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminUserRow, UserRole } from "@/lib/users-admin/actions";
import {
  reactivateUserAction,
  resendInvitationAction,
  resetUserMfaAction,
  revokeUserSessionsAction,
  setUserRoleAction,
  suspendUserAction,
} from "@/lib/users-admin/actions";
import { InviteUserDialog } from "./invite-user-dialog";
import { UserEventsDialog } from "./user-events-dialog";

const ACTION_ERRORS: Record<string, string> = {
  unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
  forbidden: "Solo un administrador puede hacer esto.",
  "not-found": "El usuario ya no existe.",
  "self-demotion": "No puedes quitarte el rol de administrador a ti mismo.",
  "self-suspend": "No puedes suspender tu propia cuenta.",
  "last-admin": "No puede quedar el sistema sin administradores activos.",
  "not-invited": "Este usuario ya no tiene una invitación pendiente.",
  "not-suspended": "Este usuario no está suspendido.",
  "already-suspended": "Este usuario ya está suspendido.",
  unknown: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

/** Etiquetas de rol (WO-2026-00051: `reviewer` = Meta App Review, solo WhatsApp). */
const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  staff: "Staff",
  reviewer: "Revisor externo (solo WhatsApp)",
};

const ROLE_CHANGE_DESCRIPTION: Record<UserRole, string> = {
  admin: "con acceso total al sistema.",
  staff: "Perderá acceso a las superficies de administración.",
  reviewer:
    "Solo podrá entrar a /whatsapp y a las funciones de WhatsApp permitidas; todo lo demás queda bloqueado (403). Sus sesiones actuales se cerrarán.",
};

function errorMessage(code: string): string {
  return ACTION_ERRORS[code] ?? ACTION_ERRORS.unknown;
}

const STATUS_META: Record<AdminUserRow["status"], { label: string; className: string }> = {
  active: {
    label: "Activo",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  },
  invited: {
    label: "Invitado",
    className: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  },
  suspended: {
    label: "Suspendido",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
  },
};

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  return dateFmt.format(new Date(value));
}

export function UsersDashboard({
  users,
  currentUserId,
  loadFailed,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  loadFailed: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<{
    kind: "role" | "suspend" | "reactivate" | "revoke-sessions" | "reset-mfa";
    user: AdminUserRow;
    /** Solo para kind === "role": rol destino elegido en el menú. */
    nextRole?: UserRole;
  } | null>(null);
  const [eventsUser, setEventsUser] = useState<AdminUserRow | null>(null);

  function run(fn: () => Promise<{ ok: boolean } & Record<string, unknown>>, successMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(errorMessage(String((res as { error?: string }).error ?? "unknown")));
      }
      setConfirm(null);
    });
  }

  function confirmAction() {
    if (!confirm) return;
    const { kind, user } = confirm;
    if (kind === "role") {
      const nextRole = confirm.nextRole ?? (user.role === "admin" ? "staff" : "admin");
      run(
        () => setUserRoleAction(user.id, nextRole),
        `${user.name} ahora es ${ROLE_LABELS[nextRole].toLowerCase()}.`
      );
    } else if (kind === "suspend") {
      run(() => suspendUserAction(user.id), `${user.name} quedó suspendido y sin sesiones.`);
    } else if (kind === "reactivate") {
      run(() => reactivateUserAction(user.id), `${user.name} quedó reactivado.`);
    } else if (kind === "revoke-sessions") {
      run(() => revokeUserSessionsAction(user.id), `Sesiones de ${user.name} revocadas.`);
    } else if (kind === "reset-mfa") {
      run(() => resetUserMfaAction(user.id), `2FA de ${user.name} restablecida.`);
    }
  }

  function resend(user: AdminUserRow) {
    run(() => resendInvitationAction(user.id), `Invitación reenviada a ${user.email}.`);
  }

  const CONFIRM_COPY: Record<
    NonNullable<typeof confirm>["kind"],
    { title: string; description: (u: AdminUserRow) => string; cta: string }
  > = {
    role: {
      title: "Cambiar rol",
      description: (u) => {
        const next = confirm?.nextRole ?? (u.role === "admin" ? "staff" : "admin");
        return `${u.name} pasará de ${ROLE_LABELS[u.role].toLowerCase()} a ${ROLE_LABELS[next].toLowerCase()}. ${ROLE_CHANGE_DESCRIPTION[next]}`;
      },
      cta: "Cambiar rol",
    },
    suspend: {
      title: "Suspender usuario",
      description: (u) =>
        `${u.name} no podrá iniciar sesión, todas sus sesiones activas se revocarán (expulsión en ≤60s) y sus invitaciones o resets pendientes quedarán invalidados.`,
      cta: "Suspender",
    },
    reactivate: {
      title: "Reactivar usuario",
      description: (u) => `${u.name} podrá volver a iniciar sesión con su contraseña actual.`,
      cta: "Reactivar",
    },
    "revoke-sessions": {
      title: "Revocar sesiones",
      description: (u) =>
        `Todas las sesiones activas de ${u.name} se revocarán (expulsión en ≤60s). Su cuenta sigue activa y podrá volver a entrar.`,
      cta: "Revocar sesiones",
    },
    "reset-mfa": {
      title: "Restablecer 2FA",
      description: (u) =>
        `Se eliminará el enrolamiento TOTP y los códigos de recuperación de ${u.name}. Podrá volver a configurar 2FA desde su perfil.`,
      cta: "Restablecer 2FA",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios y acceso</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Equipo interno: invitaciones, roles, suspensión y seguridad por cuenta.
          </p>
        </div>
        <InviteUserDialog />
      </div>

      {loadFailed && (
        <p className="text-sm text-red-400">
          No se pudo cargar el listado de usuarios. Recarga la página.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>2FA</TableHead>
                  <TableHead>Último acceso</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                      Sin usuarios que mostrar.
                    </TableCell>
                  </TableRow>
                )}
                {users.map((u) => {
                  const status = STATUS_META[u.status];
                  const isSelf = u.id === currentUserId;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-muted-foreground">(tú)</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                        {u.jobTitle && (
                          <div className="text-xs text-muted-foreground/70">{u.jobTitle}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {ROLE_LABELS[u.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <ShieldCheck className="h-4 w-4" aria-hidden />
                            <span className="text-xs">Activa</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.lastLoginAt)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={pending}
                              aria-label={`Acciones para ${u.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {(["admin", "staff", "reviewer"] as const)
                              .filter((r) => r !== u.role)
                              .map((r) => (
                                <DropdownMenuItem
                                  key={r}
                                  // Anti-lockout (espejo de la action): nadie se
                                  // quita a sí mismo el rol de administrador.
                                  disabled={isSelf && u.role === "admin"}
                                  onClick={() => setConfirm({ kind: "role", user: u, nextRole: r })}
                                >
                                  <UserCog className="mr-2 h-4 w-4" />
                                  {r === "admin" ? "Hacer administrador" : `Cambiar a ${ROLE_LABELS[r].toLowerCase()}`}
                                </DropdownMenuItem>
                              ))}
                            {u.status === "invited" && (
                              <DropdownMenuItem onClick={() => resend(u)}>
                                <MailPlus className="mr-2 h-4 w-4" />
                                Reenviar invitación
                              </DropdownMenuItem>
                            )}
                            {u.status === "suspended" ? (
                              <DropdownMenuItem
                                onClick={() => setConfirm({ kind: "reactivate", user: u })}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Reactivar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                disabled={isSelf}
                                onClick={() => setConfirm({ kind: "suspend", user: u })}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Suspender
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setConfirm({ kind: "revoke-sessions", user: u })}
                            >
                              <MonitorX className="mr-2 h-4 w-4" />
                              Revocar sesiones
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!u.mfaEnabled}
                              onClick={() => setConfirm({ kind: "reset-mfa", user: u })}
                            >
                              <ShieldCheck className="mr-2 h-4 w-4" />
                              Restablecer 2FA
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEventsUser(u)}>
                              <ScrollText className="mr-2 h-4 w-4" />
                              Ver eventos
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmación de acciones sensibles */}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          {confirm && (
            <>
              <DialogHeader>
                <DialogTitle>{CONFIRM_COPY[confirm.kind].title}</DialogTitle>
                <DialogDescription>
                  {CONFIRM_COPY[confirm.kind].description(confirm.user)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)} disabled={pending}>
                  Cancelar
                </Button>
                <Button
                  variant={
                    confirm.kind === "suspend" || confirm.kind === "revoke-sessions"
                      ? "destructive"
                      : "default"
                  }
                  onClick={confirmAction}
                  disabled={pending}
                >
                  {CONFIRM_COPY[confirm.kind].cta}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <UserEventsDialog user={eventsUser} onClose={() => setEventsUser(null)} />
    </div>
  );
}
