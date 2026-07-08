'use client';

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Fase 2 de la migración (Firebase Auth → NextAuth): shim de compatibilidad.
 * Devuelve la misma forma que antes (uid/email/displayName/photoURL) para
 * no tocar los ~20 sitios que consumen `useUser()` en toda la app — ahora
 * respaldado por la sesión de NextAuth en vez del SDK cliente de Firebase.
 *
 * `uid` es el Firebase UID puente (`firebaseUid`), no el id de Postgres —
 * mientras los datos sigan en Firestore, el resto del código sigue
 * necesitando ese valor para sus queries.
 *
 * IMPORTANTE: el resultado va memoizado por campos primitivos. El useUser()
 * original de Firebase devolvía una referencia ESTABLE (el User de
 * onAuthStateChanged); varios consumidores dependen de eso usando `user`
 * como dep de useEffect/useCallback (CRMContextCore, documentos, tabs...).
 * Sin el useMemo, cada render creaba un objeto nuevo → los efectos de carga
 * se re-disparaban en bucle → los refetch pisaban updates optimistas
 * (flicker "guarda → se borra → reaparece" al guardar en el CRM).
 */
export interface CompatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function useUser(): CompatUser | null | undefined {
  const { data: session, status } = useSession();

  const uid = session?.user ? session.user.firebaseUid ?? session.user.id ?? null : null;
  const email = session?.user?.email ?? null;
  const displayName = session?.user?.name ?? null;
  const photoURL = session?.user?.image ?? null;

  return useMemo(() => {
    if (status === 'loading') return undefined;
    if (status !== 'authenticated' || !uid) return null;
    return { uid, email, displayName, photoURL };
  }, [status, uid, email, displayName, photoURL]);
}
