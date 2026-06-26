# Execution Workspace — Diseño del Centro de Ejecución de PixelTEC OS

**Fecha:** 2026-06-26  
**Alcance:** Sprint actual — MVP del workspace rediseñado  
**Estado:** Aprobado — listo para plan de implementación

---

## Objetivo

Crear un **Centro de Ejecución Inteligente** que acompañe al usuario durante toda una sesión de trabajo, capture el contexto del desarrollo, documente automáticamente el progreso y genere conocimiento reutilizable para el proyecto y la empresa.

**No estamos construyendo** un Pomodoro mejorado ni un cronómetro con widgets.

**Sí estamos construyendo** un workspace que responde en todo momento a una sola pregunta:

> ¿Esto me ayuda a completar un objetivo ahora mismo?

Si un elemento no responde esa pregunta, no pertenece al workspace.

---

## Principios arquitectónicos

1. **El usuario nunca debe preguntarse qué hacer después.**  
   El workspace siempre debe sugerir el siguiente paso.

2. **Todo lo importante debe quedar documentado.**  
   Al terminar una sesión debe existir suficiente contexto para retomarla días después.

3. **La IA asiste, nunca interrumpe.**  
   El usuario solicita ayuda; la IA no invade el flujo de trabajo.

4. **La captura de información debe ser más rápida que recordarla después.**  
   Registrar una observación, un bloqueo o una actividad debe tomar pocos segundos.

5. **El sistema debe crear conocimiento reutilizable.**  
   Cada sesión alimenta la bitácora del proyecto, mejora los resúmenes futuros y construye un historial útil para el equipo.

6. **El contexto siempre tiene prioridad sobre el tiempo.**  
   El cronómetro existe para dar contexto, no es el protagonista del módulo.

---

## Mental model canónico

```
Objetivos      → qué quiero lograr esta sesión
Actividades    → qué estoy haciendo ahora mismo
Observaciones  → qué aprendí / descubrí
Bloqueos       → qué me impide avanzar
```

Este flujo de arriba a abajo cuenta una historia completa de la sesión.

---

## Arquitectura del layout

El layout mantiene la división 70/30. Cambia la naturaleza de cada zona.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  MISSION CONTROL HEADER  (≤ 72px, full width)                           │
└─────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────┐  ┌────────────────────────────────────┐
│  ZONA DE TRABAJO (70%)          │  │  DEV ASSISTANT (30%)               │
│                                 │  │  Componente: ExecutionAssistant    │
│  1. SessionGoals                │  │                                    │
│  2. ActivityWorkspace           │  │  1. Contexto vivo de sesión        │
│  3. SessionObservations         │  │  2. Recordatorios                  │
│  4. BlockTracker                │  │  3. Deploy checklist               │
│                                 │  │  4. Comandos útiles                │
│                                 │  │  5. Asistente IA                   │
└─────────────────────────────────┘  └────────────────────────────────────┘
```

**Regla de responsive:** el breadcrumb puede truncarse, el timer nunca se comprime ni se mueve.

---

## Modelos de datos

### Cambios a `WorkSession`

```ts
export interface WorkSession {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  clientName: string;
  projectName: string;
  taskName: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  status: "active" | "completed";
  currentActivity?: string;
  activities: SessionActivity[];
  notes: SessionNote[];
  blockers: SessionBlocker[];
  sessionGoals?: SessionGoal[];        // NUEVO
  deployStatus?: "yes" | "no" | "na";
  commitStatus?: boolean;
  createdBy: string;
}
```

### `SessionGoal` (nuevo)

```ts
export interface SessionGoal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}
```

### `SessionActivity` (actualizado)

```ts
export interface SessionActivity {
  id: string;
  description: string;
  startedAt: string;
  completedAt?: string;
  estimatedMinutes?: number;   // NUEVO — opcional, 15 | 30 | 60
}
```

### `SessionNote` (actualizado)

```ts
export type ObservationType = "observacion" | "riesgo" | "bug" | "decision";

export interface SessionNote {
  id: string;
  type: ObservationType;           // NUEVO — reemplaza campo implícito
  content: string;
  createdAt: string;
  markedForSummary?: boolean;      // NUEVO — "➜ Añadir al resumen"
}
```

### `SessionBlocker` (actualizado)

```ts
export type BlockerStatus = "active" | "waiting" | "resolved";
export type BlockerImpact = "low" | "medium" | "high";
export type BlockerSource =
  | "technical"
  | "client"
  | "infrastructure"
  | "third_party"
  | "internal";

