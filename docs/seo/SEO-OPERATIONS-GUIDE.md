# Guía operativa SEO — PixelTEC

Cómo se opera el SEO de pixeltec.mx de forma recurrente. Complementa (no
duplica): SEO-ARCHITECTURE.md (cómo está construido), URL-INTENT-MAP.md (qué
URL responde qué), CONTENT-STRATEGY-90-DAYS.md (qué se publica).

## 1. Objetivo y principios

- El SEO es un sistema continuo, no un proyecto con final.
- Nadie puede garantizar posiciones ni rich results — desconfía de quien lo
  prometa (incluido un reporte interno).
- Personas antes que buscadores; calidad antes que volumen; evidencia antes
  que claims; la IA asiste, JAMÁS publica sola.
- No manipular: nada de compra de enlaces, PBN, intercambios, guest posts a
  escala, anchors artificiales ni contenido masivo sin valor.

## 2. Roles (una persona puede cubrir varios; las responsabilidades no se funden)

| Rol | Responsabilidad | Hoy |
|---|---|---|
| Owner de negocio | prioridades, GO de publicación sensible | Miguel |
| Autor | contenido y experiencia propia | Miguel / equipo |
| Revisor técnico | verdad técnica de claims | Miguel |
| Editor | calidad, fuentes, enlaces | Miguel |
| Responsable SEO | intención, keywords, medición | Miguel + agente IA |
| Desarrollo | metadata/schema/rendimiento | agente IA con gates |
| Aprobador de publicación | rol admin en el OS | Miguel |

## 3. Proceso — página comercial

investigación → intención (URL-INTENT-MAP) → URL objetivo → copy con evidencia
→ metadata (buildMetadata) → enlaces internos → schema → QA (crawl + preview)
→ publicar (deploy gobernado) → GSC (inspección de URL) → medir → actualizar.

## 4. Proceso — artículo del blog (el sistema lo instrumenta)

1. Idea → validar contra estrategia (¿pilar? ¿intención? ¿qué aporta PixelTEC?).
2. Brief en /blog-admin/nuevo: estrategia + contenido + EVIDENCIA (experiencia
   propia y fuentes con claim y verificación humana) + enlaces internos.
3. Generación IA (borrador con [FUENTE PENDIENTE] donde falte respaldo).
4. Edición humana: resolver TODOS los [FUENTE PENDIENTE], verificar claims,
   marcar fuentes verificadas, alt de portada, keyword/canonical/noindex.
5. Panel de readiness: resolver blockers; las warnings se atienden o se
   aceptan conscientemente.
6. Aprobar (registra revisor) → Publicar (gate de servidor + rol admin).
7. Comprobar: URL 200, sitemap la incluye, GSC "Solicitar indexación".
8. Medir a 4-6 semanas; actualizar o consolidar según §8.

## 5. Política de fuentes y enlaces

- Jerarquía: fuente primaria (doc oficial, investigación, norma, evidencia
  PixelTEC) > secundaria reputada. El "prestigio" del dominio NO es razón para
  citar: se cita lo que RESPALDA un claim concreto.
- Cita cerca del claim, anchor descriptivo, sin copiar fragmentos largos.
- Registrar fecha de consulta; verificación SIEMPRE humana (el sistema no
  fetchea URLs por diseño — SSRF).
- `rel`: enlaces editoriales normales SIN nofollow; `sponsored` para pagados;
  `ugc` para contenido de usuarios; `nofollow` solo con razón real.
- Claims sin evidencia: se eliminan o quedan como opinión explícita.
- Nunca cambiar fechas para aparentar frescura.

## 6. Checklist previa a publicación (imprimible)

[ ] Intención clara y única · [ ] aporte propio real (no refrito)
[ ] claims verificados · [ ] fuentes verificadas (checkbox consciente)
[ ] title/H1 coherentes · [ ] metadescripción honesta · [ ] slug limpio
[ ] canonical correcta · [ ] indexabilidad deseada (noindex consciente)
[ ] portada + alt descriptivo · [ ] enlaces internos a servicios/artículos
[ ] CTA contextual · [ ] preview desktop/móvil · [ ] gate sin blockers

## 7. Cadencias

**En cada publicación**: checklist §6 + comprobar URL/sitemap/GSC.
**Semanal (15 min)**: GSC errores críticos + indexación de lo reciente + 404
nuevas + formularios/leads orgánicos + acciones manuales/seguridad.
**Quincenal**: publicar u optimizar una pieza revisada; enlaces internos desde
contenido viejo al nuevo.
**Mensual**: reporte §10; ganadores/estancados; query→page map (cuando haya
datos); links rotos; huérfanas; CWV; UNA actualización sustancial; no
reaccionar a fluctuaciones de días.
**Trimestral**: auditoría técnica (re-correr crawl + Lighthouse del baseline);
revisión de servicios y clusters; consolidaciones; autores/bios; competencia;
un caso de estudio real.
**Semestral**: NAP/directorios/perfiles; backlinks; decay; redirects
históricos; privacidad/tracking.
**Anual**: estrategia completa, pilares, herramientas, responsabilidades.

## 8. Actualización y consolidación

- Actualizar = cambio sustancial + changeSummary + fuentes/capturas al día +
  misma URL (slug solo cambia con redirect vía el editor). Medir antes/después.
- Consolidar/retirar: evaluar tráfico/enlaces/duplicidad → redirect al destino
  equivalente → actualizar enlaces internos → sitemap se ajusta solo → vigilar
  4 semanas. Nada se elimina masivamente sin GO del owner.

## 9. Runbook de incidentes SEO

| Síntoma | Primera comprobación | Acción |
|---|---|---|
| Sitemap vacío/sin posts | curl /sitemap.xml; ¿force-dynamic sigue? ¿DB viva? | NO volver a hornear el sitemap (incidente 2026-08-03); revisar logs [sitemap] |
| Post publicado desaparecido | status en DB + seo.noindex + COALESCE | revalidar; revisar updatePost/acciones recientes |
| noindex accidental | curl de la URL, meta robots | corregir en editor; GSC inspección |
| Canonical masiva incorrecta | crawl.mjs del baseline | revisar buildMetadata/seo.canonicalUrl |
| Caída de tráfico | GSC (impresiones vs clics vs indexación) | no tocar nada 72h; diagnosticar antes de "optimizar" |
| Redirect loop | curl -I encadenado | post_redirects + next.config; ver §slugs de la arquitectura |
| 404 masivas | GSC páginas + crawl | ¿deploy reciente? ¿slugs cambiados sin redirect? |
| Schema inválido | Rich Results Test | un solo nodo por entidad; paridad con visible |
| CWV degradado | Lighthouse 3× mediana vs baseline | comparar con SEO-BASELINE; buscar el commit que cambió la plantilla |
| Hackeo/acción manual | GSC seguridad | incidente de seguridad primero (SECURITY-00X), SEO después |

## 10. Reporte mensual (plantilla)

Resumen ejecutivo (3 líneas) · KPIs: clics no-branded, impresiones,
indexadas/indexables, leads orgánicos CRM, CWV · Cambios ejecutados ·
Ganadores / pérdidas + hipótesis · Riesgos · Próximas acciones con responsable
· Evidencia (capturas GSC, crawl).
