"use client";

import { useUserProfile } from "@/hooks/use-user-profile";
import { isRestrictedRole } from "@/lib/routes/reviewer-access";

/**
 * ¿La sesión actual es de un rol restringido (reviewer, WO-2026-00051)?
 *
 * - `undefined` → la sesión aún carga: no decidas nada todavía.
 * - `true` → el shell del admin NO debe disparar llamadas que el middleware
 *   deniega (server actions del CRM/notificaciones, `/api/vps/status`…) ni
 *   mostrar toasts por ello (WO-2026-00055).
 * - `false` → admin/staff: comportamiento de siempre.
 *
 * PRESENTACIÓN solamente: el enforcement vive en `src/middleware.ts` y los
 * guards; este hook solo evita ruido (403 en consola, toasts) en el cliente.
 * Reutiliza la misma `isRestrictedRole` que aplica el middleware para que
 * ambos lados clasifiquen igual (rol desconocido ⇒ restringido).
 */
export function useIsRestrictedRole(): boolean | undefined {
  const { userProfile, loading } = useUserProfile();
  if (loading) return undefined;
  if (!userProfile) return undefined;
  return isRestrictedRole(userProfile.role);
}
