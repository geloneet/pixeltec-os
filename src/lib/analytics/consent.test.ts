/**
 * @vitest-environment jsdom
 *
 * PRV-01 (WO-2026-00268). Este módulo decide si el sitio carga o no el Pixel
 * de Meta, así que su modo de fallo por defecto tiene que ser «no rastrear»:
 * cualquier duda —sin dato, dato corrupto, versión vieja, almacenamiento
 * bloqueado— debe resolverse como `unknown`, nunca como `granted`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CONSENT_EVENT,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
  readConsent,
  writeConsent,
} from './consent';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('consentimiento de seguimiento', () => {
  it('sin decisión guardada devuelve unknown', () => {
    expect(readConsent()).toBe('unknown');
  });

  it('guarda y relee las dos decisiones', () => {
    writeConsent('granted');
    expect(readConsent()).toBe('granted');
    writeConsent('denied');
    expect(readConsent()).toBe('denied');
  });

  it('una decisión de una versión anterior se trata como no tomada', () => {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ status: 'granted', v: CONSENT_VERSION - 1 })
    );
    expect(readConsent()).toBe('unknown');
  });

  it('ante un valor corrupto o inesperado no lanza y devuelve unknown', () => {
    for (const raw of ['{roto', 'null', '"granted"', '[]', JSON.stringify({ v: CONSENT_VERSION })]) {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, raw);
      expect(readConsent(), raw).toBe('unknown');
    }
  });

  it('si localStorage está bloqueado, lee unknown sin lanzar', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readConsent()).not.toThrow();
    expect(readConsent()).toBe('unknown');
  });

  it('si no puede escribir, la decisión igual se anuncia en esta visita', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const escuchado = vi.fn();
    window.addEventListener(CONSENT_EVENT, escuchado);
    expect(() => writeConsent('granted')).not.toThrow();
    expect(escuchado).toHaveBeenCalledTimes(1);
    window.removeEventListener(CONSENT_EVENT, escuchado);
  });

  it('emite el evento con la decisión para que la página reaccione sin recargar', () => {
    const escuchado = vi.fn();
    window.addEventListener(CONSENT_EVENT, escuchado);
    writeConsent('denied');
    expect(escuchado).toHaveBeenCalledTimes(1);
    expect((escuchado.mock.calls[0][0] as CustomEvent).detail).toBe('denied');
    window.removeEventListener(CONSENT_EVENT, escuchado);
  });
});
