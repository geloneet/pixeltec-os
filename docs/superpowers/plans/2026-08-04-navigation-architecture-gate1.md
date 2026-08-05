# Gate 1 — Arquitectura de navegación operativa (ADR-0030)

**Fecha:** 2026-08-04 · **Rama:** `feat/navigation-architecture-gate1` · **Base:** `a5c4ccd` (main con Gate 0 mergeado, PR #74)
**Decisión canónica:** NeuroPIXEL `07_DECISIONES/ADR-0030 — Arquitectura de navegación orientada al ciclo operativo de PixelTEC OS` (aceptada 2026-08-04).

## Qué cambia (y qué no)

Reorganización de **arquitectura de información**: etiquetas y agrupación de la navegación. **Cero cambios de URLs, schema, migraciones, APIs, contratos o datos.** Rollback = revert del PR.

### Arquitectura anterior (7 áreas)

```
Hoy · CRM · Proyectos · Finanzas · IA · Marketing · Infra   + "Más…" (Notificaciones)
```

Con: doble taxonomía (`NavArea` + `NavSection` legacy), Blog bajo Infra, IA como área falsa (plantillas + conocimiento), Documentos como vitrina L1 en Finanzas, `/crecimiento` huérfana, Perfil en Infra y en menú de usuario duplicado.

### Arquitectura nueva (6 dominios operativos, transición de ADR-0030)

```
Hoy       /hoy
Trabajo   Proyectos (/proyectos) · Definición (/proyectos/definicion) · PixelForge (/proyectos/pixelforge)
Clientes  Cuentas (/clientes) · PixelBot (/whatsapp)
Finanzas  Cobros (/cobros)
Marketing Resumen (/crecimiento) · Blog (/blog-admin) · Contenido (/crecimiento/content-studio)
          · Campañas (/crecimiento/campanas) · Calendario (/crecimiento/calendario) · Publicación (/crecimiento/publisher)
Sistema   Infraestructura (/vps) · Conocimiento (/accesos) · Plantillas (/ia-factory)
```

Transversales (fuera de L1, grupo "General" del ⌘K + controles globales): **Archivo documental** (`/documentos`), **Notificaciones** (campana + `/notificaciones`), **Perfil y seguridad** (menú de usuario + `/perfil`), **Configuración de marca** (`/crecimiento/brand-brain`, agrupada en Marketing en ⌘K y accesible desde Marketing → Resumen; sin tab permanente).

La arquitectura objetivo (7 dominios, con **Ventas**) y **Tareas** en Trabajo quedan reservadas en ADR-0030 y NO se muestran hasta tener workspaces reales (sin páginas falsas).

### Matriz de rutas conservadas

Todas. Ninguna URL cambió: `/hoy /proyectos /proyectos/definicion /proyectos/pixelforge /clientes /whatsapp /cobros /crecimiento /crecimiento/{brand-brain,content-studio,campanas,calendario,publisher} /blog-admin /vps /accesos /ia-factory /documentos /notificaciones /perfil` — solo cambian etiqueta visible y agrupación. Retirados **del menú, no del producto**: `/documentos`, `/notificaciones` (overflow), `/perfil`, `/crecimiento/brand-brain` (tab); todos siguen accesibles por ⌘K, URL directa, campana/menú de usuario y enlaces contextuales.

## Implementación

- `src/components/nav/command-palette-items.ts` — catálogo único; taxonomía legacy `NavSection`/`section`/`hidden` eliminada; etiquetas nuevas (PixelBot, Cuentas, Plantillas, Contenido, Publicación, Configuración de marca, Archivo documental, Perfil y seguridad); descripciones conservan los nombres históricos para búsqueda.
- `src/components/nav/nav-config.ts` — `NavArea` 7→6 (sin `ia`; slugs internos `crm/proyectos/infra` estables, etiquetas en `NAV_AREA_LABELS`); `AREA_ITEMS` según distribución; nuevo `navHidden` por-ref (Configuración de marca); `OVERFLOW_ITEMS` eliminado; rutas transversales sin área → sin pill activo.
- `src/components/nav/top-navigation.tsx` — dropdown "Más…" eliminado (quedaba vacío); sufijo del logo solo con área activa (adiós literal "Dashboard"); badge de tareas abiertas permanece en Trabajo.
- `src/components/nav/command-palette.tsx` — agrupación por la nueva taxonomía + grupo "General" para transversales (antes se descartaban en silencio); recientes con longest-prefix (`resolveActiveHref`).
- `src/components/nav/user-menu.tsx` — entrada única "Perfil y seguridad" → `/perfil` (elimina duplicidad Mi perfil/Configuración) + Cerrar sesión.
- `src/app/(admin)/crecimiento/page.tsx` — hub como "Resumen": H1 "Marketing", tarjetas renombradas (Configuración de marca / Contenido / Publicación); sin queries ni métricas nuevas.
- `src/components/cmd-k/CmdKDialog.tsx` — **eliminado** (componente muerto sin referencias, verificado).
- `src/components/nav/nav-integrity.test.ts` — ampliado a 16 tests: 6 L1 exactos y en orden, L2 exacto por área, prohibidos (IA/Infra/CRM/Ventas/Tareas, analytics/dashboard/herramientas legacy), documentos fuera de nav + en ⌘K, Configuración de marca en ⌘K, redirects `/asistente` temporales → `/hoy`, user-menu con entrada única, resolución de área activa en rutas anidadas y transversales.

## Validación

| Check | Resultado |
|---|---|
| `nav-integrity.test.ts` | **16/16 PASS** |
| Suite completa | **2280 pass / 15 fail** — los 15 son el baseline preexistente (`NewDefinitionForm`/`NewPixelforgeForm`), verificado idéntico en HEAD limpio; **cero regresiones nuevas** |
| `tsc --noEmit` | Sin errores |
| `npm run validate:egress` | OK — contrato E0 válido (perfil dev) |
| `npm run build` | **PASS** (tras aplicar migraciones committeadas pendientes a la DB dev local; el fallo previo `42703` se reprodujo idéntico en HEAD limpio → drift ambiental preexistente, no de Gate 1) |
| `git diff --check` | Limpio |

## Smoke visual (dev local autenticado, `localhost:4310`, usuario QA descartable — creado y borrado en la misma sesión)

Viewports: **390×844, 768×1024, ~1440×900 (1383×868), 1920×1080.** Verificado:

- 6 pills caben; en móvil scroll horizontal sin overflow del body; botón "Buscar/Menú" abre ⌘K.
- Estado activo inequívoco: `/proyectos`→Trabajo/Proyectos · `/crecimiento`→Marketing/Resumen · `/vps`→Sistema/Infraestructura · `/whatsapp`→Clientes/PixelBot (etiqueta consistente, consola interna intacta).
- `/documentos` accesible y **sin pill falso**; ⌘K con query "archivo" → grupo General → "Archivo documental".
- Marketing → Resumen muestra tarjeta "Configuración de marca" → `/crecimiento/brand-brain`.
- Cero 404; cero labels antiguos en nav (Brand Brain/Content Studio/Publisher solo perviven en descripciones de búsqueda a propósito).
- Login real por `/login` funcional (credenciales de QA locales).

Residuales observados **ajenos a Gate 1** (preexistentes): título del `/login` dice "Smile More" (metadata heredada de plantilla); tile VPS "no responde" en dev local (bug conocido de backlog + sin vps-api local); PixelBot inbox "no configurado" en dev local (`PIXELBOT_TENANT_ID` no seteado); 15 tests baseline Definition/PixelForge.

## Exclusiones (por ADR-0030 / orden ratificada)

Gate 2 (cockpit `/hoy`), Ventas, Tareas, Rentabilidad, cambios de URL, schema/migraciones del repo, APIs. Todo post-v1.0.

## Rollback

Revert del PR de Gate 1. Sin datos, URLs, schema ni contratos involucrados. Disparadores: smoke fallido, regresión de integridad, veto de Miguel.