export interface SessionBlocker {
  id: string;
  type: BlockerType;               // sin cambios
  description: string;
  status: BlockerStatus;           // REEMPLAZA resolved: boolean
  impact: BlockerImpact;           // NUEVO
  source: BlockerSource;           // NUEVO
  createdAt: string;
  resolvedAt?: string;             // NUEVO
}
```

---

## Componentes — especificaciones

### 1. `WorkspaceHeader` — Mission Control Header

**Altura máxima:** 72px  
**Regla:** toda la información crítica legible en < 2 segundos.

**Layout:**
```
←  VillaNogal · Sitio Web · Validación de seguridad de bots    01:32:17    [Finalizar sesión]
   Trabajando desde las 6:54 PM · Alta prioridad               🟢 Activa · ● Sin bloqueos
```

**Jerarquía visual:**

| Elemento | Tamaño | Color |
|---|---|---|
| Timer `01:32:17` | 1.375rem mono bold | zinc-100 |
| `🟢 Activa` | 0.75rem | green-400 + pulse cada 5s |
| Indicador de salud | 0.7rem | zinc-500 / amber-400 / red-400 según estado |
| Breadcrumb | 0.75rem | zinc-400 |
| Línea contextual | 0.7rem | zinc-600 |
| `[Finalizar sesión]` | 0.75rem | red-400 border |

**Indicador de salud:**
- `● Sin bloqueos` (zinc-500) — 0 activos
- `● 1 bloqueo activo` (red-400) — status === "active"
- `● 1 esperando` (amber-400) — solo waiting, sin activos

**Props:**
```ts
interface WorkspaceHeaderProps {
  session: WorkSession;
  task: CRMTask;        // nuevo — para task.prio
  elapsed: number;      // segundos — lógica vive en use-work-session
  onFinalize: () => void;
}
```

**Nota:** `SessionTimer.tsx` se elimina como componente visual. La lógica del timer permanece en `use-work-session.ts` sin cambios. `WorkspaceHeader` solo recibe `elapsed: number`.

---

### 2. `SessionGoals` (nuevo componente)

**Posición:** primera sección del panel izquierdo.

**UX:**
- Sin objetivos: mensaje orientativo, no caja vacía.  
  `"Sin objetivos definidos. Agrega hasta 3 objetivos para mantener el enfoque durante esta sesión."`
- Máximo sugerido: 3 activos. Al llegar a 3, el botón muestra advertencia (no se bloquea).
- Cada ítem: checkbox + texto + botón `×` (visible en hover).
- `☑` completado: texto con `line-through` + `text-zinc-600`. Permanece visible hasta finalizar sesión.
- `completedAt` se registra al marcar.
- Botón: `+ Agregar objetivo`.

**Operaciones (requieren nuevas mutaciones en CRM context):**
- `addSessionGoal(sessionId, text)`
- `toggleSessionGoal(sessionId, goalId)`
- `removeSessionGoal(sessionId, goalId)`

---

### 3. `ActivityWorkspace` (reemplaza `CurrentActivity` + `ActivityTimeline`)

**Concepto:** la lista ES el historial. No existe "actividad actual" separada.

**Layout:**

```
ACTIVIDADES · 4 completadas · 1 en progreso
────────────────────────────────────────────

  ▶  Configurando middleware JWT              [✓ Finalizar]
     En progreso · 14 min
     (click sobre el texto para editar inline)

────────────────────────────────────────────
Hoy
────────────────────────────────────────────
  ✓  Checkout de Stripe
     13 min · Completada a las 19:16
     Estimado: 15 min · Real: 13 min

  ◎  Sesión iniciada · 18:54
────────────────────────────────────────────

