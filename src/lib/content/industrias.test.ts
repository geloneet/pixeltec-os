import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTIC_INDUSTRY_MAP,
  INDUSTRIES,
  getIndustry,
  getIndustryPage,
  industriesWithPage,
  industryPagePath,
} from './industrias';
import { COMPANY_TYPES } from '@/lib/diagnostic/logic';
import { DESARROLLO_WEB_CITIES, CONSULTORIA_CITIES } from './local-services';
import { LOCAL_AUTOMATION_CITIES } from './automatizacion-local';
import { KEYWORD_LANDINGS } from './keyword-landings';

/**
 * L2 (WO-2026-00345): el registro de industrias es la ÚNICA fuente de
 * `/industrias`, de las 2 páginas propias y del strip del home. Todo claim
 * sale de `03_CLIENTES/*.md` (§2 del plan); el guardarraíl de cadenas
 * prohibidas impide que vuelvan los claims que la auditoría no pudo sostener.
 */
const LANDING_SLUGS = new Set([
  ...DESARROLLO_WEB_CITIES.map((c) => c.slug),
  ...CONSULTORIA_CITIES.map((c) => c.slug),
  ...LOCAL_AUTOMATION_CITIES.map((c) => c.slug),
  ...KEYWORD_LANDINGS.map((l) => l.slug),
]);

const FORBIDDEN_CLAIMS = [
  /\bSAT\b/,
  /tracking/i,
  /Google Maps/i,
  /Mercado Pago/i,
  /Stripe/i,
  /Pasarelas? de pago/i,
  /portal del paciente/i,
  /reportes de ocupación/i,
  /\bSaaS\b/,
  /apps? móvil(es)? para conductores/i,
  // Voz comercial (Supervisor, 2026-09-14): nada de estado interno ni decisiones
  // del cliente en lo público, aunque sean hechos documentados.
  /en pausa/i,
  /por decisión del (proyecto|cliente)/i,
  /monitoreo y estabilización/i,
  /fase de seguimiento/i,
  /en diseño/i,
  /Meta Pixel|Google Ads|\bGA4\b/,
  /Decisiones técnicas empaquetadas/i,
  /técnicamente más profundo/i,
  /no un catálogo/i,
  /versión 2\.0/i,
  /checkout (dormido|se activa)|listo para activar/i,
];

describe('registro INDUSTRIES (hub)', () => {
  it('tiene 6 sectores con slugs únicos y tipo de diagnóstico del catálogo real', () => {
    expect(INDUSTRIES).toHaveLength(6);
    expect(new Set(INDUSTRIES.map((i) => i.slug)).size).toBe(6);
    const types = new Set(COMPANY_TYPES.map((c) => c.value));
    for (const industry of INDUSTRIES) {
      expect(types.has(industry.diagnosticType), `${industry.slug} → ${industry.diagnosticType}`).toBe(true);
      expect(DIAGNOSTIC_INDUSTRY_MAP[industry.slug]).toBe(industry.diagnosticType);
    }
  });

  it('cada sector tiene resumen, 4 puntos resueltos y stack no vacío', () => {
    for (const industry of INDUSTRIES) {
      expect(industry.summary.length).toBeGreaterThan(60);
      expect(industry.problems).toHaveLength(4);
      expect(industry.stack.length).toBeGreaterThanOrEqual(2);
      expect(industry.shortLabel.length).toBeGreaterThan(3);
    }
  });

  it('exactamente 2 sectores tienen página propia: clínicas dentales y hoteles', () => {
    const pages = industriesWithPage();
    expect(pages.map((i) => i.page.slug).sort()).toEqual(['clinicas-dentales', 'hoteles']);
    expect(getIndustry('salud')?.page?.slug).toBe('clinicas-dentales');
    expect(getIndustry('hoteleria')?.page?.slug).toBe('hoteles');
    expect(getIndustryPage('clinicas-dentales')?.slug).toBe('salud');
    expect(getIndustryPage('logistica')).toBeUndefined();
    expect(industryPagePath(pages[0].page)).toMatch(/^\/industrias\/[a-z-]+$/);
  });

  it('guardarraíl anti-claim: ninguna cadena prohibida en todo el registro', () => {
    const blob = JSON.stringify(INDUSTRIES);
    for (const re of FORBIDDEN_CLAIMS) expect(blob, `cadena prohibida ${re}`).not.toMatch(re);
  });
});

