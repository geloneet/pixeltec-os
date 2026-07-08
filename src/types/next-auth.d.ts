import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
    /**
     * Bridge de identidad durante la migración (Fase 2): mientras los datos
     * sigan en Firestore (Fase 3 no ha corrido), este es el Firebase UID
     * original — todas las queries de Firestore/crm_data siguen usando este
     * valor, no el id de Postgres.
     */
    firebaseUid?: string;
  }
  interface Session {
    user: {
      role?: string;
      firebaseUid?: string;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    firebaseUid?: string;
  }
}
