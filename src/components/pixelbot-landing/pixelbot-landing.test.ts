import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildMetadata } from '@/lib/seo';
import nextConfig from '../../../next.config';
import { FAQ, PIXELBOT_PATH, SEO_META, buildPixelbotMessage } from './pixelbot-content';

const LANDING_DIR = path.join(process.cwd(), 'src/components/pixelbot-landing');
const PAGE_FILE = path.join(process.cwd(), 'src/app/pixelbot/page.tsx');

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
    expect(meta.title).toBe('PixelBot | Agente de IA para WhatsApp para Empresas');
    expect(meta.description).toContain('PixelTEC');
    const og = meta.openGraph as { images?: Array<{ url: string }> } | undefined;
    expect(og?.images?.[0]?.url).toBe('/og/pixelbot.png');
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
  // Frases vetadas por la claims matrix (docs/superpowers/plans/2026-08-03-pixelbot-landing.md).
  // Con \b para no matchear clases Tailwind (max-w-3xl) ni palabras contenidas.
  const FORBIDDEN: RegExp[] = [
    /socio oficial/i,
    /meta partner/i,
    /meta business partner/i,
    /palomita verde/i,
    /mensajes ilimitados/i,
    /nunca inventa/i,
    /nunca se equivoca/i,
    /cero alucinaciones/i,
    /reemplaza a tu equipo/i,
    /prueba gratis/i,
    /\bgratis\b/i,
    /omnicanal/i,
    /round-robin/i,
    /etiquetas y notas/i,
    /\b\dx\b/i,
  ];

  it('ningún archivo de la landing contiene frases prohibidas', () => {
    for (const { file, text } of landingSources()) {
      for (const phrase of FORBIDDEN) {
        expect(phrase.test(text), `"${phrase}" encontrada en ${file}`).toBe(false);
      }
    }
  });

  it('el copy no contiene porcentajes ni precios', () => {
    const content = readFileSync(path.join(LANDING_DIR, 'pixelbot-content.ts'), 'utf8');
    expect(content).not.toMatch(/\d+\s*%/);
    expect(content).not.toMatch(/\$\s*\d/);
    expect(content).not.toMatch(/\bMXN\b|\bUSD\b/);
  });

  it('las capacidades condicionales usan lenguaje condicional', () => {
    const content = readFileSync(path.join(LANDING_DIR, 'pixelbot-content.ts'), 'utf8');
    // Toda mención de agenda/CRM/ERP vive en frases "puede integrarse/conectarse/consultar".
    for (const line of content.split('\n')) {
      // Las preguntas (¿…?) no afirman nada; el claim vive en la respuesta.
      if (line.includes('¿')) continue;
      if (/\b(agenda|CRM|ERP)\b/i.test(line) && !/necesitamos|accesos|Integraciones acordadas|Se conecta/i.test(line)) {
        expect(
          /[Pp]uede (integrarse|conectarse|consultar)|cuando esa integración|forma parte del alcance|se evalúa/.test(line),
          `mención no condicional de integración: ${line.trim()}`
        ).toBe(true);
      }
    }
  });
});

describe('FAQ', () => {
  it('tiene 12 preguntas con respuesta no vacía (misma fuente que el JSON-LD)', () => {
    expect(FAQ.items).toHaveLength(12);
    for (const item of FAQ.items) {
      expect(item.q.length).toBeGreaterThan(10);
      expect(item.a.length).toBeGreaterThan(30);
    }
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
});
