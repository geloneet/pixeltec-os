# PixelTEC Nav Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar sidebar con labels por icon-only con tooltips, conectar el avatar al Firebase Auth photoURL real, y construir el sistema completo de notificaciones Firestore con UI funcional.

**Architecture:** Tres componentes independientes en `src/components/nav/` que comparten el mismo estilo glass (`bg-zinc-950/95 backdrop-blur-xl border border-white/10`). La capa de datos de notificaciones usa un hook `useNotifications` con `onSnapshot` en el cliente; las escrituras futuras pasan por un Server Action que usa Admin SDK. El `GlobalHeader` existente se actualiza para montar los nuevos componentes en lugar de los elementos hardcodeados.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript estricto, Tailwind CSS, shadcn/ui (tooltip, dropdown-menu, avatar, separator — todos ya instalados), Radix UI, Firebase Client SDK (onSnapshot, updateDoc, serverTimestamp, writeBatch), Firebase Admin SDK (createNotification action), Zod, lucide-react.

---

## Diagnóstico previo (completado)

- **Sidebar actual**: `src/components/nav/desktop-sidebar.tsx` — `w-60` con labels, reemplazar completo
- **Avatar roto**: `global-header.tsx` usa `process.env.NEXT_PUBLIC_PROFILE_PHOTO_URL!` hardcodeado — reemplazar con `useUser().photoURL`
- **`useUser()`** devuelve Firebase `User` con `.photoURL`, `.displayName`, `.email` — listo para usar
- **`useUserProfile()`** devuelve doc Firestore con `.role` — usar para badge admin
- **next.config.ts**: Falta `lh3.googleusercontent.com` en `remotePatterns`
- **Logout existente**: `DELETE /api/auth/session` → `signOut(auth)` → `router.push('/login')` — mantener patrón
- **shadcn/ui disponibles**: `tooltip.tsx`, `dropdown-menu.tsx`, `avatar.tsx`, `separator.tsx` — todos listos
- **Firestore rules**: Existe `/home/ubuntu/pixeltec-os/firestore.rules`, falta bloque `notifications`
- **`PALETTE_NAV_ITEMS`**: Exportado de `command-palette-items.ts` — reusar en sidebar

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `src/components/nav/desktop-sidebar.tsx` | REWRITE | Sidebar 64px icon-only con Tooltip |
| `src/components/nav/user-menu.tsx` | CREATE | UserAvatar + DropdownMenu de perfil |
| `src/components/nav/notifications-menu.tsx` | CREATE | Campana + Dropdown de notificaciones |
| `src/components/nav/global-header.tsx` | MODIFY | Montar UserMenu + NotificationsMenu |
| `src/lib/notifications/schemas.ts` | CREATE | Tipos Zod para Notification |
| `src/lib/notifications/actions.ts` | CREATE | createNotification (Admin SDK) |
| `src/hooks/use-notifications.ts` | CREATE | onSnapshot hook, markAsRead, markAllAsRead |
| `src/app/(admin)/perfil/page.tsx` | CREATE | Placeholder page |
| `src/app/(admin)/notificaciones/page.tsx` | CREATE | Placeholder page |
| `next.config.ts` | MODIFY | Agregar remotePattern lh3.googleusercontent.com |
| `firestore.rules` | MODIFY | Agregar bloque match /notifications/ |

---

## Task 1: next.config.ts — agregar remotePattern de Google

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Agregar remotePattern**

En `next.config.ts`, dentro del array `remotePatterns`, agregar DESPUÉS del último item existente (`i.pravatar.cc`):

```typescript
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
```

El bloque `images.remotePatterns` debe quedar:
```typescript
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'i.pravatar.cc', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', port: '', pathname: '/**' },
    ],
  },
```

- [ ] **Step 2: Commit**

```bash
git add next.config.ts
git commit -m "feat: allow Google profile photos in next/image remotePatterns"
```

