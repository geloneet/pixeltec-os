/**
 * Función de un contenido dentro del embudo (WO-2026-00214).
 *
 * NO es un campo nuevo que alguien tenga que llenar: se DERIVA de
 * `seo.searchIntent`, que ya existe en el jsonb de `blog_posts` y ya se captura
 * en el editor del blog. Pedirle al equipo editorial un segundo campo que dice
 * casi lo mismo garantiza que uno de los dos quede desactualizado.
 *
 * Diseño: docs/superpowers/specs/2026-09-03-seo-contenido-design.md
 */

import type { SearchIntent } from "@/lib/blog/types";
import type { KeywordLanding } from "@/lib/content/keyword-landings";

export const CONTENT_ROLES = ["awareness", "consideration", "commercial"] as const;
export type ContentRole = (typeof CONTENT_ROLES)[number];

export const CONTENT_ROLE_LABELS: Record<ContentRole, string> = {
  awareness: "Descubrimiento",
  consideration: "Consideración",
  commercial: "Comercial",
};

/**
 * Mapa intención de búsqueda → función en el embudo.
 *
 * `navigational` cae en `awareness` a propósito: quien busca la marca ya nos
 * conoce, así que ese contenido no compite por demanda nueva y medirlo como
 * comercial inflaría la conversión atribuida al contenido.
 */
const INTENT_TO_ROLE: Record<SearchIntent, ContentRole> = {
  informational: "awareness",
  "commercial-investigation": "consideration",
  transactional: "commercial",
  navigational: "awareness",
};

/**
 * Default cuando no hay intención declarada. Conservador a propósito: un
 * contenido sin intención no se presume comercial — presumirlo haría que el
 * embudo atribuyera conversiones a piezas que nadie clasificó.
 */
export const DEFAULT_CONTENT_ROLE: ContentRole = "awareness";

function isContentRole(value: unknown): value is ContentRole {
  return typeof value === "string" && (CONTENT_ROLES as readonly string[]).includes(value);
}

/** Forma mínima que necesita `contentRole` — no exige el `BlogPostDoc` completo. */
export interface ClassifiableSeo {
  searchIntent?: SearchIntent | "" | null;
  /** Override manual opcional (jsonb aditivo, sin migración). */
  contentRole?: string | null;
}

export interface ClassifiablePost {
  seo?: ClassifiableSeo | null;
}

/**
 * Función de un artículo del blog. El override explícito gana sobre la
 * derivación — existe para el caso raro en que la intención de búsqueda y la
 * función real en el embudo no coinciden (una guía informativa escrita
 * expresamente para cerrar ventas, por ejemplo).
 */
export function contentRole(post: ClassifiablePost | null | undefined): ContentRole {
  const seo = post?.seo;
  if (isContentRole(seo?.contentRole)) return seo.contentRole;

  const intent = seo?.searchIntent;
  if (intent && intent in INTENT_TO_ROLE) return INTENT_TO_ROLE[intent as SearchIntent];
  return DEFAULT_CONTENT_ROLE;
}

/**
 * Función de una landing de keyword. Las landings no tienen `searchIntent`, así
 * que se clasifican por su CTA: la que manda al diagnóstico está educando a
 * alguien que todavía compara; la que manda a contacto asume decisión tomada.
 */
export function landingRole(landing: Pick<KeywordLanding, "ctaHref">): ContentRole {
  return landing.ctaHref === "/contact" ? "commercial" : "consideration";
}
