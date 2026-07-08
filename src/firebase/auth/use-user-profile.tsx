'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Fase 2 de la migración: el rol ya viene en la sesión de NextAuth
 * (`users.role` de Postgres), no hace falta leer un doc de Firestore aparte
 * — esto simplifica lo que antes era una suscripción `onSnapshot` a
 * `users/{uid}`.
 *
 * Igual que `use-user.tsx`: resultado memoizado por campos primitivos para
 * mantener identidad estable entre renders (los consumidores lo usan como
 * dep de efectos).
 */
interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  role?: 'admin' | 'staff';
}

export function useUserProfile(): { userProfile: UserProfile | null; loading: boolean } {
  const { data: session, status } = useSession();

  const uid = session?.user ? session.user.firebaseUid ?? session.user.id ?? null : null;
  const email = session?.user?.email ?? undefined;
  const displayName = session?.user?.name ?? undefined;
  const role = session?.user?.role as 'admin' | 'staff' | undefined;

  return useMemo(() => {
    if (status === 'loading') return { userProfile: null, loading: true };
    if (status !== 'authenticated' || !uid) return { userProfile: null, loading: false };
    return { userProfile: { uid, email, displayName, role }, loading: false };
  }, [status, uid, email, displayName, role]);
}
