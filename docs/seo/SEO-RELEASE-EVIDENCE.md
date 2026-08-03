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

## Pendiente G2.5 — ensayo de migración (GO aparte)

- pg_dump de blog_posts → DB temporal → aplicar 0026 → leer filas viejas por
  las queries serializadas → evidencia aquí. SIN tocar la DB real.

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
