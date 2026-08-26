# WO-2026-00088 — Parche exacto para NeuroPIXEL (pendiente de aplicar por el SG/Miguel)

El Worker no escribe en el vault salvo su check-in/check-out. Este archivo contiene, listo para copiar, lo que debe entrar en NeuroPIXEL cuando Miguel apruebe (gates `adr-sign` y `merge-to-main`). Nada de esto se ha aplicado todavía: `[Propuesta]`.

## 1. `07_DECISIONES/ADR-0054 - Registro central de modulos y limpieza del dashboard de PixelTEC OS.md`

Copiar íntegro `docs/adr/ADR-0054-registro-central-de-modulos-y-limpieza-del-dashboard.md` (frontmatter incluido; `status: propuesta` hasta la firma). Numeración verificada: el último ADR en `07_DECISIONES/` es ADR-0053 (2026-08-25).

## 2. `04_PRODUCTOS/PixelTEC OS/PixelTEC OS.md` — añadir tras «Rol `reviewer`…»

```markdown
## Limpieza controlada del dashboard y registro central de módulos (2026-08-25) `[Verificado en código]` — WO-2026-00088 · ADR-0054 (propuesta)

Excepción explícita al freeze de v1.0 ordenada por Miguel (mismo patrón que Gate 1 / ADR-0039). Rama `feature/dashboard-cleanup-blog` (worktree `wt-dashboard-cleanup`, base `f87d0e2`), commits locales sin push hasta el gate `merge-to-main`.

- **Registro central de módulos** `src/lib/modules/registry.ts` (estados `active | protected | hidden | legacy`): única fuente de verdad que leen sidebar, rail móvil, submenú, ⌘K, Inicio y el 404. Guard de ruta único (`assertModuleRouteEnabled` en el `layout.tsx` de cada módulo oculto → 404 en el shell, detrás del middleware de sesión). Guía: `docs/dashboard-modules.md`.
- **Navegación visible:** Inicio (`/hoy`, solo cambia la etiqueta) · Clientes · WhatsApp (PixelBot conserva su acceso dentro, excepción protegida) · Finanzas · Blog (`/blog-cms`, FASE 8) · Usuarios y Accesos (`/usuarios` + `/accesos`, dos rutas intactas, D-88-2).
- **Ocultos (código, rutas y datos intactos):** Trabajo/Proyectos, Definición, PixelForge, Marketing, Contenido, Campañas, Calendario, Publicaciones, Configuración de marca, Infraestructura (`/vps`), Plantillas (`/ia-factory`), Archivo documental. **Legacy:** Blog anterior (`/blog-admin`).
- **Clientes:** solo información general, cuentas, «requiere atención», notas y actividad reciente (`src/lib/modules/client-workspace.ts`); Proyectos/Comercial/Documentos/Portal ocultos; test de regresión: guardar información general no toca datos ocultos.
- **Congelados (diff vacío verificado):** WhatsApp/PixelBot y Finanzas.
- **Publicaciones:** oculto, flujo del token de Meta documentado sin secretos en `docs/publicaciones-token-redes.md` (18 puntos + checklist de reactivación).
- **Blog:** matriz origen→destino con Encino (`docs/pr/WO-2026-00088-blog-matriz.md`); modelo de datos = decisión D-C de Miguel; superficie pública `/blog` solo dentro del contrato real de Encino (gate `public-blog-surface`).
- Reporte completo: `docs/pr/WO-2026-00088.md`.
```

Y en el bloque «Excepciones al freeze» añadir la línea:

```markdown
### Excepción al freeze (2026-08-25): limpieza controlada del dashboard — WO-2026-00088 / ADR-0054 (propuesta)
Orden directa de Miguel: simplificar la superficie visible (registro central de módulos, nav de 6 entradas, Clientes reducido, Finanzas/WhatsApp/PixelBot congelados, Publicaciones oculto) + Blog con paridad a Muebles Encino. No deroga el freeze para el resto del producto.
```

## 3. `04_PRODUCTOS/PixelTEC OS/referencia-tecnica.md` — sección nueva (el documento sigue describiendo Firestore; esta sección es aditiva y verificada)

