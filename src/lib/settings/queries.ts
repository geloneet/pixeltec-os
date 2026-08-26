import 'server-only';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { appSettings } from '@/lib/db/schema';

/**
 * Ajustes dinámicos del panel (WO-2026-00095) — respaldo en `app_settings`.
 *
 * Paridad con `settings` de Muebles Encino: clave/valor de texto con campos de
 * auditoría. Toda escritura pasa por aquí; nadie importa Drizzle para tocar
 * ajustes desde una página o una acción.
 *
 * NO valida permisos: eso es responsabilidad de quien llama (las acciones del
 * módulo SEO exigen rol admin antes de escribir).
 */

/** Lee un ajuste; `null` si no existe. Proyección explícita. */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

/** Lee varios ajustes de una vez; las claves ausentes no aparecen en el mapa. */
export async function getSettings(keys: readonly string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, [...keys]));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** Escribe (upsert) un ajuste. `actorId` alimenta los campos de auditoría. */
export async function setSetting(key: string, value: string, actorId: string | null): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value, createdBy: actorId, updatedBy: actorId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date(), updatedBy: actorId },
    });
}

/** Lee un ajuste booleano («1» = encendido). Ausente ⇒ `fallback`. */
export async function getFlag(key: string, fallback = false): Promise<boolean> {
  const raw = await getSetting(key);
  return raw === null ? fallback : raw === '1';
}
