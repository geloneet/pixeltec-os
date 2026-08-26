---
title: ADR-0054 — Registro central de módulos y limpieza controlada del dashboard de PixelTEC OS
type: adr
status: propuesta
created: 2026-08-25
accepted: null
signed_by: null
owner: Miguel Robles Sánchez
supersedes: null
relacionada: ADR-0030 (navegación por ciclo operativo), ADR-0039 (sidebar persistente), ADR-0035 (workspace de cliente y campos server-owned), ADR-0022 (Postgres/Drizzle), ADR-0028 (egress fail-closed), ADR-0037 (instancia demo), ADR-0051/ADR-0052 (WorkOrders y paralelismo)
baseline: WO-2026-00088 (orden literal en 09_SEGUIMIENTO/workorders/WO-2026-00088-orden.md)
tags:
  - adr
  - pixeltec-os
  - navegacion
  - arquitectura-de-informacion
  - modulos
  - blog
---

# ADR-0054 — Registro central de módulos y limpieza controlada del dashboard de PixelTEC OS

> **PROPUESTA — sin firma.** Redactada por el Worker PixelTEC OS Dashboard bajo WO-2026-00088 (orden de Miguel, 2026-08-25). Solo Miguel firma (gate `adr-sign`). `[Propuesta]`

## Contexto

`[Documentado en NeuroPIXEL]` PixelTEC OS está cerrando v1.0 bajo freeze «no innovar»; la orden de Miguel del 2026-08-25 es una **excepción explícita** al freeze (mismo patrón que PixelBot-UI, programa SEO, Gate 1 de ADR-0030 y ADR-0039): **simplificar** la superficie visible del dashboard para rediseñar cada módulo después de forma intencional, sin borrar nada, y añadir una sección Blog con paridad comprobada a la implementación real de Muebles Encino.

`[Verificado en código]` Antes de esta decisión (`f87d0e2`) la navegación exponía 6 áreas L1 (Hoy · Trabajo · Clientes · Finanzas · Marketing · Sistema, ADR-0030/0039) con 20 destinos; la visibilidad se decidía por presencia en el catálogo (`command-palette-items.ts` + `nav-config.ts`) y por rol (WO-2026-00051). No existía un mecanismo para **ocultar** un módulo conservando su código, sus rutas y sus datos: la única forma era borrar entradas del catálogo (y aun así las rutas seguían sirviéndose).

## Decisión (propuesta)

1. **Registro central de módulos** — `src/lib/modules/registry.ts` es la única fuente de verdad de qué módulos están `active`, `protected`, `hidden` o `legacy`. Todas las superficies (sidebar desktop, rail móvil, submenú, ⌘K incluidos «Recientes», accesos rápidos/KPIs/widgets de Inicio, quick links del 404) y los guards de ruta leen de ahí. Prohibido ocultar con `if (false)`, CSS, comentarios o condiciones por pantalla (test `registry.test.ts`).
2. **Navegación visible** — `Inicio · Clientes · WhatsApp · Finanzas · Blog · Usuarios y Accesos`, en ese orden. Etiqueta «Hoy» → «Inicio», ruta `/hoy` intacta. Las URLs no cambian (ADR-0030 §11 sigue vigente). Las áreas de módulos ocultos (Trabajo, Marketing, Sistema) se conservan en el catálogo, sin pill ni tabs, para reactivarlas sin reconstruir.
3. **PixelBot = excepción protegida** — conserva su acceso actual (item «PixelBot» → `/whatsapp`, Console dentro de la página) bajo el área WhatsApp; no se mueve dentro ni fuera. WhatsApp y Finanzas se marcan `protected`: solo integración de navegación, cero cambios internos (verificable con `git diff` vacío sobre sus paths).
4. **Módulos ocultos** (`hidden`): Trabajo/Proyectos, Definición, PixelForge, Marketing (resumen), Contenido, Campañas, Calendario, Publicaciones, Configuración de marca, Infraestructura, Plantillas, Archivo documental. **Legacy**: Blog anterior (`/blog-admin`), superado por el Blog nuevo. Código, rutas, tablas, migraciones y datos se conservan íntegros.
5. **Guard de ruta único** — cada módulo oculto tiene un `layout.tsx` en la raíz de su ruta que llama `assertModuleRouteEnabled("<id>")` → `notFound()` (404 dentro del shell, `src/app/(admin)/not-found.tsx`). El middleware de sesión (`PROTECTED_PATHS`) actúa antes: nunca hay acceso público accidental; el rol `reviewer` recibe 403 antes del guard. Nota técnica: por el `loading.tsx` del grupo `(admin)` la respuesta se transmite en streaming y el código HTTP es 200 con la UI de 404 (comportamiento documentado de Next.js); si Miguel prefiere un código de estado explícito, la alternativa es `redirect("/hoy")` (307) en el mismo guard.
6. **Usuarios y Accesos (D-88-2)** — un módulo conceptual en la navegación con **dos rutas intactas**: `/usuarios` (equipo interno: invitaciones, roles, suspensión; solo admin) y `/accesos` (accesos y documentación técnica por herramienta, antes etiquetado «Conocimiento»). No se fusionan rutas, modelos ni lógica; la etiqueta «Conocimiento» desaparece de toda superficie (criterio 5 de la orden), la ruta se conserva (D-88-2).
7. **Clientes** — registro de secciones `src/lib/modules/client-workspace.ts`: visibles información general, cuentas (lista), «requiere atención», notas y actividad reciente; ocultos Proyectos, Comercial (propuestas/contratos/facturación), Documentos y Portal (no nombrado por la orden ⇒ no aprobado; decisión reversible). Guardar información general conserva los datos de las secciones ocultas (test de regresión + contrato a nivel de fuente sobre el upsert, ADR-0035).
8. **Publicaciones** se oculta, no se elimina; el flujo del token de redes queda documentado sin secretos en `docs/publicaciones-token-redes.md` con checklist de reactivación.
9. **Blog** — nueva sección en `/blog-cms` (etiqueta «Blog»; D-A del SG) con paridad **solo** a las capacidades comprobadas en Encino (`docs/pr/WO-2026-00088-blog-matriz.md`), adaptada a NextAuth/RBAC/Drizzle/R2 de PixelTEC OS. Modelo de datos: **decisión D-C pendiente de Miguel** (evolución aditiva del `blog_posts` legacy — recomendada — o módulo separado). La superficie pública `/blog` de pixeltec.mx solo cambia dentro del contrato público real de Encino (gate `public-blog-surface`).
10. **Reactivación** = cambiar `state` en el registro (y en `client-workspace.ts` para Clientes); los guards, catálogos y widgets ya están declarados. Procedimiento en `docs/dashboard-modules.md`.

