import type { NextAuthConfig } from "next-auth";

/**
 * Config "edge-safe" (sin providers, sin acceso a DB) — la usa
 * src/middleware.ts para verificar la sesión (decodificar el JWT) en cada
 * request sin necesitar Postgres disponible. El provider real (Credentials +
 * bcrypt + Drizzle) vive en `./config.ts`, importado solo donde se necesita
 * `signIn`/`signOut`/el login real.
 */
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
        token.id = user.id;
        token.role = user.role;
        token.firebaseUid = user.firebaseUid;
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
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      if (token.firebaseUid) session.user.firebaseUid = token.firebaseUid;
      return session;
    },
  },
};
