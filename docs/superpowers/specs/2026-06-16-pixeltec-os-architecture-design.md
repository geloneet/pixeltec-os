# Product Architecture Document — PixelTEC OS

**Versión:** 1.0 · **Fecha:** 2026-06-16 · **Autor:** Product Architecture Review

---

## 1. Diagnóstico del estado actual

### Problemas estructurales

| Problema | Impacto |
|---|---|
| Las tareas están enterradas en `/asistente` (AI weekly planner) | La prioridad #1 del director es la más difícil de acceder |
| El Dashboard muestra KPIs de vanidad, no estado operativo accionable | Los primeros 10 segundos no dicen qué hacer hoy |
| Proyectos existen solo como sub-vista dentro de cliente | Una entidad primaria tratada como secundaria |
| Crypto Intel vive como módulo de primer nivel del OS | Una herramienta personal compite en jerarquía con operaciones de agencia |
| `/clientes` está encuadrado como CRM con pipeline comercial | La agencia ya tiene clientes — el foco debe ser operación, no ventas |
| Herramientas y Accesos son conceptos distintos mezclados | Credenciales técnicas se pierden entre prompts y docs |

---

## 2. Entidades del sistema

### Entidades primarias

Tienen ruta top-level, aparecen en búsqueda global, son el vocabulario diario del equipo.

| Entidad | Descripción | Cardinalidad típica |
|---|---|---|
| **Tarea** | Unidad mínima de trabajo ejecutable, asignable, con fecha | 50–200 activas |
| **Proyecto** | Agrupador de tareas con cliente, fechas y estado de entrega | 5–15 activos |
| **Cliente** | Cuenta activa con proyectos y cobros asociados | 10–30 activos |

### Entidades secundarias

Viven dentro de una entidad primaria o en secciones de gestión. No tienen navegación top-level propia.

| Entidad | Pertenece a | Descripción |
|---|---|---|
| Actualización | Proyecto / Cliente | Comunicación de progreso al cliente |
| Cobro | Proyecto / Cliente | Factura, pago pendiente, cuota |
| Credencial / Acceso | Proyecto / Herramientas | Login, API key, acceso de servidor |
| Nota | Tarea / Cliente | Contexto, decisiones, acuerdos verbales |

### Entidades de sistema

Utilidades operativas — no son el trabajo diario del director.

| Entidad | Módulo | Frecuencia de acceso |
|---|---|---|
| Servicio VPS | Sistema → Infraestructura | Semanal / ante incidentes |
| Artículo de blog | Sistema → Blog | Esporádico |
| Notificación | Centro de alertas | Bajo demanda |

---

## 3. Módulos: qué queda, qué desaparece, qué se fusiona

### Queda (redefinido)

| Módulo nuevo | Reemplaza a | Cambio clave |
|---|---|---|
| **Hoy** | `/dashboard` actual | De KPIs de vanidad → comando operativo diario |
| **Tareas** | `/asistente` | El planner semanal con IA es una *feature*, no el módulo entero |
| **Proyectos** | Sub-vista dentro de `/clientes/[id]` | Sube a entidad primaria con ruta propia |
| **Clientes** | `/clientes` CRM-style | Se reencuadra: directorio de cuentas activas, no pipeline |
| **Cobros** | Disperso en `finances` collection | Módulo dedicado y visible |
| **Accesos** | `/herramientas` + parte de `/vps` | Credenciales + docs técnicos unificados |
| **Sistema** | `/vps` + `/blog-admin` + `/perfil` | Sección colapsada para operaciones de infraestructura |

### Desaparece

| Módulo | Por qué |
|---|---|
| **Dashboard actual** | Reemplazado por Hoy — tiene cero información accionable |
| **Crypto Intel** | Herramienta personal que no pertenece al OS de una agencia. Mover a Herramientas como ítem oculto, o extraer a app separada |

### Se fusiona

| Antes | Después | Criterio |
|---|---|---|
| `/asistente` + tareas globales del CRM | **Tareas** (único módulo) | Una sola fuente de verdad para trabajo ejecutable |
| `/herramientas` (prompts, docs) + credenciales de proyectos | **Accesos** | El acceso real a un proyecto incluye sus credenciales |
| `/perfil` + config del sistema | **Sistema → Configuración** | No merece ruta top-level propia |

---

## 4. Arquitectura de información

### Jerarquía de navegación