---

## Task 2: Sidebar icon-only con Tooltips

**Files:**
- Modify: `src/components/nav/desktop-sidebar.tsx`

- [ ] **Step 1: Reescribir el componente completo**

Reemplazar todo el contenido de `src/components/nav/desktop-sidebar.tsx` con:

```typescript
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth } from "@/firebase";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const handleLogout = async () => {
    if (!auth) return;
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/login");
  };

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="h-full w-16 flex-shrink-0 flex flex-col bg-zinc-950/80 backdrop-blur-xl border-r border-white/5">
        {/* Nav items */}
        <nav className="flex-1 flex flex-col items-center gap-1 py-4 overflow-y-auto">
          {PALETTE_NAV_ITEMS.map((item) => {
            const active = isActive(item.href, pathname);
            const Icon = item.icon;
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150",
                      active
                        ? "bg-sky-500/10 text-sky-400"
                        : "text-zinc-500 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-sky-400" />
                    )}
                    <Icon className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  sideOffset={12}
                  className="bg-zinc-900 border border-white/10 text-zinc-100 text-sm px-3 py-1.5 rounded-lg shadow-xl"
                >
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Separator + Logout */}
        <div className="flex flex-col items-center pb-4 border-t border-white/5 pt-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-150"
              >
                <LogOut className="h-5 w-5 flex-shrink-0" strokeWidth={1.75} />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={12}
              className="bg-zinc-900 border border-white/10 text-zinc-100 text-sm px-3 py-1.5 rounded-lg shadow-xl"
            >
              Cerrar sesión
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
```

- [ ] **Step 2: Verificar que el layout ya usa w-16 implícitamente**

El `AdminLayout` en `src/app/(admin)/layout.tsx` envuelve la sidebar con `<div className="relative z-10 hidden xl:block flex-shrink-0">`. El componente ya define `w-16` internamente — no hay nada que cambiar en el layout.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/desktop-sidebar.tsx
git commit -m "feat: sidebar icon-only 64px con Tooltip al hover"
```

---

## Task 3: Notificaciones — Schema Zod

**Files:**
- Create: `src/lib/notifications/schemas.ts`

- [ ] **Step 1: Crear el schema**

```typescript
import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "info",
  "success",
  "warning",
  "error",
  "alert",
]);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  title: z.string(),
  body: z.string(),
  href: z.string().optional(),
  source: z.string(),
  read: z.boolean(),
  createdAt: z.unknown(), // Firestore Timestamp — opaco en el cliente
  readAt: z.unknown().nullable(),
  metadata: z.record(z.unknown()).optional(),
});
export type Notification = z.infer<typeof NotificationSchema>;

export const CreateNotificationInputSchema = z.object({
  userId: z.string().min(1),
  type: NotificationTypeSchema,
  title: z.string().min(1),
  body: z.string().min(1),
  href: z.string().optional(),
  source: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications/schemas.ts
git commit -m "feat: zod schemas for Notification collection"
```

---

## Task 4: Notificaciones — Server Action (preparada, no cableada)

**Files:**
- Create: `src/lib/notifications/actions.ts`

- [ ] **Step 1: Verificar que firebase-admin está disponible**

```bash
grep -r "firebase-admin" /home/ubuntu/pixeltec-os/src/lib/ --include="*.ts" | head -5
```

Buscar cómo se inicializa el Admin SDK en el proyecto (probablemente en `src/lib/firebase-admin.ts` o similar).

- [ ] **Step 2: Crear la action**

Primero verificar el path del admin SDK. Buscar con:
```bash
grep -rn "getFirestore\|admin.firestore\|adminDb\|getApp" src/lib/ src/firebase/ --include="*.ts" | head -10
```

Luego crear `src/lib/notifications/actions.ts`:

```typescript
"use server";

import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApp, getApps, initializeApp, cert } from "firebase-admin/app";
import { CreateNotificationInputSchema, type CreateNotificationInput } from "./schemas";

function getAdminApp() {
  if (getApps().length > 0) return getApp();
  return initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)),
  });
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const parsed = CreateNotificationInputSchema.parse(input);
  const app = getAdminApp();
  const db = getFirestore(app);

  await db.collection("notifications").add({
    ...parsed,
    read: false,
    readAt: null,
    createdAt: Timestamp.now(),
  });
}
```

> **Nota:** Si el proyecto ya tiene una función `getAdminApp()` en `src/lib/firebase-admin.ts`, importar desde ahí en lugar de redefinirla. Verificar antes de escribir.

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/
git commit -m "feat: createNotification server action (Admin SDK, not yet wired to events)"
```