## Alternativas consideradas y rechazadas

- **Borrar entradas del catálogo y dejar las rutas vivas** — no oculta las rutas ni los widgets, no es reversible sin reconstruir y contradice la orden §4.
- **Feature flags por variable de entorno** — esparce la decisión por ambientes y por `process.env`; la orden pide una única fuente clara en código, tipada y versionada.
- **Condicionales por pantalla / CSS `display:none`** — prohibido por la orden §4.5; irreversible en la práctica.
- **`redirect` a `/hoy` en vez de 404** — descartado por defecto (una URL oculta «no existe» mientras el módulo está apagado); queda como alternativa si se quiere un código HTTP explícito (ver 5).
- **Eliminar el Blog legacy y sus tablas** — prohibido (orden §12) y destruiría el blog público de pixeltec.mx.

## Consecuencias

**Positivas:** superficie mínima y coherente con la operación actual; un solo lugar para decidir visibilidad; reactivación sin reconstruir; módulos congelados verificables por diff vacío; tests de integridad que fallan si algo se oculta «a mano».

**Negativas / deuda:** áreas y destinos ocultos conviven en el catálogo (ruido para quien lo lea); `nav-integrity.test.ts` cambia sus expectativas de taxonomía (revisadas explícitamente); el HTTP 200 con UI 404 por streaming; Inicio queda visualmente escaso hasta el rediseño intencional (no se rediseñó a propósito); el rol `staff` sigue viendo la misma navegación que `admin` (sin cambio respecto a hoy).

## Rollback

Revertir los commits de la rama `feature/dashboard-cleanup-blog` (todos locales hasta el gate `merge-to-main`). No se tocaron URLs, contratos, APIs, esquema ni datos en FASES 0–7; la migración del Blog (si D-C la aprueba) es aditiva y su rollback se documenta en `docs/pr/WO-2026-00088.md` §11.

## Relación con otras decisiones

- ADR-0030 — taxonomía y conservación de URLs: intactas; esta ADR añade la dimensión «estado del módulo» sobre esa taxonomía.
- ADR-0039 — el sidebar persistente sigue siendo el contenedor en desktop; solo cambia qué áreas muestra.
- ADR-0035 — el workspace de cliente conserva sus tabs en código; los campos server-owned y el contrato anti-pisado se extienden con un test explícito para el guardado de información general.
- ADR-0028 / WO-2026-00051 — middleware, egress y política del reviewer no se tocan (diff vacío).