```
NÚCLEO  (trabajo diario)
├── Hoy              — pantalla de inicio
├── Tareas           — lista maestra + vista semanal IA
├── Proyectos        — estado por proyecto, kanban de tareas
└── Clientes         — directorio de cuentas, portal, actualizaciones

GESTIÓN  (ciclo operativo)
├── Cobros           — facturas, pagos, pendientes por cliente
└── Accesos          — credenciales, docs, links por proyecto

SISTEMA  (colapsado por defecto)
├── Infraestructura  — VPS status, deploys, logs
├── Blog             — CRUD de artículos públicos
└── Configuración    — perfil, notificaciones, preferencias
```

### Relaciones entre entidades

```
Cliente
  └── tiene muchos → Proyectos
        └── tiene muchas → Tareas
        └── tiene muchas → Actualizaciones  (visibles en portal)
        └── tiene muchos → Cobros
        └── tiene muchos → Accesos

Tarea
  ├── pertenece a → Proyecto (obligatorio)
  ├── asignada a → Usuario del equipo
  └── tiene → fecha, estado, prioridad

Cobro
  ├── pertenece a → Proyecto o Cliente
  └── tiene → monto, estado (pendiente / pagado / vencido), fecha
```

---

## 5. Pantalla principal: "Hoy"

**Criterio de diseño:** Un director de agencia abre el OS a las 9 AM. En 10 segundos debe saber: qué tengo que hacer hoy, qué está bloqueado, y si hay algo urgente de un cliente.

### Información visible en los primeros 10 segundos

**Zona A — Mis tareas de hoy** (columna principal)
- Tareas con fecha de hoy, ordenadas por proyecto
- Tareas vencidas no completadas (resaltadas)
- Campo de entrada rápida: `+ Nueva tarea`

**Zona B — Estado de proyectos** (columna secundaria)
- Proyectos activos con indicador de salud (verde / amarillo / rojo)
- Rojo: sin actividad en 7+ días, o tarea bloqueada
- Amarillo: entrega en los próximos 3 días

**Zona C — Pendientes de clientes** (banda inferior o tercera columna)
- Clientes con actualizaciones de proyecto que no se han enviado aún
- Cobros vencidos o próximos a vencer

**Siempre visible (barra superior)**
- Fecha + número de semana
- Badge de notificaciones sin leer
- `⌘K` — búsqueda global

---

## 6. Flujos

### Flujo diario — director de agencia

```
09:00  Abrir "Hoy"
         → revisar tareas del día
         → identificar tareas vencidas → reprogramar o cerrar
         → verificar si algún proyecto está en rojo

Durante el día
         → ejecutar tareas → marcar completadas
         → si hay entrega → ir a Proyecto → publicar Actualización
         → si corresponde cobro → ir a Cobros → registrar

18:00  Cierre
         → revisar qué quedó pendiente
         → reprogramar para mañana
```

### Flujo semanal — lunes AM

```
1. Tareas → Vista semanal
   → usar planificador IA para distribuir la semana

2. Proyectos → revisar estado de cada uno
   → ¿hay blockers? ¿fechas de entrega esta semana?

3. Clientes → ¿actualizaciones pendientes de enviar?
   → redactar y enviar al portal

4. Cobros → ¿facturas por emitir esta semana?
   → emitir y registrar
```

### Flujo de gestión de cliente

```
Solicitud entra (WhatsApp / email)
   → Abrir Cliente
   → ¿Es una tarea nueva? → crear Tarea → asignar a Proyecto
   → ¿Es una duda sobre el portal? → revisar Actualizaciones recientes

Entrega de sprint
   → Proyectos → [proyecto] → publicar Actualización
   → cliente ve en portal automáticamente

Ciclo de cobro
   → Cobros → [proyecto] → crear cobro
   → enviar InvoiceEmail vía Resend
   → marcar como pagado cuando confirma
```

---

## 7. Decisiones de arquitectura

| Decisión | Opción descartada | Razón |
|---|---|---|
| Hoy como pantalla de inicio | Dashboard con KPIs | Los KPIs no dicen qué hacer — Hoy sí |
| Tareas como entidad top-level | Mantener bajo /asistente | La prioridad #1 del director no puede estar a 2 clicks de profundidad |
| Proyectos independientes de clientes | Proyectos solo dentro del cliente | Un proyecto es la unidad de trabajo, no el cliente |
| Cobros como módulo dedicado | Dejar en /finances collection | El cobro es un evento operativo visible, no datos internos |
| Crypto Intel fuera del OS | Mantener como módulo principal | No es operativa de agencia — contamina la jerarquía de navegación |

---

## 8. Lo que no cambia en esta versión

- El sistema de autenticación y sesiones
- El portal de clientes (`/portal`, `/[slug]/dashboard`)
- La estructura de Firestore (las colecciones se reusan)
- El Command Palette `⌘K` como método de navegación principal
- Los emails transaccionales (Resend)
- El módulo de infraestructura VPS (solo se reubica en Sistema)
