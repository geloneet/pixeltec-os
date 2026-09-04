/**
 * «Sugerir con IA» del Schema por página (WO-2026-00220).
 *
 * Mismo espíritu que `tools.ts`: módulo puro — sin `db`, sin `next`, sin
 * `'use server'` — para que el prompt y, sobre todo, el saneado de la respuesta
 * del modelo se puedan probar en aislado. La server action (`actions.ts`) solo
 * pone el guard de admin, la llamada a `anthropicCreate` y la lectura del
 * ajuste; toda la lógica de qué se acepta vive aquí.
 *
 * Regla del módulo SEO: la IA PROPONE, nunca guarda. Lo que vuelve de aquí es
 * una lista de candidatos para que Miguel acepte o descarte a mano.
 */
import { z } from 'zod';
import { selectableBlogSchemaTypes } from '@/lib/blog-cms/schema-types';
import { normalizeSchemaPath, type PageSchemaMap, type SitePage } from './page-schema';
import { SEO_SITE } from './tools';

/**
 * Tipos que NUNCA se sugieren aunque estén en el catálogo: ya se emiten para
 * todo el sitio desde `OrganizationStructuredData` (layout raíz), así que
 * repetirlos por página solo duplica nodos.
 */
export const NEVER_SUGGEST_TYPES = ['Organization', 'WebSite'] as const;

/** Tope de sugerencias por página: más que esto ya no es una recomendación. */
export const MAX_SUGGESTIONS_PER_PAGE = 3;

/** Tope de caracteres del motivo que se guarda/muestra. */
export const MAX_REASON_LENGTH = 160;

export interface SuggestedType {
  type: string;
  reason: string;
}

export interface PageSuggestion {
  path: string;
  types: SuggestedType[];
}

/** Catálogo realmente ofrecible a la IA (seleccionables menos los prohibidos). */
export function suggestableSchemaTypes(): { value: string; label: string }[] {
  const banned = new Set<string>(NEVER_SUGGEST_TYPES);
  return selectableBlogSchemaTypes().filter((t) => !banned.has(t.value));
}

export const SUGGEST_SYSTEM = [
  'Eres consultor SEO técnico de una agencia mexicana. Tu trabajo es decidir qué datos estructurados (schema.org) le convienen a cada página de un sitio web.',
  '',
  'REGLAS OBLIGATORIAS:',
  '1. Sugiere entre 0 y 3 tipos por página. Cero es una respuesta correcta y frecuente: si la página no encaja claramente con ningún tipo, devuelve la lista vacía.',
  '2. Usa ÚNICAMENTE tipos del catálogo permitido que se te entrega. Cualquier tipo fuera de esa lista se descarta.',
  `3. Nunca sugieras ${NEVER_SUGGEST_TYPES.join(' ni ')}: el sitio ya los emite en todas las páginas y repetirlos solo duplica nodos.`,
  '4. Prefiere tipos que se sostienen solo con nombre y URL, que es lo único que el sistema puede emitir hoy: WebPage, Service, ItemList, ProfilePage, QAPage, LocalBusiness.',
  '5. Evita los tipos que exigen datos que no tenemos (precio, fechas, ingredientes, calificaciones, duración de video, salario…): Product, Recipe, Event, JobPosting, Review, VideoObject, Course, Dataset, Movie, SoftwareApplication, VacationRental y similares. Solo sugiérelos si la página ES exactamente eso y el dato falta apenas.',
  '6. No repitas un tipo que la página ya tiene asignado.',
  '7. El campo "reason" va en español de México, máximo 120 caracteres, explicado para un dueño de negocio SIN vocabulario técnico: qué gana él, no qué etiqueta se agrega. Nada de "markup", "entidad" ni "grafo".',
  '',
  'FORMATO DE RESPUESTA: responde SOLO con este JSON, sin texto antes ni después, sin bloques de código:',
  '{"suggestions":[{"path":"/ruta","types":[{"type":"WebPage","reason":"…"}]}]}',
  '',
  'Incluye una entrada por CADA ruta que se te pida, aunque su lista de tipos quede vacía.',
].join('\n');

/**
 * Arma el mensaje de usuario: catálogo permitido, identidad del sitio y, por
 * cada página pedida, su ruta, nombre, de qué trata y qué tipos ya tiene.
 */
export function buildSuggestPrompt(pages: SitePage[], current: PageSchemaMap): string {
  const catalog = suggestableSchemaTypes()
    .map((t) => `- ${t.value} (${t.label})`)
    .join('\n');

  const list = pages
    .map((page) => {
      const assigned = current[normalizeSchemaPath(page.path)] ?? [];
      return [
        `Ruta: ${page.path}`,
        `Nombre: ${page.label}`,
        `De qué trata: ${page.description}`,
        `Tipos ya asignados: ${assigned.length > 0 ? assigned.join(', ') : 'ninguno'}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `Sitio: ${SEO_SITE.name}`,
    `URL: ${SEO_SITE.url}`,
    '',
    'CATÁLOGO PERMITIDO (no puedes salirte de aquí):',
    catalog,
    '',
    `PÁGINAS A EVALUAR (${pages.length}):`,
    '',
    list,
  ].join('\n');
}

export const SuggestResultSchema = z.object({
  suggestions: z.array(
    z.object({
      path: z.string(),
      types: z.array(
        z.object({
          type: z.string(),
          reason: z.string(),
        }),
      ),
    }),
  ),
});

export type SuggestResult = z.infer<typeof SuggestResultSchema>;

/**
 * Sanea la respuesta del modelo hasta dejar algo que se pueda pintar sin
 * confiar en él: descarta rutas que no se pidieron, tipos fuera del catálogo,
 * los prohibidos, los que la página ya tiene, duplicados, y recorta a
 * {@link MAX_SUGGESTIONS_PER_PAGE}. Devuelve SIEMPRE una entrada por cada ruta
 * pedida, aunque sea con la lista vacía — así la UI puede decir «nada que
 * sugerir aquí» en vez de dejar la tarjeta en silencio.
 */
export function normalizeSuggestions(
  raw: unknown,
  requested: string[],
  current: PageSchemaMap,
): PageSuggestion[] {
  const wanted = Array.from(new Set(requested.map(normalizeSchemaPath)));
  const wantedSet = new Set(wanted);
  const allowed = new Set(suggestableSchemaTypes().map((t) => t.value));

  const parsed = SuggestResultSchema.safeParse(raw);
  const byPath = new Map<string, SuggestedType[]>();

  if (parsed.success) {
    for (const entry of parsed.data.suggestions) {
      const path = normalizeSchemaPath(entry.path);
      if (!wantedSet.has(path)) continue;

      const assigned = new Set(current[path] ?? []);
      const seen = new Set<string>(byPath.get(path)?.map((t) => t.type) ?? []);
      const out: SuggestedType[] = byPath.get(path) ?? [];

      for (const candidate of entry.types) {
        if (out.length >= MAX_SUGGESTIONS_PER_PAGE) break;
        const type = candidate.type.trim();
        if (!allowed.has(type)) continue;
        if (assigned.has(type)) continue;
        if (seen.has(type)) continue;
        seen.add(type);
        out.push({ type, reason: candidate.reason.trim().slice(0, MAX_REASON_LENGTH) });
      }

      byPath.set(path, out);
    }
  }

  return wanted.map((path) => ({ path, types: byPath.get(path) ?? [] }));
}
