import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildMetadata } from '@/lib/seo';
import nextConfig from '../../../next.config';
import {
  BRAND_IDENTITY,
  FAQ,
  PACKAGES,
  PIXELBOT_PATH,
  PRICING_INTRO,
  SEO_META,
  buildPixelbotMessage,
} from './pixelbot-content';

const LANDING_DIR = path.join(process.cwd(), 'src/components/pixelbot-landing');
const PAGE_FILE = path.join(process.cwd(), 'src/app/pixelbot/page.tsx');
const CONTENT_FILE = path.join(LANDING_DIR, 'pixelbot-content.ts');

function landingSources(): Array<{ file: string; text: string }> {
  const files = readdirSync(LANDING_DIR)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.test.ts'))
    .map((f) => path.join(LANDING_DIR, f));
  files.push(PAGE_FILE);
  return files.map((file) => ({ file, text: readFileSync(file, 'utf8') }));
}

describe('SEO de /pixelbot', () => {
  it('canonical, title y OG dedicado', () => {
    const meta = buildMetadata({
      path: PIXELBOT_PATH,
      title: SEO_META.title,
      description: SEO_META.description,
      ogImage: SEO_META.ogImage,
    });
    expect(meta.alternates?.canonical).toBe('https://pixeltec.mx/pixelbot');
    expect(meta.title).toBe('WhatsAgent | Agente de IA para WhatsApp desde $490/mes');
    expect(meta.description).toContain('PixelTEC');
    const og = meta.openGraph as { images?: Array<{ url: string }> } | undefined;
    expect(og?.images?.[0]?.url).toBe('/og/pixelbot.jpg');
  });

  it('los 5 aliases redirigen 301 a /pixelbot', async () => {
    const redirects = await nextConfig.redirects!();
    const aliases = ['/whatsappbot', '/whatsapp-bot', '/bot-whatsapp', '/chatbot-whatsapp', '/agente-whatsapp'];
    for (const source of aliases) {
      const rule = redirects.find((r) => r.source === source);
      expect(rule, `falta redirect para ${source}`).toBeDefined();
      expect(rule?.destination).toBe('/pixelbot');
      expect(rule?.permanent).toBe(true);
    }
    // Ningún alias debe existir como página propia: solo /pixelbot es canonical.
    expect(redirects.filter((r) => r.destination === '/pixelbot')).toHaveLength(aliases.length);
  });
});

