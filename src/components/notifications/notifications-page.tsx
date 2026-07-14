"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  BellOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { Notification, NotificationType } from "@/lib/notifications/schemas";

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  info: <Info className="h-5 w-5 text-sky-400 flex-shrink-0" />,
  success: <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />,
  error: <XCircle className="h-5 w-5 text-rose-400 flex-shrink-0" />,
  alert: <Zap className="h-5 w-5 text-violet-400 flex-shrink-0" />,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  info: "Info",
  success: "Éxito",
  warning: "Aviso",
  error: "Error",
  alert: "Alerta",
};

const ALL_TYPES: NotificationType[] = ["info", "success", "warning", "error", "alert"];

function relativeTime(ts: unknown): string {
  try {
    const date =
      ts !== null &&
      ts !== undefined &&
      typeof ts === "object" &&
      "toDate" in ts
        ? (ts as { toDate: () => Date }).toDate()
        : new Date(ts as string);
    return formatDistanceToNow(date, { addSuffix: true, locale: es });
  } catch {
    return "—";
  }
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string, href?: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-start gap-4 px-4 py-4 rounded-xl text-left transition-colors",
        notification.read
          ? "hover:bg-accent"
          : "bg-sky-500/5 hover:bg-sky-500/10"
      )}
      onClick={() => onRead(notification.id, notification.href)}
    >
      {/* Icon + unread dot */}
      <div className="relative mt-0.5 flex-shrink-0">
        {TYPE_ICONS[notification.type]}
        {!notification.read && (
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold truncate",
            notification.read ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            "text-sm mt-1 line-clamp-2",
            notification.read ? "text-muted-foreground/70" : "text-muted-foreground"
          )}
        >
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1.5">
          {relativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

export function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } =
    useNotifications();

  const [activeType, setActiveType] = useState<NotificationType | null>(null);

  const handleRead = async (id: string, href?: string) => {
    await markAsRead(id);
    if (href) router.push(href);
  };

  // Determine which type chips to show (only types with at least one notification)
  const presentTypes = ALL_TYPES.filter((t) =>
    notifications.some((n) => n.type === t)
  );

  const filtered =
    activeType === null
      ? notifications
      : notifications.filter((n) => n.type === activeType);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificaciones</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {unreadCount} sin leer
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors font-medium"
          >
            Marcar todas como leídas
          </button>
        )}
      </div>

      {/* Filter chips */}
      {presentTypes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveType(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
              activeType === null
                ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70"
            )}
          >
            Todas
          </button>
          {presentTypes.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveType(t)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                activeType === t
                  ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-300"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              )}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-4 text-sm text-rose-700 dark:text-rose-400">
          Error al cargar notificaciones.
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notifications.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
          <BellOff className="h-10 w-10 text-muted-foreground/50" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">No tienes notificaciones.</p>
        </div>
      )}

      {/* Filtered empty state */}
      {!loading && !error && notifications.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No hay notificaciones de tipo{" "}
            <span className="text-foreground">{activeType ? TYPE_LABELS[activeType] : ""}</span>.
          </p>
        </div>
      )}

      {/* Notification list */}
      {!loading && !error && filtered.length > 0 && (
        <div className="flex flex-col gap-2">
          {filtered.map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={handleRead} />
          ))}
        </div>
      )}
    </div>
  );
}
