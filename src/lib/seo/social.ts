/**
 * Redes sociales del sitio (WO-2026-00095) — paridad con `/seo/redes` de
 * Muebles Encino (`src/lib/social-links.ts`).
 *
 * Los enlaces activos se usan como `sameAs` en los datos estructurados del
 * negocio. Se guardan en `app_settings` como JSON.
 *
 * Módulo puro: sin `db`, sin `next`.
 */

export const SETTING_SOCIAL_LINKS = 'seo_social_links';

export interface SocialLink {
  label: string;
  href: string;
  enabled: boolean;
}

/** Redes contempladas, en el orden en que se muestran. */
export const SOCIAL_NETWORKS = ['Facebook', 'Instagram', 'LinkedIn', 'X', 'YouTube', 'TikTok', 'WhatsApp'] as const;

export const DEFAULT_SOCIAL_LINKS: SocialLink[] = SOCIAL_NETWORKS.map((label) => ({
  label,
  href: '',
  enabled: false,
}));

/** Solo se aceptan enlaces http(s); cualquier otro esquema se descarta. */
export function isValidSocialHref(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Lee lo guardado y lo completa con las redes del catálogo que falten. */
export function parseSocialLinks(raw: string | null | undefined): SocialLink[] {
  let stored: SocialLink[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        stored = parsed
          .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
          .map((l) => ({
            label: typeof l.label === 'string' ? l.label : '',
            href: typeof l.href === 'string' ? l.href.trim() : '',
            enabled: l.enabled === true,
          }))
          .filter((l) => l.label);
      }
    } catch {
      stored = [];
    }
  }
  const byLabel = new Map(stored.map((l) => [l.label, l]));
  return DEFAULT_SOCIAL_LINKS.map((d) => byLabel.get(d.label) ?? d);
}

/** Normaliza para guardar: apaga lo que no tenga URL válida. */
export function serializeSocialLinks(links: SocialLink[]): string {
  const clean = parseSocialLinks(JSON.stringify(links)).map((l) => ({
    ...l,
    enabled: l.enabled && isValidSocialHref(l.href),
  }));
  return JSON.stringify(clean);
}

/** Enlaces publicables — los que alimentan `sameAs` y el pie del sitio. */
export function visibleSocialLinks(links: SocialLink[]): SocialLink[] {
  return links.filter((l) => l.enabled && isValidSocialHref(l.href));
}
