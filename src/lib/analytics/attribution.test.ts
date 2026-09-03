import { describe, expect, test } from 'vitest';
import {
  buildFirstTouch,
  mergeLastTouch,
  parseAttributionCookie,
  referrerHost,
  serializeAttribution,
  toLeadFields,
  type TouchPoint,
} from './attribution';

const NOW = new Date('2026-09-03T12:00:00.000Z');

function touch(over: Partial<TouchPoint> = {}): TouchPoint {
  return {
    path: '/blog/uno',
    ref_host: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    ts: NOW.toISOString(),
    ...over,
  };
}

describe('referrerHost', () => {
  test('devuelve solo el host, nunca la ruta del referrer', () => {
    expect(referrerHost('https://www.google.com/search?q=algo+privado')).toBe('www.google.com');
  });

  test('un referrer del propio sitio no cuenta como origen', () => {
    expect(referrerHost('https://pixeltec.mx/blog/x', 'pixeltec.mx')).toBe('');
  });

  test('referrer vacío o no parseable → cadena vacía, sin lanzar', () => {
    expect(referrerHost('')).toBe('');
    expect(referrerHost('no-soy-una-url')).toBe('');
  });
});

describe('buildFirstTouch', () => {
  test('guarda la ruta y SOLO los tres utm', () => {
    const t = buildFirstTouch(
      'https://pixeltec.mx/blog/uno?utm_source=news&utm_medium=email&utm_campaign=sep&email=alguien@ejemplo.mx&token=abc',
      'https://www.google.com/search?q=x',
      NOW
    );
    expect(t).toEqual({
      path: '/blog/uno',
      ref_host: 'www.google.com',
      utm_source: 'news',
      utm_medium: 'email',
      utm_campaign: 'sep',
      ts: NOW.toISOString(),
    });
    // El parámetro ajeno NO viaja a ningún lado.
    expect(JSON.stringify(t)).not.toContain('alguien@ejemplo.mx');
    expect(JSON.stringify(t)).not.toContain('abc');
  });

  test('URL inválida → null en vez de lanzar', () => {
    expect(buildFirstTouch('no-soy-una-url', '', NOW)).toBeNull();
  });

  test('recorta valores absurdamente largos', () => {
    const t = buildFirstTouch(`https://pixeltec.mx/x?utm_source=${'a'.repeat(500)}`, '', NOW);
    expect(t!.utm_source.length).toBeLessThanOrEqual(120);
  });
});

describe('mergeLastTouch — el first-touch es inmutable', () => {
  const first = touch({ path: '/blog/uno', utm_source: 'google' });

  test('sin atribución previa, first y last son el mismo contacto', () => {
    const a = mergeLastTouch(null, first, true);
    expect(a.first).toEqual(first);
    expect(a.last).toEqual(first);
    expect(a.first_content_path).toBe('/blog/uno');
  });

  test('una visita posterior NUNCA reescribe el first', () => {
    const a = mergeLastTouch(null, first, true);
    const segunda = touch({ path: '/contact', utm_source: 'facebook', ts: '2026-09-10T00:00:00.000Z' });
    const b = mergeLastTouch(a, segunda, false);

    expect(b.first).toEqual(first);
    expect(b.first.utm_source).toBe('google');
    expect(b.last).toEqual(segunda);
  });

  test('first_content_path se fija UNA vez: es la primera pieza vista, no la última', () => {
    const entradaSinContenido = touch({ path: '/contact' });
    const a = mergeLastTouch(null, entradaSinContenido, false);
    expect(a.first_content_path).toBeUndefined();

    const b = mergeLastTouch(a, touch({ path: '/blog/uno' }), true);
    expect(b.first_content_path).toBe('/blog/uno');

    const c = mergeLastTouch(b, touch({ path: '/blog/dos' }), true);
    expect(c.first_content_path).toBe('/blog/uno');
  });
});

describe('parseAttributionCookie — nunca lanza', () => {
  test('ida y vuelta', () => {
    const a = mergeLastTouch(null, touch(), true);
    expect(parseAttributionCookie(serializeAttribution(a))).toEqual(a);
  });

  test('acepta la cookie URL-encoded (como llega del navegador)', () => {
    const a = mergeLastTouch(null, touch(), true);
    expect(parseAttributionCookie(encodeURIComponent(serializeAttribution(a)))).toEqual(a);
  });

  test('ausente, vacía, JSON roto o forma inesperada → null', () => {
    expect(parseAttributionCookie(null)).toBeNull();
    expect(parseAttributionCookie('')).toBeNull();
    expect(parseAttributionCookie('{no es json')).toBeNull();
    expect(parseAttributionCookie('"solo-un-string"')).toBeNull();
    expect(parseAttributionCookie('{"last":{"path":"/x","ts":"t"}}')).toBeNull();
    expect(parseAttributionCookie('{"first":{"path":"sin-barra","ts":"t"}}')).toBeNull();
  });

  test('sin `last` se usa el `first` — nunca se devuelve un last roto', () => {
    const parsed = parseAttributionCookie('{"first":{"path":"/blog/uno","ts":"t"}}');
    expect(parsed!.last).toEqual(parsed!.first);
  });

  test('sanea la ruta al leer (query string inyectado a mano)', () => {
    const parsed = parseAttributionCookie('{"first":{"path":"/blog/uno?token=secreto","ts":"t"}}');
    expect(parsed!.first.path).toBe('/blog/uno');
  });
});

describe('toLeadFields', () => {
  test('sin cookie: jsonb vacío y columnas nulas, nunca undefined', () => {
    expect(toLeadFields(null)).toEqual({ attribution: {}, landingPath: null, firstContentPath: null });
  });

  test('landing_path sale del FIRST touch, no del último', () => {
    const a = mergeLastTouch(mergeLastTouch(null, touch({ path: '/blog/uno' }), true), touch({ path: '/contact' }), false);
    const fields = toLeadFields(a);
    expect(fields.landingPath).toBe('/blog/uno');
    expect(fields.firstContentPath).toBe('/blog/uno');
  });
});
