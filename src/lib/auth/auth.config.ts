import type { NextAuthConfig } from "next-auth";

/**
 * Config "edge-safe" (sin providers, sin acceso a DB) — la usa
 * src/middleware.ts para verificar la sesión (decodificar el JWT) en cada
 * request sin necesitar Postgres disponible. El provider real (Credentials +
 * bcrypt + Drizzle) vive en `./config.ts`, importado solo donde se necesita
 * `signIn`/`signOut`/el login real.
 */
/**
 * Código de error estable para una sesión sin identidad canónica. Se lanza en
 * vez de degradar a un valor vacío: un `ownerId` de cadena vacía se colaría en
 * las consultas como si fuera legítimo y devolvería resultados de nadie, en
 * silencio. Fail-closed.
 */
export const AUTH_SESSION_USER_ID_MISSING = "AUTH_SESSION_USER_ID_MISSING";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        // `token.id` es la identidad canónica (users.id). Se sella aquí y solo
        // aquí. Si `authorize()` devolviera un usuario sin id, el token quedaría
        // mudo y toda la app rebotaría al login sin explicación — se registra en
        // vez de fallar en silencio.
        if (!user.id) {
          console.error(
            "[auth] authorize() devolvió un usuario sin id — la sesión no podrá resolver identidad"
          );
        }
        token.id = user.id;
        token.role = user.role;
        // Alias heredado: se propaga si existe, pero nada debe depender de él.
        token.firebaseUid = user.firebaseUid ?? null;
      }
      // `useSession().update({ name?, image? })` desde el cliente tras editar
      // el perfil — sin esto el header mostraría nombre/foto viejos hasta el
      // siguiente login (el JWT solo se sella al iniciar sesión).
      if (trigger === "update" && session) {
        if ("image" in session) token.picture = session.image ?? null;
        if (typeof session.name === "string") token.name = session.name;
      }
      return token;
    },
    session({ session, token }) {
      // Fail-closed sobre la identidad canónica. No hay valor de reserva: sin
      // un `users.id` real no se construye una sesión que parezca válida.
      const userId = token.id;
      if (typeof userId !== "string" || userId.length === 0) {
        // Sin token ni datos de la sesión en el mensaje: solo el hecho.
        console.error("[auth] token de sesión sin users.id — sesión rechazada");
        throw new Error(AUTH_SESSION_USER_ID_MISSING);
      }
      session.user.id = userId;
      if (token.role) session.user.role = token.role;
      // Alias heredado: viaja solo informativamente.
      session.user.firebaseUid = token.firebaseUid ?? null;
      return session;
    },
  },
};
