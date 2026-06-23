# pixeltec-os — estado al 2026-06-17

## Sprint completado esta sesión: IA Redesign (pantallas CRM)

Cuatro redesigns completos, todos desplegados en producción (pixeltec.mx), TypeScript limpio, sin cambios en Firestore.

### `/clientes` — commit 6364fb5
- Linear-style: filas densas con métricas globales, búsqueda, filtros, ordenamiento.

### `/clientes/[id]` — commit 05a1af0
- Client Workspace: header + 4 KPIs Stripe-style + project cards con progreso + timeline de creación + notas.

### `/proyectos/[id]` — commit aa0354e
- Project Workspace: 4 tabs (Resumen/Tareas/Recursos/Finanzas).
- Resumen por defecto: KPIs, siguiente acción, actividad, notas.
- Tareas: toggle Lista/Kanban estático (sin drag-and-drop).
- Recursos: credenciales + README + Prompt IA en una sola tab.
- Finanzas: presupuesto + cobros recurrentes.
- Modal editProject con 3 secciones visuales (General / Finanzas / Recursos).

### `/accesos` — commits eeb6536 + b84c677
- Knowledge Hub: KPIs (Recursos/Tips/Categorías), búsqueda global por nombre+tips+contenido.
- ★ Favoritos en localStorage (key `pixeltec-os:favorites`), sección oculta si vacía.
- Recientes (top 4 por updatedAt, solo si >4 recursos).
- Cards enriquecidas: avatar, tags derivados, "editado hace X".
- Detalle: KPIs del recurso, tip cards con `updatedAt` + tooltip, content renderizado como **Markdown** (párrafos/listas/títulos/bloques de código con botón Copiar).
- Modal "Nuevo tip": textarea 300px (+50%), resize-y, hint de Markdown debajo del campo.

---

## Arquitectura clave (no tocar)

- Datos: `crm_data/{uid}` — un solo documento Firestore. `clients[] → projects[] → tasks[]/charges[]/keys[]`, `tools[] → tips[]`.
- Contexto: `CRMContext` (CRUD) dentro de `CRMShellProvider` (modales + Pomodoro).
- `urlToolId` derivado de `usePathname()` — add/editTip dependen de estar en `/accesos/[id]`.
- Helpers puros: `src/lib/crm/client-stats.ts` + `src/lib/crm/knowledge-stats.ts`.
- Dark theme: shell `bg-[#030303]`, cards `rounded-xl border border-white/[0.06] bg-zinc-900/20`.

---

## Pendiente / deuda técnica

### CSP Phase 2 (tiempo-gate)
- Hoy: `Content-Security-Policy-Report-Only` en `src/middleware.ts`.
- Acción: revisar colección `cspViolations` en Firestore (~7-14 días de datos) y cambiar a `Content-Security-Policy` definitivo.
- Archivo: `src/middleware.ts` — buscar `Content-Security-Policy-Report-Only`.

### Aviso de privacidad v2 (LFPDPPP)
- Borrador generado, pendiente de enviar a abogado externo.
- Bloqueado en tercero — no hay acción de código.

### Nada más en el backlog de código activo.