---

## Task 5: Notificaciones — Hook cliente useNotifications

**Files:**
- Create: `src/hooks/use-notifications.ts`

- [ ] **Step 1: Crear el hook**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { NotificationSchema, type Notification } from "@/lib/notifications/schemas";

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const user = useUser();
  const db = useFirestore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: Notification[] = [];
        snapshot.forEach((docSnap) => {
          const parsed = NotificationSchema.safeParse({
            id: docSnap.id,
            ...docSnap.data(),
          });
          if (parsed.success) items.push(parsed.data);
        });
        setNotifications(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("useNotifications error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!db) return;
      await updateDoc(doc(db, "notifications", id), {
        read: true,
        readAt: serverTimestamp(),
      });
    },
    [db]
  );

  const markAllAsRead = useCallback(async () => {
    if (!db) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, "notifications", n.id), {
        read: true,
        readAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }, [db, notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead };
}
```

- [ ] **Step 2: Verificar que `useFirestore` acepta `null` correctamente**

El hook verifica `!db` antes de suscribirse, lo que es correcto dado que `useFirestore()` puede retornar `null` antes de inicializar.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-notifications.ts
git commit -m "feat: useNotifications hook with onSnapshot, markAsRead, markAllAsRead"
```

---

## Task 6: UserMenu — avatar real + dropdown de perfil

**Files:**
- Create: `src/components/nav/user-menu.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { LogOut, User, Settings } from "lucide-react";
import { signOut } from "firebase/auth";
import { useAuth, useUser, useUserProfile } from "@/firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim()[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "U";
}

export function UserMenu() {
  const router = useRouter();
  const auth = useAuth();
  const user = useUser();
  const { userProfile } = useUserProfile();

  const handleLogout = async () => {
    if (!auth) return;
    await fetch("/api/auth/session", { method: "DELETE" });
    await signOut(auth);
    router.push("/login");
  };

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const isAdmin = userProfile?.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="relative flex-shrink-0 rounded-full ring-offset-[#030303] transition-all hover:ring-2 hover:ring-sky-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50"
        >
          {/* Avatar */}
          <div className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                <span className="text-white text-xs font-semibold uppercase select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Admin badge overlay */}
          {isAdmin && (
            <span className="absolute -bottom-0.5 -right-0.5 z-10 flex items-center justify-center rounded-full bg-amber-500 text-black text-[9px] font-bold px-1 py-0.5 leading-none border border-[#030303]">
              A
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.6)] rounded-xl p-1"
      >
        {/* Header con foto grande */}
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                <span className="text-white text-sm font-semibold uppercase select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-zinc-100 font-semibold text-sm truncate">
              {user.displayName ?? "Usuario"}
            </span>
            <span className="text-zinc-500 text-xs truncate">{user.email}</span>
            {isAdmin && (
              <span className="mt-0.5 self-start text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none">
                admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/5" />

        <DropdownMenuItem
          className="flex items-center gap-2 text-zinc-300 hover:text-white focus:text-white focus:bg-white/5 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={() => router.push("/perfil")}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          Mi perfil
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 text-zinc-300 hover:text-white focus:text-white focus:bg-white/5 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={() => router.push("/settings")}
        >
          <Settings className="h-4 w-4 flex-shrink-0" />
          Configuración
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/5" />

        <DropdownMenuItem
          className="flex items-center gap-2 text-rose-400 hover:text-rose-300 focus:text-rose-300 focus:bg-rose-500/10 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/nav/user-menu.tsx
git commit -m "feat: UserMenu with Firebase photoURL, initials fallback, admin badge overlay"
```

