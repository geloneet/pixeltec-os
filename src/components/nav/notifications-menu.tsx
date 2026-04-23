"use client";

import { useRouter } from "next/navigation";
import {
  Bell,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  BellOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/lib/notifications/schemas";

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  info: <Info className="h-4 w-4 text-sky-400 flex-shrink-0" />,
  success: <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />,
  error: <XCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />,
  alert: <Zap className="h-4 w-4 text-violet-400 flex-shrink-0" />,
};

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
    return "";
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
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
        notification.read
          ? "hover:bg-white/5"
          : "bg-sky-500/5 hover:bg-sky-500/10"
      )}
      onClick={() => onRead(notification.id, notification.href)}
    >
      {/* Icon + unread dot */}
      <div className="relative mt-0.5 flex-shrink-0">
        {TYPE_ICONS[notification.type]}
        {!notification.read && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-sky-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium truncate",
            notification.read ? "text-zinc-400" : "text-zinc-100"
          )}
        >
          {notification.title}
        </p>
        <p
          className={cn(
            "text-xs mt-0.5 line-clamp-2",
            notification.read ? "text-zinc-600" : "text-zinc-400"
          )}
        >
          {notification.body}
        </p>
        <p className="text-[10px] text-zinc-600 mt-1">
          {relativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

export function NotificationsMenu() {
  const router = useRouter();
  const { notifications, unreadCount, error, markAsRead, markAllAsRead } =
    useNotifications();

  const handleRead = async (id: string, href?: string) => {
    await markAsRead(id);
    if (href) router.push(href);
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notificaciones"
          className="relative flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/5 border border-white/10 backdrop-blur-md text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 border-2 border-[#030303] text-[9px] font-bold text-white px-0.5">
              {badgeLabel}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.6)] rounded-xl p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-semibold text-zinc-100">
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              onClick={markAllAsRead}
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Error state */}
        {error && (
          <div className="px-4 py-3 text-xs text-rose-400">
            Error al cargar notificaciones.
          </div>
        )}

        {/* List or empty state */}
        {!error && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <BellOff className="h-8 w-8 text-zinc-700" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No tienes notificaciones</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="p-2 flex flex-col gap-0.5">
              {notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} onRead={handleRead} />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator className="bg-white/5" />
            <div className="px-4 py-2.5">
              <button
                type="button"
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                onClick={() => router.push("/notificaciones")}
              >
                Ver todas las notificaciones →
              </button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
