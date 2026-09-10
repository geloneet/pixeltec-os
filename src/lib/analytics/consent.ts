/**
 * Consentimiento de seguimiento (PRV-01 / REN-04, WO-2026-00268).
 *
 * Hasta ahora el Pixel de Meta se cargaba en el primer render de cualquier
 * página pública y disparaba PageView antes de que el visitante pudiera decir
 * nada. Este módulo guarda la decisión y es la única fuente que consulta
 * `MetaPixel` para cargar (o no) `fbevents.js`.
 *
 * Se guarda en `localStorage` y no en una cookie a propósito: el dato no lo
 * necesita el servidor, y una cookie viajaría en cada petición.
 *
 * `CONSENT_VERSION` permite volver a preguntar si algún día cambia lo que se
 * rastrea: una decisión tomada sobre otra versión se trata como no tomada.
 */

export const CONSENT_STORAGE_KEY = 'pixeltec.consent';
export const CONSENT_VERSION = 1;

/** Evento propio para que la página reaccione sin recargar al aceptar. */
export const CONSENT_EVENT = 'pixeltec:consent';

export type ConsentDecision = 'granted' | 'denied';
/** `unknown` = todavía no ha decidido (o decidió sobre una versión anterior). */
export type ConsentStatus = ConsentDecision | 'unknown';

interface StoredConsent {
  status: ConsentDecision;
  v: number;
}

/**
 * Lee la decisión guardada. Nunca lanza: `localStorage` puede estar
 * bloqueado (modo privado, ajustes del navegador) y eso no puede romper la
 * página — sin dato accesible, no hay consentimiento.
 */
export function readConsent(): ConsentStatus {
  if (typeof window === 'undefined') return 'unknown';
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return 'unknown';
    const parsed = JSON.parse(raw) as Partial<StoredConsent>;
    if (parsed?.v !== CONSENT_VERSION) return 'unknown';
    return parsed.status === 'granted' || parsed.status === 'denied' ? parsed.status : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Guarda la decisión y avisa a quien esté escuchando en esta misma pestaña. */
export function writeConsent(status: ConsentDecision): void {
  if (typeof window === 'undefined') return;
  try {
    const value: StoredConsent = { status, v: CONSENT_VERSION };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sin almacenamiento la decisión no sobrevive a la recarga, pero sí debe
    // aplicarse en esta visita: el evento se emite igual.
  }
  window.dispatchEvent(new CustomEvent<ConsentStatus>(CONSENT_EVENT, { detail: status }));
}
