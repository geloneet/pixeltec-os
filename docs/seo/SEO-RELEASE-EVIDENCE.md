# Evidencia de release — SEO integral (feat/seo-integral-pixeltec)

Se completa en G3 (QA) y G4 (deploy). Estado: EN CURSO.

## Commits del incremento (G2)

Ver `git log a1e948c..feat/seo-integral-pixeltec --oneline`. Resumen:
fundaciones (site-config, robots derivado, noindex privadas, JSON-LD único,
breadcrumbs, icons) · modelo editorial (+migración 0026 NO aplicada) · gate de
publicación + rol + slugs/redirects · artículo público (nav/TOC/fuentes/
related) · prompt IA v2 · perf quick wins (imágenes, marquee sin framer) ·
brief estratégico y editor con readiness (UI) · docs/seo.

## Gates locales (G2) — evidencia al cierre de cada commit

- typecheck: 0 errores fuera de scripts/qa-runner (43 preexistentes).
- vitest: suite completa en verde tras cada commit (baseline worktree 2176 →
  crece con los tests nuevos del gate).

## G2.5 — Ensayo de migración: PASS (2026-08-03, GO de Miguel)

Ejecutado en el contenedor pixeltec-os-db contra la copia seo_rehearsal
(pg_dump -t blog_posts, 4 filas; la DB real solo se leyó):

1. drizzle/0026 aplicada limpia (CREATE post_redirects + 3 ALTER + FK),
   con ON_ERROR_STOP.
2. Columnas nuevas con defaults correctos: editorial jsonb {} · sources
   jsonb [] · internal_links jsonb [].
3. Las 4 filas preexistentes leen defaults sin backfill y el filtro
   coalesce((seo->>noindex)::boolean,false) da el veredicto esperado:
   published=false (indexables), draft/archived=true.
4. FK verificada: INSERT en post_redirects + JOIN a blog_posts OK.
5. Rollback ensayado: DROP TABLE post_redirects + DROP de las 3 columnas
   deja el shape original con las 4 filas intactas.
6. Copia seo_rehearsal destruida al terminar.

Conclusión: la migración es aditiva pura y reversible; lista para aplicarse
en G4 antes del deploy.

## G3 — QA integral: PASS (2026-08-03, GO de Miguel)

Entorno: build de producción del worktree (dummies inline, cero archivos
.env) + servidor standalone efímero :3013 con DB seo_qa (copia de blog_posts
+ migración 0026 + usuario QA desechable). Todo destruido al terminar
(backends terminados, dropdb verificado, rol eliminado, túnel cerrado).

- Build next: PASS (compila el incremento completo; tabla de rutas emitida).
- Crawl (29 URLs, reglas automatizadas): CERO problemas — metadescription/
  canonical/H1 único en todas las públicas, noindex presente en login/portal/
  reset-password, 12 páginas con BreadcrumbList (antes 3), cero títulos
  duplicados. Redirect de post_redirects verificado end-to-end
  (/blog/slug-viejo-qa → 308 → artículo).
- Browser smoke (Chrome vía túnel): artículo con Header/Footer, TOC de 9
  anclas FUNCIONALES, related, CTA, autor→/equipo, 4 nodos JSON-LD, sin
  scroll horizontal en móvil ni desktop; home OK; consola sin errores
  capturados.
- Lighthouse (3 plantillas × 3 corridas, mobile emulado): score ≈0.99,
  TBT 0, CLS 0, LCP 1.9-2.1 s. ADVERTENCIA HONESTA: localhost sin CDN no es
  comparable 1:1 con el baseline de prod; las señales válidas son TBT 0 en el
  artículo (framer eliminado) y LCP sin depender de placehold.co. La
  comparación real se hace post-deploy contra pixeltec.mx.
- Seguridad del diff completo (a1e948c..HEAD): CSP/egress/middleware/.env
  intactos (0 archivos), cero fetch() nuevos, cero secretos (los matches de
  "password" son nombres de tablas en el snapshot de drizzle/meta y texto de
  docs).
- LIMITACIÓN DECLARADA: los flujos autenticados de blog-admin (publicar/
  despublicar reales) no se ejercitaron en navegador por no manejar
  credenciales en QA; su lógica está cubierta por los 17 tests del gate y el
  smoke autenticado queda para el post-deploy con Miguel.

## Pendiente G4 — deploy (GO aparte)

- push + PR + merge aprobado · migración aplicada con evidencia · --check-only
  → deploy wrapper por SHA · smoke post-deploy (sitemap, robots, artículo,
  redirects, admin) · rollback disponible anotado.
