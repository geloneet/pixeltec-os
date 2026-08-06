# Estrategia de backlinks y enlazado — pixeltec.mx

Fecha: 2026-08-05 · Complementa `SEO-ARCHITECTURE.md` (capa técnica),
`CONTENT-STRATEGY-90-DAYS.md` (pilares) y `SEO-OPERATIONS-GUIDE.md` (cadencia).
Dos tracks: **enlazado interno** (control total, implementado en código) y
**backlinks externos** (dependen de acciones fuera del repo — checklist abajo).

## Track 1 — Enlazado interno (implementado 2026-08-05)

El circuito ya existía a medias: el editor cura `internalLinks[]` por post
(anchor + destino + verified), el gate de publicación advierte cuando faltan
(`internal-links` warning), y la IA los recibe en el brief — pero la página
pública **nunca los renderizaba**: eran data muerta. Este incremento cierra el
circuito:

- `toPublicBlogPost` (frontera P1-A) ahora cruza `internalLinks` **filtrados**:
  solo `verified: true`, solo destinos internos (relativos o `pixeltec.mx`,
  normalizados a path relativo), y solo `{targetUrl, anchor}` — `placement` y
  `verified` siguen siendo metadato editorial que no viaja al navegador.
- La página del post renderiza el bloque "Recursos de PixelTEC mencionados"
  (footer del artículo, antes de "Sigue leyendo"): enlaces `<a>` rastreables
  con anchor text editorial.

### Reglas editoriales (van en el checklist quincenal del OPERATIONS-GUIDE)

1. Todo post publica con **mínimo 2 enlaces internos verificados**: 1 a la
   página pilar de su `contentPillar` (ver matriz abajo) + 1 a un artículo o
   recurso de apoyo. El gate ya lo advierte; la regla lo vuelve norma.
2. **Anchor descriptivo, nunca "clic aquí"**: el anchor es la keyword de la
   página destino, en lenguaje natural ("automatización de procesos con IA",
   no "nuestros servicios").
3. Ambos sentidos: al publicar un artículo de apoyo, revisar si la página
   pilar o un artículo hermano debe enlazarlo de vuelta (hoy manual; la
   página de servicio es 'use client' — su RSC-ficación es el incremento G1
   pendiente y ahí se agrega el bloque inverso "Artículos de este pilar").

### Matriz pilar → destino canónico

| contentPillar | Página pilar |
|---|---|
| 1 Ecosistemas web | /services/ecosistemas-web |
| 2 Automatización e IA | /services/automatizacion (+ /diagnostico como CTA) |
| 3 PixelBot | /pixelbot |
| 4 Casos y decisiones | /metodologia (E-E-A-T transversal) |

## Track 2 — Backlinks externos (acciones, no código)

Contexto honesto: pixeltec.mx es un dominio joven sin perfil de enlaces. La
palanca realista no es "link building" masivo (spam que Google penaliza) sino
**enlaces legítimos que ya nos pertenecen por operación** + activos enlazables.
Prioridad por esfuerzo/retorno:

### P0 — Propiedades propias (esfuerzo mínimo, hacer ya)

- [x] `sameAs` en Organization schema: Facebook + Instagram (ya en
  `site-config.ts`).
- [ ] **Google Business Profile** de PixelTEC (Puerto Vallarta) con URL al
  sitio — el backlink local más valioso para "desarrollo de software Puerto
  Vallarta"; además habilita el pack local de Maps. NAP idéntico a
  `site-config`.
- [ ] **LinkedIn company page** con URL — vale por señal de entidad (y se
  agrega a `socialProfiles` → sameAs automático).
- [ ] **GitHub org pública** con URL en el perfil — señal E-E-A-T técnica
  coherente con el posicionamiento.

### P1 — Atribución en sitios de clientes [Propuesta — requiere GO de Miguel]

PixelTEC desarrolló y hospeda sitios en producción: villanogal.com,
velankboutique.com, transportessanchezjr.com, pipastondoroque.com, dalk.mx,
smilemore.mx. Un footer "Sitio desarrollado por PixelTEC" (enlace a
https://pixeltec.mx) es práctica estándar de agencia y produce backlinks
reales de dominios con tráfico genuino.

- Requiere: (a) GO de Miguel, (b) acuerdo con cada cliente (los sitios son
  suyos), (c) implementación por sitio (1 línea de footer + deploy).
- Honestidad técnica: todos comparten IP del VPS — Google descuenta enlaces
  same-IP, pero no los anula; el valor de marca/referencia permanece. No
  esperar milagros de ranking de esto solo.
- Anti-patrón prohibido: NO convertir esto en "red de enlaces" recíproca ni
  meter anchors comerciales forzados — atribución sobria con la marca, y ya.

### P2 — Directorios y menciones de entidad (1 tarde, una sola vez)

Solo directorios reales donde el cliente objetivo busca (nada de granjas):
sección de agencias de Clutch/GoodFirms, directorios empresariales mexicanos,
cámaras/asociaciones locales de Vallarta. Registrar NAP idéntico a
`site-config`. Cada perfil nuevo → `socialProfiles[]`.

### P3 — Activos enlazables (juega con la estrategia de contenidos, 90 días)

Los backlinks editoriales llegan a contenido que merece cita. Del calendario
existente, los briefs con potencial de cita son los de datos honestos:
"Cuánto cuesta realmente automatizar un proceso en una PyME" (rangos reales)
y el diagnóstico de madurez digital (herramienta gratuita enlazable). Regla:
1 activo enlazable por trimestre; se promueve manualmente (LinkedIn del
founder, comunidades tech MX) — sin comprar enlaces jamás.

## Medición

- Search Console (cuando haya impresiones): informe "Enlaces" → dominios de
  referencia; meta realista: +5 dominios de referencia legítimos por
  trimestre.
- KPI que manda sigue siendo el del CONTENT-STRATEGY: leads orgánicos en el
  CRM, no conteo de backlinks.
- Revisión semestral (ya en OPERATIONS-GUIDE): perfiles/NAP/backlinks.

## Qué NO se hace (decidido)

Comprar enlaces, granjas/PBNs, intercambios masivos, comentarios spam,
directorios irrelevantes, guest posts a escala con IA. Cualquiera de estos
pone en riesgo el dominio que sostiene la generación de leads del negocio.
