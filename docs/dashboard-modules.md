# Registro central de módulos del dashboard

`[Verificado en código]` · WO-2026-00088 · ADR-0054 (propuesta, `docs/adr/ADR-0054-registro-central-de-modulos.md`)

## Qué es

`src/lib/modules/registry.ts` es la **única fuente de verdad** de qué módulos del admin están:

| Estado | Significado | Navegación | Ruta |
|---|---|---|---|
| `active` | módulo normal | visible | se sirve |
| `protected` | visible pero **congelado** por decisión de producto (WhatsApp/PixelBot en revisión de Meta; Finanzas) | visible | se sirve; solo se integra en la nav, sin cambios internos |
| `hidden` | fuera de toda superficie | no | **404** dentro del shell (guard) |
| `legacy` | como `hidden` y además superado por otro módulo (`supersededBy`) | no | 404 |

Todas las superficies leen el registro: sidebar desktop (`app-sidebar.tsx`), rail móvil (`top-navigation.tsx`) y submenú (`secondary-navigation.tsx`) vía `nav-config.ts`; ⌘K (`command-palette.tsx`, incluidos «Recientes»); accesos rápidos, KPIs y widgets de Inicio (`components/hoy/inicio-surface.ts`); quick links del 404 (`(admin)/_not-found-client.tsx`). Las secciones del workspace de Clientes tienen su propio registro en `src/lib/modules/client-workspace.ts`, con la misma filosofía.

**Nada se oculta con `if (false)`, CSS `display:none`, comentarios ni arreglos por pantalla.** El test `src/lib/modules/registry.test.ts` lo vigila.

## Guard de ruta (patrón único)

Cada módulo `hidden`/`legacy` tiene un `layout.tsx` en la raíz de su ruta que llama a `assertModuleRouteEnabled("<id>")` (`src/lib/modules/route-guard.ts`). Mientras el registro lo marque oculto, cualquier URL del módulo responde `notFound()` → `src/app/(admin)/not-found.tsx` (404 dentro del shell, con accesos rápidos). El middleware de sesión (`PROTECTED_PATHS`, `src/lib/routes/admin-routes.ts`) sigue actuando antes, así que un módulo oculto **nunca** queda expuesto al público; el rol `reviewer` sigue recibiendo 403 antes de llegar al guard (WO-2026-00051).

Rutas con guard: `/proyectos` (+ `/proyectos/definicion`, `/proyectos/pixelforge`), `/crecimiento` (+ `content-studio`, `campanas`, `calendario`, `publisher`, `brand-brain`), `/blog-admin`, `/vps`, `/ia-factory`, `/documentos`.

Un módulo padre oculto con un hijo activo sigue sirviendo el árbol del hijo (`isModuleRouteEnabled` mira a los hijos).

## Cómo ocultar un módulo

1. `registry.ts`: cambia `state` a `hidden` (o `legacy` + `supersededBy`).
2. Si el módulo tiene ruta y aún no tiene guard: crea `src/app/(admin)/<ruta>/layout.tsx` con el patrón de arriba (el test exige que exista).
3. Si el destino aún no está en `command-palette-items.ts`, no hace falta añadirlo; si está, **no lo borres**: el registro lo filtra.
4. Corre `npm test -- src/lib/modules src/components/nav` y actualiza `EXPECTED_STATES` en `registry.test.ts` y las expectativas de `nav-integrity.test.ts` **revisándolas**, no copiando la salida.

## Cómo reactivar un módulo

1. `registry.ts`: `state` → `active`.
2. Los `layout.tsx` con guard no se tocan: dejan de responder 404 al instante.
3. Tests como arriba. Si el módulo tiene tarjetas en Inicio (`inicio-surface.ts`) o secciones en Clientes (`client-workspace.ts`), reaparecen solas.
4. Smoke en navegador: sidebar/rail/⌘K muestran el módulo; su ruta abre; el 404 ya no.

## Añadir un módulo nuevo

1. Añade el `ModuleId` y su entrada en `REGISTRY` (`routes` = prefijos de URL que posee).
2. Añade su slug a `ADMIN_ROUTES` (protección de sesión + robots).
3. Añade su destino a `PALETTE_NAV_ITEMS` con `module: "<id>"` y su `AreaItemRef` en `AREA_ITEMS` (`nav-config.ts`) — o crea un área nueva en `NavArea`/`NAV_AREA_ORDER`/`NAV_AREA_LABELS` y su icono en `AREA_ICONS` (`app-sidebar.tsx`).
4. `registry.test.ts` comprueba que todo destino y toda ruta admin pertenecen a un módulo registrado.

## Estado actual (2026-08-25)

Navegación visible: **Inicio · Clientes · WhatsApp · Finanzas · Usuarios y Accesos** (Blog aparece cuando FASE 8 registre `/blog-cms`). PixelBot conserva su acceso (item «PixelBot» → `/whatsapp`, Console dentro de la página) como excepción explícita. Ocultos: Trabajo/Proyectos, Definición, PixelForge, Marketing, Contenido, Campañas, Calendario, Publicaciones, Configuración de marca, Infraestructura, Plantillas, Archivo documental. Legacy: Blog anterior (`/blog-admin`). Transversales sin cambio: Notificaciones, Perfil, Respuestas Smile More.
