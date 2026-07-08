'use client';

import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { useAuth } from '../provider';

/**
 * Hook de Firebase Auth REAL (no el shim de NextAuth) — implementación
 * original de `useUser()` antes de la Fase 2 de la migración. Se preserva
 * aquí exclusivamente para el portal legado de clientes en `src/app/portal/`
 * (autenticado con email/password de Firebase directo, distinto del portal
 * OTP en `/[slug]` y distinto del dashboard admin). El dashboard admin migró
 * a NextAuth — ver `src/firebase/auth/use-user.tsx` — pero este portal legado
 * sigue usando cuentas de Firebase Auth que no existen en la tabla `users`
 * de Postgres, así que NO puede pasar por el shim de NextAuth.
 */
export function useFirebaseUser() {
  const auth = useAuth();
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, [auth]);

  return user;
}
