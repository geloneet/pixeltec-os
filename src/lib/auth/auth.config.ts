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
    async jwt({ token, user, trigger, session }) {
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
        // C-PR3: el sid lo acuña `authorize()` (ahí están la IP y el
        // user-agent de la request); aquí solo se sella en el JWT. Si el
        // mint falló (fire-safe), el acuñado perezoso de abajo lo reintenta.
        if (user.sid) token.sid = user.sid;
        token.chk = Date.now();
        // Epoch de la CREDENCIAL, no del token. Se acuña aquí —única rama en
        // la que existe `user`, es decir, el login real— y a partir de ahí es
        // inmutable: ninguna rotación lo toca. `iat` NO sirve para esto porque
        // Auth.js lo refresca al reemitir la cookie, de modo que un corte
        // basado en `iat` no revocaría jamás.
        token.credentialIssuedAt = Math.floor(Date.now() / 1000);
      }
      // `useSession().update({ name?, image? })` desde el cliente tras editar
      // el perfil — sin esto el header mostraría nombre/foto viejos hasta el
      // siguiente login (el JWT solo se sella al iniciar sesión).
      if (trigger === "update" && session) {
        if ("image" in session) token.picture = session.image ?? null;
        if (typeof session.name === "string") token.name = session.name;
      }
      // ── C-PR3: sesiones revocables. Import dinámico a propósito: mantiene
      // este módulo estáticamente libre de DB (los tests y cualquier bundle
      // edge futuro no arrastran `postgres`; el middleware actual es runtime
      // nodejs, verificado, así que ejecutar esto ahí es válido). Todo va en
      // try/catch: un error de DB JAMÁS mata un token firmado (fail-open,
      // decisión documentada en src/lib/auth/sessions.ts). ──
      // ── Autoridad canónica ANTES de devolver el token (ADR-0036). Este es
      // el punto por el que pasa toda reemisión de cookie, así que es donde la
      // revocación tiene que morder: si se dejara solo en las fronteras de
      // servidor, `/api/auth/session` seguiría renovando una cookie de una
      // cuenta suspendida o de credenciales ya cambiadas.
      //
      // A diferencia del bloque de `sid` (fail-open por disponibilidad), una
      // DENEGACIÓN explícita mata la sesión. Un error de DB sí conserva el
      // token: las fronteras de servidor vuelven a evaluar y ahí sí fallan
      // cerrado, así que un outage no desloguea a todo el equipo. ──
      try {
        const userId = token.id;
        if (typeof userId === "string" && userId.length > 0) {
          const { resolveAuthority } = await import("./authority");
          const claim =
            typeof token.credentialIssuedAt === "number" ? token.credentialIssuedAt : undefined;
          const authority = await resolveAuthority(userId, claim);

          if (!authority.ok) {
            console.warn("[auth] sesión destruida por la autoridad canónica:", authority.reason);
            return null;
          }

          // El rol viaja refrescado desde Postgres: el sellado en el login
          // afirma un privilegio que pudo retirarse desde entonces.
          token.role = authority.role;

          // Token legacy sin claim: solo se puede inicializar si el usuario no
          // tiene corte. `resolveAuthority` ya rechazó el caso contrario, así
          // que llegar aquí con `sessionsValidFrom` implica un corte anterior
          // al claim — no se inventa una fecha que lo saltaría.
          if (claim === undefined && authority.sessionsValidFrom === null) {
            token.credentialIssuedAt = Math.floor(Date.now() / 1000);
          }
        }
      } catch (err) {
        console.error("[auth] authority check error — keeping token (fail-open):", err);
      }

      try {
        const userId = token.id;
        if (typeof userId === "string" && userId.length > 0) {
          if (!token.sid) {
            // Acuñado perezoso: tokens emitidos antes de C-PR3 (p. ej. la
            // sesión activa de Miguel) NO se invalidan — se les acuña una
            // fila al vuelo. Nota: el token mutado solo persiste cuando la
            // respuesta puede re-escribir la cookie (middleware o
            // /api/auth/session); mientras tanto puede acuñar filas extra —
            // ruido acotado y preferible a desloguear tokens legacy.
            const { mintSession } = await import("./sessions");
            const sid = await mintSession(userId);
            if (sid) {
              token.sid = sid;
              token.chk = Date.now();
            }
          } else {
            const chk = typeof token.chk === "number" ? token.chk : 0;
            if (Date.now() - chk > 60_000) {
              const { validateSession } = await import("./sessions");
              const { valid } = await validateSession(token.sid, userId);
              // Revocación real (fila ausente o revoked_at): se mata la
              // sesión. Un outage de DB nunca llega aquí — validateSession
              // es fail-open y devuelve valid:true en ese caso.
              if (!valid) return null;
              token.chk = Date.now();
            }
          }
        }
      } catch (err) {
        console.error("[auth] session-tracking error — keeping token (fail-open):", err);
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
      // C-PR3: el sid viaja en la sesión para que las server actions puedan
      // excluir la sesión ACTUAL al revocar las demás. Puede faltar en
      // tokens legacy hasta que el acuñado perezoso persista en la cookie.
      if (typeof token.sid === "string" && token.sid.length > 0) {
        session.user.sid = token.sid;
      }
      // `iat` viaja para que la autoridad canónica (src/lib/auth/authority.ts)
      // pueda descartar tokens anteriores a un cambio de credenciales. Aquí no
      // se consulta la base: este callback también corre en el middleware.
      // El claim de credencial —NO `iat`— viaja a la sesión para que las
      // fronteras de servidor puedan reevaluar el corte. `iat` se refresca en
      // cada reemisión y sería inservible como epoch.
      if (typeof token.credentialIssuedAt === "number") {
        session.user.credentialIssuedAt = token.credentialIssuedAt;
      }
      // Alias heredado: viaja solo informativamente.
      return session;
    },
  },
};