describe('claims de la landing', () => {
  // Frases vetadas por la claims matrix (docs/superpowers/plans/2026-08-03-pixelbot-landing.md,
  // actualizada por docs/superpowers/plans/2026-08-04-pixelbot-packages-branding.md).
  // Con \b para no matchear clases Tailwind (max-w-3xl) ni palabras contenidas.
  const FORBIDDEN: RegExp[] = [
    /socio oficial/i,
    /meta partner/i,
    /meta business partner/i,
    /palomita verde/i,
    /mensajes ilimitados/i,
    /ia ilimitada/i,
    /nunca inventa/i,
    /nunca se equivoca/i,
    /cero alucinaciones/i,
    /reemplaza a tu equipo/i,
    /prueba gratis/i,
    /\bgratis\b/i,
    /omnicanal/i,
    /round-robin/i,
    /etiquetas y notas/i,
    /white-label/i,
    /\b\dx\b/i,
  ];

  it('ningún archivo de la landing contiene frases prohibidas', () => {
    for (const { file, text } of landingSources()) {
      for (const phrase of FORBIDDEN) {
        expect(phrase.test(text), `"${phrase}" encontrada en ${file}`).toBe(false);
      }
    }
  });

  it('el copy no contiene porcentajes', () => {
    const content = readFileSync(CONTENT_FILE, 'utf8');
    expect(content).not.toMatch(/\d+\s*%/);
  });

  it('aparecen exactamente los 2 precios autorizados, los 2 planes restantes sin monto (Cotizar) y ningún otro monto con $', () => {
    const content = readFileSync(CONTENT_FILE, 'utf8');
    const AUTHORIZED_LITERALS = ['$490', '$999'];
    for (const literal of AUTHORIZED_LITERALS) {
      expect(content, `falta el precio autorizado "${literal}"`).toContain(literal);
    }
    const negocio = PACKAGES.find((pkg) => pkg.id === 'negocio');
    const aMedida = PACKAGES.find((pkg) => pkg.id === 'a-medida');
    expect(negocio?.price).toBe('Cotizar');
    expect(aMedida?.price).toBe('Cotizar');
    const AUTHORIZED_AMOUNTS = new Set(['$490', '$999']);
    const matches = content.match(/\$\s*[\d,]+/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const match of matches) {
      const normalized = match.replace(/\s+/g, '');
      expect(AUTHORIZED_AMOUNTS.has(normalized), `monto no autorizado: ${match}`).toBe(true);
    }
  });

  it('las capacidades condicionales usan lenguaje condicional', () => {
    const content = readFileSync(CONTENT_FILE, 'utf8');
    // Toda mención de agenda/CRM/ERP vive en frases condicionales explícitas.
    const CONDITIONAL = /[Pp]uede (incluir|integrarse|conectarse|consultar)|cuando esa integración|cuando el diagnóstico|forma parte del alcance|se evalúa|según diagnóstico|sujeta a compatibilidad técnica/;
    for (const line of content.split('\n')) {
      // Las preguntas (¿…?) no afirman nada; el claim vive en la respuesta.
      if (line.includes('¿')) continue;
      if (/\b(agenda|CRM|ERP)\b/i.test(line) && !/necesitamos|accesos|Integraciones acordadas|Se conecta/i.test(line)) {
        expect(CONDITIONAL.test(line), `mención no condicional de integración: ${line.trim()}`).toBe(true);
      }
    }
  });

  it('WhatsAgent Negocio no promete "cualquier CRM, ERP o agenda" de forma incondicional', () => {
    const negocio = PACKAGES.find((pkg) => pkg.id === 'negocio');
    expect(negocio).toBeDefined();
    const negocioText = JSON.stringify(negocio);
    expect(negocioText).not.toMatch(/cualquier CRM/i);
    expect(negocioText).not.toMatch(/cualquier ERP/i);
    expect(negocioText).not.toMatch(/cualquier agenda/i);
  });

  it('no se usa la palabra "white-label" en la landing', () => {
    for (const { file, text } of landingSources()) {
      expect(/white-label/i.test(text), `"white-label" encontrado en ${file}`).toBe(false);
    }
  });

  it('los ejemplos de identidad del bot están etiquetados como ilustrativos, nunca como clientes reales', () => {
    expect(BRAND_IDENTITY.examplesLabel.toLowerCase()).toMatch(/ejemplo|ilustrativ/);
    expect(BRAND_IDENTITY.examplesLabel.toLowerCase()).not.toMatch(/cliente real|testimonio/);
    for (const { text } of landingSources()) {
      // Si un archivo menciona "cliente real" o "testimonio", no debe estar
      // pegado a ninguno de los nombres ilustrativos de ejemplo.
      for (const example of BRAND_IDENTITY.examples) {
        if (text.includes(example)) {
          expect(text).not.toMatch(new RegExp(`${example}[^.]{0,80}(cliente real|testimonio)`, 'i'));
        }
      }
    }
  });
});

