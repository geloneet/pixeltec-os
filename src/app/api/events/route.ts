import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogPosts, contentEvents } from '@/lib/db/schema';
import { SLUG_RE } from '@/lib/blog/publication-gate';
import { ClientEventPayloadSchema, normalizeClientMeta } from '@/lib/analytics/events';
import { blogSlugFromPath, isContentPath, normalizeContentPath, SITE_ID } from '@/lib/seo-insights/config';
import { enforceRateLimit } from '@/lib/rate-limit';
import { hashIp } from '@/lib/privacy';

/**
 * Beacon público de comportamiento de contenido (WO-2026-00214).
 *
 * Hermano de `/api/blog/view`, no su reemplazo: aquél mantiene el contador
 * agregado por artículo (`blog_post_view_counts`) y este guarda el rastro de
 * comportamiento por sesión (`content_events`). Dos usos distintos del mismo
 * hecho; ninguno cubre al otro.
 *
 * Privacidad — lo que este endpoint NUNCA persiste:
 *   · la IP cruda (solo `hashIp()`, y solo para poder frenar abuso),
 *   · el query string del path (se recorta antes de guardar),
 *   · nada del contenido de formularios ni del usuario.
 * `session_id` es un uuid v4 de `sessionStorage`: muere al cerrar la pestaña y
 * no identifica a una persona.
 *
 * Fail-silent igual que el beacon de vistas: un fallo de base de datos jamás
 * puede romper la navegación del visitante. Solo un cuerpo inválido responde
 * 400 — y ese 400 es información útil para nosotros, no para un atacante:
 * nunca dice si un slug existe.
 */

/** Generoso a propósito: una lectura completa emite ~6 eventos legítimos. */
const EVENTS_RATE_LIMIT = { max: 120, windowMs: 10 * 60 * 1000 } as const;

function callerIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = ClientEventPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const payload = parsed.data;

  // Segunda pasada sobre el path: el schema ya rechazó query strings, pero la
  // normalización canónica (barra final, origen) decide bajo qué clave se
  // agrupa el contenido. Dos formas del mismo artículo contando por separado
  // es un dato roto que nadie nota.
  const path = normalizeContentPath(payload.path);
  if (path === '' || !isContentPath(path)) {
    // No es una pieza de contenido que este módulo mida. Se responde ok para
    // no convertir el endpoint en un oráculo de qué rutas existen.
    return NextResponse.json({ ok: true });
  }

  const ip = callerIp(req);

  try {
    // Dentro del try a propósito: `enforceRateLimit` y `hashIp` lanzan si falta
    // `INTERNAL_IP_SALT`, y un beacon fail-silent no puede responder 500 por un
    // problema de configuración nuestro — el visitante no tiene nada que ver.
    const rl = await enforceRateLimit({
      ip,
      bucket: 'events',
      max: EVENTS_RATE_LIMIT.max,
      windowMs: EVENTS_RATE_LIMIT.windowMs,
    });
    if (!rl.allowed) {
      // 200 y no 429: el visitante no debe enterarse de que su ruido se
      // descarta, y el tracker no tiene nada que reintentar.
      return NextResponse.json({ ok: true });
    }

    // `post_id` solo para artículos PUBLICADOS. Un borrador o un slug
    // inexistente entran igual como evento (con `post_id` nulo): perder el
    // hecho por no poder resolver la FK sería peor que guardarlo suelto.
    let postId: string | null = null;
    const slug = blogSlugFromPath(path);
    if (slug && slug.length <= 120 && SLUG_RE.test(slug)) {
      const [row] = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, 'published')))
        .limit(1);
      postId = row?.id ?? null;
    }

    // Sin `target`: el índice de dedupe (`content_events_milestone_idx`,
    // migración 0051) es PARCIAL y con una expresión. Postgres rechaza en
    // runtime (42P10) un `onConflictDoNothing({ target: [...] })` contra un
    // índice parcial porque no puede inferir el árbitro — mismo tropiezo ya
    // documentado en el cron de recurrentes (migración 0048). La forma sin
    // `target` sí funciona: DO NOTHING ante cualquier violación.
    await db
      .insert(contentEvents)
      .values({
        siteId: SITE_ID,
        sessionId: payload.sessionId,
        path,
        postId,
        event: payload.event,
        meta: normalizeClientMeta(payload),
        ipHash: hashIp(ip),
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error('[api/events] insert failed:', err);
  }

  return NextResponse.json({ ok: true });
}
