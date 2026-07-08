'use client';

import { useEffect, useState } from 'react';

interface LegacyPortalUser {
  displayName: string | null;
  email: string | null;
}

/**
 * Reemplaza `useFirebaseUser()` para el portal legado — mismo contrato
 * (undefined = cargando, null = no autenticado, objeto = autenticado) para
 * que `portal/layout.tsx` no necesite reescribir su lógica de redirect.
 */
export function useLegacyPortalUser(): LegacyPortalUser | null | undefined {
  const [user, setUser] = useState<LegacyPortalUser | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/portal/legacy-session', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
