import type { DefaultSession } from "next-auth";

/**
 * Contrato de identidad de la sesión (Gate B6 — Firebase Exit).
 *
 * La identidad canónica de PixelTEC OS es `users.id` (uuid de Postgres) — es
 * lo que referencian los `owner_id` de todas las tablas de negocio vía clave
 * foránea. El alias heredado de Firebase ya NO viaja en el JWT ni en la
 * sesión: la única compatibilidad restante (paths de storage de avatares
 * antiguos) se resuelve con una lectura puntual de `users.firebase_uid` en
 * `src/lib/profile/actions.ts`, y desaparece con la columna en el Gate B8.
 */
declare module "next-auth" {
  interface User {
    role?: string;
  }
  interface Session {
    user: {
      /**
       * Identidad canónica: `users.id` de Postgres. Presente siempre en una
       * sesión válida — se sella en el JWT al autenticar.
       */
      id: string;
      role?: string;
      /**
       * `iat` del JWT en segundos epoch. Se expone para poder comparar la
       * antigüedad del token contra `users.sessions_valid_from` y revocar
       * sesiones emitidas antes de un cambio de contraseña.
       */
      sessionIssuedAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** Identidad canónica: `users.id`. */
    id?: string;
    role?: string;
  }
}
