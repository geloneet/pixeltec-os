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

## Pendiente G3 — QA integral (GO aparte)

- Crawl completo re-corrido (crawl.mjs) y diff contra baseline.
- Browser smoke (5 viewports, reduced motion, teclado) público + blog-admin.
- Lighthouse 3× mediana por plantilla vs SEO-BASELINE-2026-08-03.
- Revisión de seguridad: cero secretos/.env, cero fetch de fuentes, CSP/egress
  intactos, publicación con rol.

## Pendiente G4 — deploy (GO aparte)

- push + PR + merge aprobado · migración aplicada con evidencia · --check-only
  → deploy wrapper por SHA · smoke post-deploy (sitemap, robots, artículo,
  redirects, admin) · rollback disponible anotado.