[ + Iniciar nueva actividad ]
```

**Reglas:**
- La actividad en progreso siempre está pinned arriba, fuera del scroll.
- Solo puede existir **una actividad en progreso** por sesión. Si el usuario intenta iniciar otra, aparece confirm dialog: _"¿Deseas finalizar la actividad actual e iniciar una nueva?"_ `[Finalizar e iniciar]` / `[Cancelar]`.
- Historial ordenado cronológicamente inverso (más reciente primero).
- Animación 200ms al completar (`▶ → ✓`, fade).
- Edición inline al hacer click sobre el texto de la actividad en progreso. `onBlur` guarda.
- Label "Hoy" como separador de contexto.
- Si hay `estimatedMinutes`: muestra comparativa estimado vs real.

**Estimación al crear (opcional):**
```
Nueva actividad
[ Describe la actividad... ]
Estimación: ○ 15 min  ○ 30 min  ○ 1 h  ○ Sin estimar
```

---

### 4. `SessionObservations` (reemplaza `QuickNotepad`)

**Nombre en UI:** "Observaciones de la sesión"

**4 tipos de observación (botones emoji, no select):**
```
💡 ⚠ 🐞 ✅
[ Describe algo que descubriste, un riesgo, un bug o una decisión... ]
```

**Visual por tipo (borde izquierdo 2px):**
- 💡 Observación → `border-zinc-600`
- ⚠ Riesgo → `border-amber-500`
- 🐞 Bug → `border-red-500`
- ✅ Decisión → `border-green-500`

**Reglas:**
- Inmutable: sin edición, sin eliminación. Si algo cambia, se agrega una nueva observación.
- `Enter` guarda. `Shift+Enter` salto de línea.
- Hover sobre cada observación: botón `➜ Añadir al resumen` → `markedForSummary = true`.
- Las marcadas muestran un indicador visual sutil (dot cyan).
- Sin observaciones: mensaje orientativo, no caja vacía.

**Nota de diseño:** "Las observaciones son hechos, no tareas." El placeholder del input orienta al usuario hacia ese mental model.

---

### 5. `BlockTracker` (reemplaza `BlockReporter`)

**Nombre en UI:** "Bloqueos activos"

**3 estados:**

| Estado | Color | Significado |
|---|---|---|
| `active` 🔴 | red | Bloqueando ahora mismo |
| `waiting` 🟡 | amber | Espero algo externo, sigo en otro trabajo |
| `resolved` 🟢 | green | Desbloqueado |

**Transiciones:**
- `active` → `waiting` (botón: "Poner en espera")
- `active` → `resolved` (botón: "Marcar resuelto")
- `waiting` → `active` (botón: "Volvió a bloquear")
- `waiting` → `resolved` (botón: "Marcar resuelto")
- `resolved` → inmutable

**Formulario de creación:**
```
Tipo          [select existente]
Descripción   [input]
Impacto       ○ Bajo  ○ Medio  ○ Alto
Origen        ○ Técnico  ○ Cliente  ○ Infraestructura  ○ Tercero  ○ Interno
```

Copy orientativo debajo del input: `"Solo registra obstáculos que impidan avanzar por más de 2 minutos."`

**Tiempo bloqueado:** calculado en render (`createdAt` → `resolvedAt`). No persiste.

**Resueltos:** visibles al fondo, visualmente dim. No desaparecen — son historial.

**Gate al finalizar sesión:** si existen activos, `EndSessionDialog` incluye un nuevo `step: "blockers-review"` antes del checklist:
```
Todavía tienes 2 bloqueos activos.
¿Qué quieres hacer?
○ Dejarlos abiertos para la siguiente sesión
○ Marcar alguno como resuelto ahora
○ Agregar una observación
```

**Mutaciones nuevas en CRM context:** `updateBlockerStatus(sessionId, blockerId, status: BlockerStatus)`

---

### 6. `ExecutionAssistant` (reemplaza `SmartSidebar` + `SessionAICoach`)

**Nombre en UI:** "Dev Assistant"  
**Nombre de componente:** `ExecutionAssistant` — preparado para futuros workspaces (Marketing, Diseño, etc.)

**Orden fijo de secciones:**

```
DEV ASSISTANT
═══════════════════════════

🟢 Saludable            ← Session health (arriba del todo)

📍 CONTEXTO
   Proyecto · Stack · Branch
   Sesión: 1h 32m
   Objetivos: 2/3 completados
   Actividad actual: Configurando middleware JWT

───────────────────────
⚠️  RECUERDA           ← colapsable
   ...

───────────────────────
✅  DEPLOY CHECKLIST   ← colapsable
   ...

───────────────────────
💻  COMANDOS           ← colapsable
   [Copiar] para cada uno

───────────────────────
✨  ASISTENTE IA       ← última sección
   [Prompts sugeridos]
   [Input libre]
   ─── Respuesta ───
   [Copiar] [Guardar como observación] [Guardar en bitácora]
   ─── Última consulta ───
   Hace 8 min · "Genera commit message" [Repetir]

═══════════════════════════
```

**Session health (heurística, sin IA):**

```
🔴 Riesgo de deploy si cualquiera de:
   - Existen blockers con status "active"
   - Observaciones de tipo "riesgo" o "bug" con markedForSummary
   - Deploy checklist < 60% + elapsed > 90 min

🟡 Atención requerida si cualquiera de:
   - Existen blockers con status "waiting"
   - elapsed > 60 min sin actividad en progreso
   - 0 objetivos completados con elapsed > 45 min