---

## Task 7: NotificationsMenu — campana + dropdown Firestore

**Files:**
- Create: `src/components/nav/notifications-menu.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
"use client";

import { useRouter } from "next/navigation";
import { Bell, Info, CheckCircle, AlertTriangle, XCircle, Zap, BellOff } from "lucide-react";
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
    // Firestore Timestamp tiene .toDate()
    const date =
      ts && typeof ts === "object" && "toDate" in ts
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
      {/* Unread dot */}
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

        {/* List */}
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
```

- [ ] **Step 2: Verificar que date-fns está instalado**

```bash
grep '"date-fns"' /home/ubuntu/pixeltec-os/package.json
```

Si no está: `npm install date-fns`

- [ ] **Step 3: Commit**

```bash
git add src/components/nav/notifications-menu.tsx
git commit -m "feat: NotificationsMenu with Firestore onSnapshot, unread badge, markAsRead"
```

---

## Task 8: Actualizar GlobalHeader

**Files:**
- Modify: `src/components/nav/global-header.tsx`

- [ ] **Step 1: Reemplazar avatar y campana con los nuevos componentes**

Reemplazar todo el contenido de `src/components/nav/global-header.tsx`:

```typescript
"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { LayoutGrid, Search } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";
import { UserMenu } from "./user-menu";
import { NotificationsMenu } from "./notifications-menu";

function currentPageLabel(pathname: string): string {
  const item = PALETTE_NAV_ITEMS.find(
    (item) =>
      pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
  return item?.label ?? "PixelTEC OS";
}

export function GlobalHeader() {
  const { setOpen } = useCmdK();
  const pathname = usePathname();
  const pageLabel = currentPageLabel(pathname);

  return (
    <header className="relative flex-shrink-0 w-full flex items-center h-14 sm:h-16 px-4 sm:px-6 lg:px-8">
      {/* ── LEFT: Logo + page title ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL!}
          alt="PixelTEC Logo"
          width={36}
          height={36}
          className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9"
        />
        <span className="font-logo font-extrabold uppercase tracking-tighter text-gray-100 text-xl sm:text-2xl flex-shrink-0">
          Pixel<span className="text-brand-blue">Tec</span>
        </span>
        <span className="hidden lg:block text-zinc-500 text-sm font-medium truncate">
          / {pageLabel}
        </span>
      </div>

      {/* ── CENTER: Page title (mobile only) ─────────────────────────────────── */}
      <span
        className="lg:hidden absolute left-1/2 -translate-x-1/2 font-logo font-bold uppercase tracking-tighter text-gray-100 text-base sm:text-lg pointer-events-none select-none whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        {pageLabel}
      </span>

      {/* ── RIGHT: Search + Notifications + UserMenu ─────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Command Palette trigger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú de navegación"
          className="flex items-center gap-2 h-9 sm:h-10 px-3 rounded-full border backdrop-blur-md bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        >
          <LayoutGrid className="w-4 h-4 sm:hidden" />
          <span className="text-xs font-medium sm:hidden">Menú</span>
          <Search className="w-4 h-4 hidden sm:block" />
          <span className="hidden sm:block text-xs">Buscar</span>
          <kbd className="hidden lg:inline-flex items-center rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
            ⌘K
          </kbd>
        </button>

        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/nav/global-header.tsx
git commit -m "feat: wire UserMenu and NotificationsMenu into GlobalHeader"
```

---

## Task 9: Páginas placeholder

