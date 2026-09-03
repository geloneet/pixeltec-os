/**
 * Identificador de sesión de contenido (WO-2026-00214).
 *
 * SOLO navegador. Es lo que une el rastro de `content_events` con el lead que
 * acaba naciendo de esa misma sesión.
 *
 * `sessionStorage` y no `localStorage` a propósito: la sesión es la unidad de
 * análisis y no debe sobrevivir al cierre de la pestaña. Un identificador
 * persistente empezaría a parecerse a un perfil de persona, que es exactamente
 * lo que este diseño evita.
 */

export const SESSION_STORAGE_KEY = 'pt_sid';

/** Nombre del campo oculto con el que los formularios envían la sesión. */
export const SESSION_FIELD_NAME = 'session_id';

function freshId(): string | null {
  try {
    return crypto.randomUUID();
  } catch {
    return null;
  }
}

/**
 * uuid v4 de la sesión actual, creándolo si hace falta.
 *
 * En modo privado sin storage devuelve un id efímero: se pierde el dedupe entre
 * recargas, pero contar de más una vez es mejor que perder la sesión entera.
 * Devuelve `null` sólo si el entorno no tiene `crypto.randomUUID` — en ese caso
 * el llamador omite el envío en vez de inventar un id no verificable.
 */
export function getTrackingSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (stored) return stored;
    const created = freshId();
    if (created) window.sessionStorage.setItem(SESSION_STORAGE_KEY, created);
    return created;
  } catch {
    return freshId();
  }
}
