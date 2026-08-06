import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authConfig } from "./auth.config";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isEmailLocked, recordAuthFailure, clearAuthFailures } from "@/lib/auth-brute-force";
import { recordSecurityEvent } from "@/lib/security/events";
import { mintSession } from "@/lib/auth/sessions";
import { enforceMfaGate } from "@/lib/mfa/login-gate";

/**
 * C-PR4: cuenta con 2FA activa y credenciales password válidas pero SIN el
 * segundo factor. Subclase de `CredentialsSignin`: @auth/core la deja pasar
 * intacta (`if (e instanceof AuthError) throw e`) y serializa su `code` en
 * el redirect (`?error=CredentialsSignin&code=MFA_REQUIRED`); el cliente lo
 * recibe en `SignInResponse.code` con `signIn(..., { redirect: false })` —
 * el login UI lo usa para revelar el campo del código.
 */
class MfaRequiredError extends CredentialsSignin {
  code = "MFA_REQUIRED";
}

function getClientIp(request?: Request): string {
  return (
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request?.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Config completa (con el provider real) — reemplaza Firebase Auth como
 * mecanismo de login. Patrón idéntico a `dalk/src/lib/auth/config.ts`, pero
 * preservando las protecciones que tenía el viejo endpoint
 * `/api/auth/session` (ya eliminado): rate-limit por IP y lockout por email
 * con backoff — sin esto, el login quedaría abierto a fuerza bruta sin
 * límite, una regresión real frente a lo que había antes de la migración.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
        // C-PR4: segundo factor opcional — TOTP de 6 dígitos o código de
        // recuperación. Solo se exige si la cuenta tiene 2FA activa.
        totp: { label: "Código de verificación", type: "text" },
      },
      async authorize(credentials, request) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const normalizedEmail = email.trim().toLowerCase();
        const ip = getClientIp(request);

        const rl = await enforceRateLimit({
          bucket: "auth_session",
          ip,
          max: 10,
          windowMs: 60 * 60 * 1000,
        });
        if (!rl.allowed) return null;

        const lockout = await isEmailLocked(normalizedEmail);
        if (lockout.locked) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, normalizedEmail))
          .limit(1);

        if (!user) {
          await recordAuthFailure(normalizedEmail);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          await recordAuthFailure(normalizedEmail);
          // Auditoría (C-PR2) — fire-safe: solo cuando el usuario existe y
          // falló la contraseña; jamás altera la respuesta del login.
          try {
            await recordSecurityEvent({
              userId: user.id,
              type: "login_failed",
              ip,
              userAgent: request?.headers.get("user-agent") ?? undefined,
            });
          } catch (err) {
            console.error("[auth] login_failed event error — ignoring:", err);
          }
          return null;
        }

        // ── C-PR4: puerta MFA — corre DESPUÉS de validar la contraseña y
        // ANTES de limpiar fallos/acuñar sesión. "required" lanza
        // MfaRequiredError (el code viaja al cliente); "failed" cuenta como
        // fallo de autenticación (lockout + auditoría con metadata.mfa). ──
        const userAgent = request?.headers.get("user-agent") ?? undefined;
        const mfaVerdict = await enforceMfaGate(
          user.id,
          credentials?.totp as string | undefined,
          { ip, userAgent }
        );
        if (mfaVerdict === "required") throw new MfaRequiredError();
        if (mfaVerdict === "failed") {
          await recordAuthFailure(normalizedEmail);
          try {
            await recordSecurityEvent({
              userId: user.id,
              type: "login_failed",
              ip,
              userAgent,
              metadata: { mfa: true },
            });
          } catch (err) {
            console.error("[auth] login_failed(mfa) event error — ignoring:", err);
          }
          return null;
        }

        await clearAuthFailures(normalizedEmail);

        // Rastro de último acceso + auditoría (C-PR2) — fire-safe: un fallo
        // de estas escrituras JAMÁS impide el login.
        try {
          await db
            .update(users)
            .set({ lastLoginAt: new Date(), lastLoginIp: ip })
            .where(eq(users.id, user.id));
          await recordSecurityEvent({
            userId: user.id,
            type: "login_success",
            ip,
            userAgent: request?.headers.get("user-agent") ?? undefined,
          });
        } catch (err) {
          console.error("[auth] last-login/login_success write error — ignoring:", err);
        }

        // C-PR3: acuña la fila de sesión AQUÍ (única capa con acceso a la IP
        // y el user-agent de la request). `mintSession` es fire-safe: si la
        // tabla no existe aún (0032 sin aplicar) devuelve null y el login
        // sigue — el callback `jwt` reintenta con acuñado perezoso.
        const sid = await mintSession(
          user.id,
          ip,
          request?.headers.get("user-agent") ?? undefined
        );

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? null,
          role: user.role,
          sid,
        };
      },
    }),
  ],
});