**Files:**
- Create: `src/app/(admin)/perfil/page.tsx`
- Create: `src/app/(admin)/notificaciones/page.tsx`

- [ ] **Step 1: Crear `/perfil`**

```typescript
export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-100">Mi perfil</h1>
      <p className="text-zinc-500 text-sm">Próximamente — configuración de cuenta y preferencias.</p>
    </div>
  );
}
```

- [ ] **Step 2: Crear `/notificaciones`**

```typescript
export default function NotificacionesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-zinc-100">Notificaciones</h1>
      <p className="text-zinc-500 text-sm">Próximamente — historial completo y filtros por tipo.</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/perfil/page.tsx" "src/app/(admin)/notificaciones/page.tsx"
git commit -m "feat: add placeholder pages for /perfil and /notificaciones"
```

---

## Task 10: Firestore rules — bloque notifications

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Agregar el bloque**

En `firestore.rules`, ANTES del bloque `// ═══════ Crypto Intelligence`, agregar:

```
    // ── Notifications ─────────────────────────────────────────────────────
    match /notifications/{notificationId} {
      allow read: if request.auth != null
        && resource.data.userId == request.auth.uid;
      allow update: if request.auth != null
        && resource.data.userId == request.auth.uid
        && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['read', 'readAt']);
      allow create, delete: if false;
    }
```

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat: add Firestore security rules for notifications collection"
```

---

## Task 11: Build + deploy

- [ ] **Step 1: Build**

```bash
cd /home/ubuntu/pixeltec-os && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` o similar. Si hay errores de TypeScript, corregirlos.

- [ ] **Step 2: Docker build + up**

```bash
cd /home/ubuntu/pixeltec-os && docker compose build app && docker compose up -d app
```

- [ ] **Step 3: Verificar BUILD_ID**

```bash
cat /home/ubuntu/pixeltec-os/.next/BUILD_ID
```

Luego verificar que el contenedor lo tiene:
```bash
docker compose exec app cat /app/.next/BUILD_ID
```

Ambos deben coincidir.

- [ ] **Step 4: Deploy Firestore rules**

```bash
# Reconstruir SA key desde variables de entorno (usar script Python de sesiones previas)
# firebase deploy --only firestore:rules --project studio-1487114664-78b63
# shred -u /tmp/firebase-sa-temp.json
```

> Confirmar con el usuario el mecanismo para reconstruir el SA key antes de ejecutar.

---

## Checklist de validación manual

### Sidebar
- [ ] Ancho 64px, solo íconos visibles en ≥1280px
- [ ] Hover muestra tooltip flotante a la derecha con label
- [ ] Ruta activa: borde izquierdo sky-400 + icono sky-400 + fondo sky-500/10
- [ ] Logout al fondo funciona y redirige a /login

### Avatar
- [ ] Foto real del admin visible (photoURL de Firebase Auth)
- [ ] Fallback a iniciales con gradient sky→indigo si no hay photoURL
- [ ] Badge "A" (admin) en esquina inferior-derecha del avatar, no al lado
- [ ] Click abre dropdown con displayName + email + foto grande
- [ ] Items "Mi perfil" y "Configuración" navegan correctamente
- [ ] Cerrar sesión redirige a /login y no deja cookie

### Notificaciones
- [ ] Campana visible en header
- [ ] Badge/dot de unread visible cuando hay sin leer (badge "9+" si >9)
- [ ] Click abre dropdown con lista de Firestore real
- [ ] Click en notificación la marca leída y cierra (navega si tiene href)
- [ ] "Marcar todas como leídas" actualiza en batch
- [ ] Empty state con ícono BellOff cuando lista vacía
- [ ] "Ver todas" navega a /notificaciones

### No-regresión
- [ ] Command Palette (⌘K) sigue funcionando
- [ ] /crypto-intel intacto
- [ ] Cards del dashboard sin cambios
