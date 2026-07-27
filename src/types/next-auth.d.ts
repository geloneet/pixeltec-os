import type { DefaultSession } from "next-auth";

/**
 * Contrato de identidad de la sesión.
 *
 * La identidad canónica de PixelTEC OS es `users.id` (uuid de Postgres) — es
 * lo que referencian los `owner_id` de todas las tablas de negocio vía clave
 * foránea. `firebaseUid` NO es identidad canónica: es un alias heredado de la
 * migración Firebase → Postgres que sobrevive solo como ventana de
 * compatibilidad para las cuentas creadas antes del corte.
 *
 * Regla: nada de autenticación, autorización ni acceso a datos puede depender
 * de `firebaseUid`. Una cuenta sin él debe funcionar igual.
 */
declare module "next-auth" {
  interface User {
    role?: string;
    /**
     * Alias heredado, opcional. Las cuentas creadas después de la migración lo
     * tienen a `null` y eso es correcto — no se generan valores nuevos.
     * @deprecated No usar como identidad. Usar `id` (`users.id`).
     */
    firebaseUid?: string | null;
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
       * @deprecated Alias heredado. Ver la nota de cabecera del módulo.
       */
      firebaseUid?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    /** Identidad canónica: `users.id`. */
    id?: string;
    role?: string;
    /**
     * @deprecated Alias heredado. Ver la nota de cabecera del módulo.
     */
    firebaseUid?: string | null;
  }
}