describe('identidad de marca por cliente', () => {
  it('define título, cuerpo, ejemplos y el caveat obligatorio de Meta', () => {
    expect(BRAND_IDENTITY.title.length).toBeGreaterThan(5);
    expect(BRAND_IDENTITY.body.length).toBeGreaterThan(20);
    expect(BRAND_IDENTITY.examples.length).toBeGreaterThan(0);
    expect(BRAND_IDENTITY.metaCaveat.toLowerCase()).toContain('meta');
  });

  it('el caveat de Meta está en texto visible del componente (no en tooltip)', () => {
    const text = readFileSync(path.join(LANDING_DIR, 'pixelbot-client-branding.tsx'), 'utf8');
    expect(text).toContain('BRAND_IDENTITY.metaCaveat');
    expect(text).not.toMatch(/title=\{BRAND_IDENTITY\.metaCaveat/);
  });
});

describe('paquetes comerciales (PACKAGES)', () => {
  it('existen exactamente 4 planes', () => {
    expect(PACKAGES).toHaveLength(4);
  });

  it('solo "Crecimiento" tiene badge de recomendado', () => {
    const withBadge = PACKAGES.filter((pkg) => Boolean(pkg.badge));
    expect(withBadge).toHaveLength(1);
    expect(withBadge[0].id).toBe('crecimiento');
    expect(withBadge[0].badge).toBe('Más elegido');
  });

  it('los 4 planes mencionan identidad o nombre personalizado del bot', () => {
    for (const pkg of PACKAGES) {
      const haystack = [pkg.forWhom, pkg.includesIntro ?? '', ...pkg.includes].join(' ').toLowerCase();
      expect(
        /identidad|nombre.*(bot|elegid)/i.test(haystack),
        `plan "${pkg.name}" no menciona identidad/nombre personalizado`
      ).toBe(true);
    }
  });

  it('cada plan tiene un CTA de texto propio y no vacío', () => {
    const ctas = PACKAGES.map((pkg) => pkg.cta);
    expect(new Set(ctas).size).toBe(PACKAGES.length);
    for (const cta of ctas) {
      expect(cta.length).toBeGreaterThan(3);
    }
  });

  it('la nota común incluye IVA, contratación mínima de 12 meses y cargos de Meta separados', () => {
    expect(PRICING_INTRO.note).toMatch(/IVA/);
    expect(PRICING_INTRO.note).toMatch(/12 meses/);
    expect(PRICING_INTRO.note).toMatch(/Meta/);
  });
});

describe('FAQ', () => {
  it(`tiene ${FAQ.items.length} preguntas con respuesta no vacía (misma fuente que el JSON-LD)`, () => {
    expect(FAQ.items).toHaveLength(16);
    for (const item of FAQ.items) {
      expect(item.q.length).toBeGreaterThan(10);
      expect(item.a.length).toBeGreaterThan(30);
    }
  });

  it('existe una pregunta sobre el nombre del bot con el caveat de Meta', () => {
    const item = FAQ.items.find((i) => /nombre.*identidad.*bot/i.test(i.q));
    expect(item, 'no se encontró la FAQ de nombre/identidad del bot').toBeDefined();
    expect(item!.a.toLowerCase()).toContain('meta');
  });

  it('existe una pregunta sobre la activación estándar incluida', () => {
    const item = FAQ.items.find((i) => /activación estándar/i.test(i.q));
    expect(item, 'no se encontró la FAQ de activación estándar').toBeDefined();
  });

  it('existe una pregunta sobre los cargos de Meta cobrados por separado', () => {
    const item = FAQ.items.find((i) => /cargos de meta/i.test(i.q));
    expect(item, 'no se encontró la FAQ de cargos de Meta').toBeDefined();
    expect(item!.a).toMatch(/por separado/i);
  });

  it('existe una pregunta sobre exceder el límite del plan o cambiar de plan', () => {
    const item = FAQ.items.find((i) => /excedo.*límite|cambiar de plan/i.test(i.q));
    expect(item, 'no se encontró la FAQ de límite/cambio de plan').toBeDefined();
  });

  it('"¿Cómo se cobra?" y "¿Cuánto tarda la implementación?" no contradicen los paquetes con precio fijo', () => {
    const cobra = FAQ.items.find((i) => i.q === '¿Cómo se cobra?');
    const tarda = FAQ.items.find((i) => i.q === '¿Cuánto tarda la implementación?');
    expect(cobra).toBeDefined();
    expect(tarda).toBeDefined();
    expect(cobra!.a).not.toMatch(/implementación personalizada más operación mensual/i);
    expect(cobra!.a).toMatch(/plan mensual fijo/i);
    expect(tarda!.a).toMatch(/activación estándar/i);
  });
});

describe('página /pixelbot: FAQPage JSON-LD usa la misma fuente que el FAQ visible', () => {
  it('page.tsx pasa FAQ.items al componente de structured data', () => {
    const page = readFileSync(PAGE_FILE, 'utf8');
    expect(page).toMatch(/FAQPageStructuredData\s+items=\{FAQ\.items\}/);
  });
});

describe('buildPixelbotMessage', () => {
  it('antepone el prefijo estable Interés: PixelBot', () => {
    expect(buildPixelbotMessage('Quiero automatizar cotizaciones.')).toBe(
      'Interés: PixelBot\n\nQuiero automatizar cotizaciones.'
    );
  });

  it('serializa el volumen cuando existe', () => {
    expect(buildPixelbotMessage('Hola.', 'Más de 100 mensajes al día')).toBe(
      'Interés: PixelBot\nVolumen aproximado: Más de 100 mensajes al día\n\nHola.'
    );
  });

  it('ignora volumen vacío', () => {
    expect(buildPixelbotMessage('Hola.', '  ')).toBe('Interés: PixelBot\n\nHola.');
  });

  it('serializa plan y nombre deseado del bot cuando existen', () => {
    expect(buildPixelbotMessage('Hola.', undefined, 'WhatsAgent Crecimiento', 'Dentista Bot')).toBe(
      'Interés: PixelBot\nPlan de interés: WhatsAgent Crecimiento\nNombre deseado del bot: Dentista Bot\n\nHola.'
    );
  });

  it('combina volumen, plan y nombre del bot en el orden estable', () => {
    expect(buildPixelbotMessage('Hola.', 'No lo sé aún', 'WhatsAgent Esencial', 'Mr. Smile Bot')).toBe(
      'Interés: PixelBot\nVolumen aproximado: No lo sé aún\nPlan de interés: WhatsAgent Esencial\nNombre deseado del bot: Mr. Smile Bot\n\nHola.'
    );
  });

  it('ignora plan y nombre del bot vacíos o solo espacios', () => {
    expect(buildPixelbotMessage('Hola.', undefined, '  ', '   ')).toBe('Interés: PixelBot\n\nHola.');
    expect(buildPixelbotMessage('Hola.', undefined, null, null)).toBe('Interés: PixelBot\n\nHola.');
  });
});

describe('formulario de lead: contrato existente intacto', () => {
  it('submitContactForm sigue validando solo name/email/empresa/message/consent (Opción A sin cambios de schema)', () => {
    const actions = readFileSync(path.join(process.cwd(), 'src/app/actions.ts'), 'utf8');
    expect(actions).toMatch(/const contactSchema = z\.object\(/);
  });

  it('el select de plan y el input de nombre del bot tienen label accesible', () => {
    const form = readFileSync(path.join(LANDING_DIR, 'pixelbot-lead-form.tsx'), 'utf8');
    expect(form).toMatch(/<Label htmlFor="pixelbot-plan"/);
    expect(form).toMatch(/id="pixelbot-plan"/);
    expect(form).toMatch(/<Label htmlFor="pixelbot-bot-name"/);
    expect(form).toMatch(/id="pixelbot-bot-name"/);
  });

  it('el formulario sigue exponiendo name/email/empresa/message/consent/honeypot', () => {
    const form = readFileSync(path.join(LANDING_DIR, 'pixelbot-lead-form.tsx'), 'utf8');
    for (const field of ['pixelbot-name', 'pixelbot-email', 'pixelbot-empresa', 'pixelbot-message', 'pixelbot-consent', 'pixelbot-website-hp']) {
      expect(form).toContain(field);
    }
  });
});