🟢 Saludable: ninguna condición anterior
```

**Contexto vivo (data en tiempo real):**
- Proyecto + Stack: de `project.name` + `project.tech`
- Branch / Repositorio: campos opcionales de `project.tech` (texto manual por ahora). Roadmap: GitHub API.
- Sesión: `elapsed` formateado.
- Objetivos: `X/Y completados` calculado de `sessionGoals`.
- Actividad actual: `session.currentActivity`.

**Asistente IA — prompts sugeridos:**
1. Resume sesión
2. Genera commit message
3. ¿Qué sigue?
4. Detecta riesgos antes de deploy
5. Redacta bitácora del proyecto

Cada prompt es una consulta independiente a `/api/workspace/session-summary` con el contexto completo (session + goals + activities + observations + blockers).

**Respuesta de la IA — card de copiloto:**
```
━━━━━━━━━━━━━━━━━━━━━━━━
[Título del prompt]
━━━━━━━━━━━━━━━━━━━━━━━━
[Respuesta]
━━━━━━━━━━━━━━━━━━━━━━━━
[Copiar]  [Guardar como observación]  [Guardar en bitácora]
```

- "Guardar como observación": agrega `SessionNote` de tipo `"decision"` con el texto de la respuesta.
- "Guardar en bitácora": llama `crm.addProjectLogEntry` directamente.

**Última consulta:** estado local del componente, no persiste. Solo prompt + tiempo. Botón "Repetir" re-ejecuta.

---

### 7. `WorkspaceLayout` (actualizado)

Cambios:
- Recibe `task: CRMTask` como prop adicional (para pasar a `WorkspaceHeader`).
- Thread `task` a `WorkspaceHeader`.
- Reemplaza componentes eliminados por los nuevos.
- Panel izquierdo: `SessionGoals` → `ActivityWorkspace` → `SessionObservations` → `BlockTracker`.
- Panel derecho: `ExecutionAssistant` (reemplaza `SmartSidebar` + `SessionAICoach`).

---

### 8. `EndSessionDialog` (actualizado)

Nuevo step `"blockers-review"` insertado antes de `"checklist"` cuando existen blockers activos.

El resumen final de IA debe incluir:
- Objetivos cumplidos / pendientes
- Bugs encontrados (observaciones tipo `bug`)
- Decisiones (observaciones tipo `decision`)
- Riesgos abiertos (observaciones tipo `riesgo` o blockers)
- Bloqueos con tiempo bloqueado
- Siguiente paso recomendado

---

## Mapa de cambios

| Archivo actual | Acción | Archivo nuevo |
|---|---|---|
| `WorkspaceHeader.tsx` | Rediseño completo | `WorkspaceHeader.tsx` |
| `SessionTimer.tsx` | Eliminar visual, mantener lógica en hook | *(eliminado)* |
| `CurrentActivity.tsx` | Eliminar | *(eliminado)* |
| `ActivityTimeline.tsx` | Eliminar | *(eliminado)* |
| `QuickNotepad.tsx` | Reemplazar | `SessionObservations.tsx` |
| `BlockReporter.tsx` | Reemplazar | `BlockTracker.tsx` |
| `SmartSidebar.tsx` | Fusionar en nuevo | *(eliminado)* |
| `SessionAICoach.tsx` | Fusionar en nuevo | *(eliminado)* |
| — | Nuevo | `SessionGoals.tsx` |
| — | Nuevo | `ActivityWorkspace.tsx` |
| — | Nuevo | `ExecutionAssistant.tsx` |
| `WorkspaceLayout.tsx` | Actualizar orchestración | `WorkspaceLayout.tsx` |
| `EndSessionDialog.tsx` | Agregar step blockers-review + resumen mejorado | `EndSessionDialog.tsx` |
| `use-work-session.ts` | Agregar handlers de goals y blockerStatus | `use-work-session.ts` |
| `types/session.ts` | Actualizar todos los tipos | `types/session.ts` |
| `app/api/workspace/session-summary/route.ts` | Enriquecer con nuevos campos y prompts | `route.ts` |

---

## Fuera de alcance — MVP

- **Modo Focus:** pantalla minimalista (solo timer + objetivos + actividad). El layout actual lo soporta con CSS. Se diseñará en Sprint futuro.
- **Integración GitHub en tiempo real:** branch/commits detectados automáticamente.
- **Validación IA de observaciones en tiempo real:** detección de "esto parece una tarea, no una observación".

---

## Roadmap evolutivo

### Fase 2
- Integración con GitHub (branch, commits, PRs).
- Detección automática de cambios mediante Git.
- Checklist dinámico según stack detectado.
- Resumen IA enriquecido con diff de Git.

### Fase 3
- Modo Focus (ocultar sidebar y distracciones).
- Música ambiental.
- Pausas inteligentes.
- Detección de inactividad mejorada.
- Recuperación de sesión interrumpida.

### Fase 4
- Execution Assistant multimodal.
- Lectura del repositorio.
- Revisión automática antes del deploy.
- Generación automática de changelog.
- Riesgos detectados por IA antes del deploy.

### Fase 5
- Métricas personales:
  - Horas por cliente
  - Tiempo por tipo de tarea
  - Frecuencia de bloqueos
  - Objetivos completados
  - Productividad semanal
  - Tiempo bloqueado vs tiempo productivo
