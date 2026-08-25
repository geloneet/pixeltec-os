"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMyNotifications,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from "@/lib/notifications/actions";
import type { Notification } from "@/lib/notifications/schemas";
import { useIsRestrictedRole } from "@/hooks/use-restricted-role";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

// Fase 4: Postgres en vez del onSnapshot de Firestore — polling cada 60s
// (+ refetch al volver el foco a la pestaña), suficiente para un feed de
// notificaciones de crons diarios. Si algún día molesta, subir a SSE.
const POLL_INTERVAL_MS = 60_000;

export function useNotifications(): UseNotificationsReturn {
  // WO-2026-00055: el reviewer no tiene notificaciones (server actions → 403
  // en middleware). No se consulta nada: campana vacía, sin error.
  const restricted = useIsRestrictedRole();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (restricted === undefined) return; // sesión cargando: espera
    if (restricted) {
      setNotifications([]);
      setError(null);
      setLoading(false);
      return;
    }
    try {
      const items = await getMyNotifications(20);
      setNotifications(items);
      setError(null);
    } catch (err) {
      console.error("useNotifications error:", err);
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }, [restricted]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimista: se marca local de inmediato y se persiste en background.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n))
      );
      if (restricted) return;
      try {
        await markNotificationReadAction(id);
      } catch (err) {
        console.error("[useNotifications] markAsRead error:", err);
        void refresh();
      }
    },
    [refresh, restricted]
  );

  const markAllAsRead = useCallback(async () => {
    if (restricted) return;
    if (!notifications.some((n) => !n.read)) return;
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.read ? n : { ...n, read: true, readAt: now })));
    try {
      await markAllNotificationsReadAction();
    } catch (err) {
      console.error("[useNotifications] markAllAsRead error:", err);
      void refresh();
    }
  }, [notifications, refresh, restricted]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead };
}