```markdown
## Registro central de módulos del dashboard (2026-08-25, WO-2026-00088) `[Verificado en código]`

| Archivo | Papel |
|---|---|
| `src/lib/modules/registry.ts` | `MODULES` con `id`, `label`, `state` (`active|protected|hidden|legacy`), `routes`, `parent`, `supersededBy`, `note`; helpers `isModuleVisible`, `isModuleRouteEnabled`, `getModuleForPath`. |
| `src/lib/modules/route-guard.ts` | `assertModuleRouteEnabled(id)` → `notFound()`; se usa en `src/app/(admin)/<ruta>/layout.tsx` de cada módulo oculto. |
| `src/lib/modules/client-workspace.ts` | secciones del workspace de cliente (`resumen` activo; `proyectos`, `comercial`, `documentos`, `portal` ocultos) y mapeo de tarjetas/CTAs del Resumen. |
| `src/components/nav/command-palette-items.ts` | catálogo de destinos; cada item declara `module`. |
| `src/components/nav/nav-config.ts` | áreas (`hoy, crm, whatsapp, finanzas, blog, usuarios, proyectos, marketing, infra`), etiquetas, `getVisibleNavAreas/Items`, `getSecondaryItems`, `getActiveArea` — todo filtrado por el registro. |
| `src/components/hoy/inicio-surface.ts` | accesos rápidos, KPIs y widgets de Inicio declarados por módulo. |
| Tests | `src/lib/modules/registry.test.ts` (estados, cobertura de `ADMIN_ROUTES` y del catálogo, guard por archivo, sin `if(false)`/CSS), `src/components/nav/nav-integrity.test.ts` (taxonomía visible, rutas reales, redirects), `src/components/crm/ClientWorkspace.test.tsx`, `src/components/crm/client-general-save.regression.test.tsx`. |

Rutas admin y su módulo: `/hoy`→inicio · `/clientes`→clientes · `/whatsapp`→whatsapp (protected) · `/cobros`→finanzas (protected) · `/usuarios`→usuarios · `/accesos`→accesos · `/notificaciones`, `/perfil`→controles globales · `/smilemore-respuestas`→vista sin nav · `/proyectos(/definicion|/pixelforge)`→hidden · `/crecimiento(/…)`→hidden · `/vps`, `/ia-factory`, `/documentos`→hidden · `/blog-admin`→legacy · `/blog-cms`→blog (FASE 8).
```

## 4. `05_CAPACIDADES/nextjs.md` — apartado nuevo (patrón reutilizable)

```markdown
### Patrón: registro central de módulos con guard de ruta (PixelTEC OS, WO-2026-00088)

Para ocultar módulos de un admin Next.js (App Router) sin borrarlos: (1) un registro tipado `MODULES[]` con `state` por módulo, (2) el catálogo de navegación declara `module` por destino y todas las superficies filtran con `isModuleVisible`, (3) un `layout.tsx` (Server Component) en la raíz de cada ruta oculta llama `notFound()` cuando el registro lo marca oculto — detrás del middleware de sesión, nunca como sustituto. Reactivar = cambiar `state`. Nota: con un `loading.tsx` por encima, Next transmite en streaming y el HTTP es 200 con la UI de 404; si se necesita código explícito, usar `redirect` en el mismo guard. Referencia: `docs/dashboard-modules.md` en pixeltec-os.
```

## 5. `09_SEGUIMIENTO/PixelTEC OS.md`

El check-in/check-out de este WO los escribe el propio Worker (ADR-0041); no requiere parche adicional.

## 6. Pendientes que NO forman parte del parche (decisiones de Miguel)

- D-C (modelo de datos del Blog) y, según su respuesta, ADR-0054 §9 y la ficha se completan con la migración y el alcance público final.
- `frame-src` de la CSP para el embed de Google Maps del Blog (Encino lo soporta; PixelTEC OS lo bloquea globalmente en `src/lib/security/csp.ts`, fuera del alcance del WO).
- Cifrado en reposo de `growth_social_accounts.access_token` (riesgo documentado, no corregido).
