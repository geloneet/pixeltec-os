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
    /**
     * C-PR3: sid de `user_sessions` acuñado por `authorize()` en el login
     * (ahí están la IP y el user-agent). El callback `jwt` lo sella en el
     * token. Puede faltar si el mint fire-safe falló — el acuñado perezoso
     * del callback lo reintenta.
     */
    sid?: string | null;
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
       * C-PR3: id de la fila `user_sessions` de ESTA sesión. Lo usan las
       * server actions para excluir la sesión actual al revocar las demás.
       * Opcional: tokens legacy pueden no tenerlo aún.
       */
      sid?: string;
      /**
       * `iat` del JWT en segundos epoch. Lo consume la autoridad canónica
       * (`src/lib/auth/authority.ts`) para descartar tokens anteriores al
       * corte global de credenciales (`users.sessions_valid_from`).
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
    /** C-PR3: sid de `user_sessions` (revocación de sesiones). */
    sid?: string;
    /** C-PR3: epoch ms de la última revalidación del sid (throttle 60s). */
    chk?: number;
  }
}
