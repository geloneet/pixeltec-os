import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

/**
 * CONTRATO — el rol del JWT no puede usarse como guard de seguridad.
 *
 * `session.user.role` se sella al autenticar y desde entonces afirma un
 * privilegio que la realidad pudo retirar: degradar, suspender o borrar a un
 * admin no le quitaba nada mientras su cookie viviera. La autorización se
 * resuelve contra Postgres (`resolveAuthority`).
 *
 * Este contrato es a nivel de fuente porque el defecto es *elegir la fuente
 * equivocada*: un test de runtime pasaría igual mientras el rol del token
 * coincida con el de la base, que es el caso feliz.
 *
 * `session.user.role` sigue permitido para PRESENTACIÓN (mostrar u ocultar un
 * menú). Lo que se prohíbe es que decida un acceso: comparaciones contra
 * "admin" y redirecciones o cortes derivados de ellas.
 */

const SRC = resolve(__dirname, "../..");

/** Archivos donde comparar el rol del token contra "admin" está justificado. */
const EXCEPCIONES = new Set([
  // Sella el rol en el token y lo refresca desde la base: es el productor.
  "lib/auth/auth.config.ts",
  // La autoridad canónica: aquí el rol viene de Postgres, no del token.
  "lib/auth/authority.ts",
  // Presentación pura: decide qué pinta el menú, no qué se permite.
  "hooks/use-user-profile.ts",
]);

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

describe("ningún guard decide autorización con el rol del JWT", () => {
  test("no hay comparaciones de session.user.role contra 'admin' fuera de las excepciones", () => {
    const ofensores: string[] = [];

    for (const file of walk(SRC)) {
      const rel = file.slice(SRC.length + 1);
      if (EXCEPCIONES.has(rel)) continue;

      const src = readFileSync(file, "utf8");
      // `session.user.role === "admin"` / `!==` / con optional chaining.
      if (/session\??\.?\.?user\??\.?\.?role\s*[!=]==\s*["']admin["']/.test(src)) {
        ofensores.push(rel);
      }
    }

    expect(
      ofensores,
      `Estos archivos autorizan con el rol del JWT en vez de resolveAuthority:\n${ofensores.join("\n")}`
    ).toEqual([]);
  });

  test("las puertas conocidas usan la autoridad canónica", () => {
    // requireAdmin es la puerta de las rutas admin.
    expect(readFileSync(resolve(SRC, "lib/auth-guards.ts"), "utf8")).toContain("resolveAuthority");
    // /usuarios rebota por rol: debe resolverlo contra la base.
    expect(readFileSync(resolve(SRC, "app/(admin)/usuarios/page.tsx"), "utf8")).toContain(
      "resolveAuthority"
    );
  });

  test("las actions de notificaciones pasan por la frontera de sesión", () => {
    // Con `auth()` a secas, una cuenta suspendida seguía leyendo y marcando.
    const actions = readFileSync(resolve(SRC, "lib/notifications/actions.ts"), "utf8");
    for (const fn of [
      "getMyNotifications",
      "markNotificationReadAction",
      "markAllNotificationsReadAction",
    ]) {
      const start = actions.indexOf(`export async function ${fn}`);
      expect(start, `${fn} no encontrada`).toBeGreaterThan(-1);
      const body = actions.slice(start, actions.indexOf("export async function", start + 1));
      expect(body, `${fn} debe usar getSessionUserId()`).toContain("getSessionUserId()");
    }
  });
});
