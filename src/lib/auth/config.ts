import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authConfig } from "./auth.config";
import { enforceRateLimit } from "@/lib/rate-limit";
import { isEmailLocked, recordAuthFailure, clearAuthFailures } from "@/lib/auth-brute-force";

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
          return null;
        }

        await clearAuthFailures(normalizedEmail);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? null,
          role: user.role,
          firebaseUid: user.firebaseUid ?? undefined,
        };
      },
    }),
  ],
});