describe('páginas de industria', () => {
  for (const industry of industriesWithPage()) {
    const page = industry.page;
    describe(page.slug, () => {
      it('title ≤ 49 (el layout añade « | PixelTEC»), description ≤ 155, H1 ≠ title', () => {
        expect(page.metaTitle.length).toBeLessThanOrEqual(49);
        expect(page.metaDescription.length).toBeLessThanOrEqual(155);
        expect(page.h1).not.toBe(page.metaTitle);
        expect(page.intro.length).toBeGreaterThan(80);
      });

      it('caso real con fuente en 03_CLIENTES y ubicación real del cliente', () => {
        expect(page.caseStudy.source).toMatch(/^03_CLIENTES\//);
        expect(page.caseStudy.client.length).toBeGreaterThan(2);
        expect(page.caseStudy.location.length).toBeGreaterThan(4);
        expect(page.caseStudy.summary.length).toBeGreaterThanOrEqual(2);
      });

      it('FAQ de 2 a 4 preguntas con respuesta', () => {
        expect(page.faq.length).toBeGreaterThanOrEqual(2);
        expect(page.faq.length).toBeLessThanOrEqual(4);
        for (const f of page.faq) {
          expect(f.q.trim().endsWith('?')).toBe(true);
          expect(f.a.length).toBeGreaterThan(20);
        }
      });

      it('relacionados apuntan a servicios y landings que existen', () => {
        const services = new Set(['/services/ecosistemas-web', '/services/automatizacion', '/services/consultoria']);
        expect(page.relatedServices.length).toBeGreaterThanOrEqual(1);
        for (const s of page.relatedServices) expect(services.has(s.href), s.href).toBe(true);
        expect(page.relatedLandings.length).toBeGreaterThanOrEqual(1);
        for (const slug of page.relatedLandings) expect(LANDING_SLUGS.has(slug), slug).toBe(true);
      });

      it('secciones H2 con cuerpo (≥ 3) y CTA al diagnóstico del sector', () => {
        expect(page.sections.length).toBeGreaterThanOrEqual(3);
        for (const s of page.sections) {
          expect(s.title.length).toBeGreaterThan(5);
          expect(s.body.length).toBeGreaterThanOrEqual(1);
        }
        expect(page.ctaHref).toBe(`/diagnostico?industry=${industry.diagnosticType}`);
        // Singular explícito: nada de derivarlo con un replace (salía «tu hotele»).
        expect(page.ctaHeading).toMatch(/^¿Hablamos de tu [a-záéíóú ]+\?$/);
        expect(page.ctaHeading).not.toMatch(/hotele|dentale|clínicas/);
      });
    });
  }

  it('Villa Nogal se ubica en San Sebastián del Oeste, nunca «en Puerto Vallarta»', () => {
    const hoteles = getIndustryPage('hoteles')!.page;
    expect(hoteles.caseStudy.location).toMatch(/San Sebastián del Oeste/);
    expect(JSON.stringify(hoteles.caseStudy)).not.toMatch(/Villa Nogal[^.]*en Puerto Vallarta/);
  });

  it('Smile More se ubica en Guadalajara (y Guamúchil)', () => {
    const clinicas = getIndustryPage('clinicas-dentales')!.page;
    expect(clinicas.caseStudy.location).toMatch(/Guadalajara/);
  });

  it('los testimonios citados usan exactamente el nombre y el texto ya públicos en el home', () => {
    const home = readFileSync(resolve(__dirname, '..', '..', 'components', 'sections', 'testimonials.tsx'), 'utf8');
    for (const industry of industriesWithPage()) {
      const t = industry.page.caseStudy.testimonial;
      if (!t) continue;
      expect(home, `${t.author} no aparece igual en testimonials.tsx`).toContain(`name: "${t.author}"`);
      expect(home, `cita de ${t.author} distinta a la del home`).toContain(t.quote);
    }
  });
});
