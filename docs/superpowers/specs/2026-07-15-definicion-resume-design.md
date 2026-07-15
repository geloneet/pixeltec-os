# Retomar "Definición de Proyecto" desde la ficha del cliente

**Fecha:** 2026-07-15 · **Aprobado por:** Miguel (CEO) · **Estado:** diseño aprobado, spec para revisión

## Contexto

El pipeline de "Definición de Proyecto" (4 estaciones: boceto → funciones → mvp →
flujo) ya persiste el avance en base de datos con cada generación de IA — nada se
pierde al refrescar dentro del wizard. El hueco real está en otro lado: la pestaña
**Proyectos** de la ficha de un cliente (`ProyectosTab.tsx`) solo ofrece el botón
"Nuevo Proyecto", sin mostrar las definiciones que ya se empezaron con ese cliente. Si
Miguel se sale de una definición a medias, siente que "se perdió" aunque siga intacta.

Sí existe un listado global (`/proyectos/definicion`, vía `listDefinitionsByOwner`) con
badge Completo/Borrador/estación actual — pero no está conectado a la ficha del
cliente, y no ofrece "continuar" desde ahí.

Se cubren además dos huecos de autoguardado descubiertos en la misma investigación:

- `NewDefinitionForm.tsx` (formulario "Nueva definición", **antes** de que exista fila
  en BD): si el navegador se cierra o recarga antes de pulsar "Guardar borrador" /
  "Comenzar definición", el texto escrito se pierde por completo.
- `DraftEditor.tsx` (la definición ya existe en BD con `status: "draft"`): solo
  guarda al pulsar "Guardar borrador" explícito; no hay autoguardado en background.

## Alcance

1. Mostrar en `ProyectosTab` las definiciones existentes del cliente (no solo los
   proyectos CRM).
2. Cuando haya ≥1 definición sin terminar, ofrecer "continuar" en vez de forzar
   "Nuevo Proyecto".
3. Autoguardado silencioso en los dos formularios de definición, con el mecanismo que
   corresponde a si la fila ya existe en BD o no.

## Enfoque técnico

**Enfoque recomendado — reutilizar patrones ya existentes**, dos piezas de
autoguardado separadas porque el formulario nuevo y el editor de borrador están en
momentos distintos del ciclo de vida de la fila:

- **Lista en ficha del cliente**: query nueva `listDefinitionsByClient(clientId)`,
  hermana de la ya existente `listDefinitionsByOwner` (`src/lib/db/repos/definitions.ts:118`),
  mismo shape (`DefinitionListItem`, join con `clients` para el nombre) pero
  filtrando por `projectDefinitions.clientId` en vez de `ownerId` — ya indexado
  (`project_definitions_client_idx`, `schema.ts:1593`).
- **Autoguardado del formulario "Nueva definición"** (fila no existe todavía en BD):
  `localStorage` del navegador mientras se escribe, sin tocar el servidor. Evita
  ensuciar el listado con definiciones vacías huérfanas (alternativa descartada: crear
  la fila desde el primer keystroke — más "pura" pero deja basura cada vez que alguien
  abre el formulario y se arrepiente).
- **Autoguardado del editor de borrador** (fila ya existe, `status: "draft"`):
  autoguardado server-side con debounce, reusando `updateDraftAction` que ya existe
  (`src/app/(admin)/proyectos/definicion/actions.ts:122`) — no hace falta acción nueva.

Enfoque mixto aprobado por Miguel: localStorage antes de que exista la fila,
autosave server-side después.

## Diseño

### 1. Flujo de datos

`ProyectosTab.tsx` (`src/components/crm/workspace-tabs/ProyectosTab.tsx`) es
`"use client"` y hoy solo recibe `client: CRMClient` (proyectos del CRM vía props, sin
fetch propio). Se le agrega un `useEffect` al montar que llama a un server action
nuevo `listClientDefinitionsAction(clientId)`
(`src/app/(admin)/proyectos/definicion/actions.ts`), que delega a
`listDefinitionsByClient(clientId)` (repo nuevo, mismo archivo que
`listDefinitionsByOwner`). Mismo patrón de fetch-on-mount que ya usa `ContratosTab.tsx`
(`loadContracts` vía `useCallback` + `useEffect(() => { loadContracts() }, [...])`,
`ContratosTab.tsx:89-100`) — no existe hoy en `ProyectosTab`, se introduce ahí.

`listClientDefinitionsAction` escopa por `ownerId` autenticado (vía `requireAuth()`,
mismo patrón que el resto de `actions.ts`) además de por `clientId`, para no filtrar
definiciones de otro owner aunque compartan cliente.

### 2. Componentes a tocar

- **`ProyectosTab.tsx`**: nueva sección "Definiciones" arriba de la grilla de
  proyectos CRM existente. Cada fila = título, `DefinitionStatusBadge`, estación
  actual (`getStationMeta(currentStation).stepLabel`), fecha relativa
  (`formatDistanceToNow`, ya importado), link a `/proyectos/definicion/[id]`.
  Si la lista viene vacía (fetch aún no resuelve, o el cliente no tiene
  definiciones), la sección no se renderiza — no hay estado vacío dedicado.
- **Botón "Nuevo Proyecto"**: si hay ≥1 definición con `status !== "completed"`, el
  botón principal cambia a "Continuar `<título>`" (usa la más reciente por
  `updatedAt` si hay varias) y apunta directo a `/proyectos/definicion/[id]`; el link
  "Nuevo Proyecto" se degrada a un link secundario más chico (texto plano, sin el
  estilo de botón primario) para permitir iniciar una segunda definición en paralelo
  si de verdad se quiere. Si no hay ninguna sin terminar, el botón queda igual que hoy.
- **`DefinitionStatusBadge`** (componente nuevo, `src/components/definition/`): extrae
  el badge de tres estados (Completo/Borrador/estación) hoy repetido inline en
  `proyectos/definicion/page.tsx:48-75` (`completed` / `isDraft` / estación con
  `meta.stepLabel`). Se usa en ambos listados (`ProyectosTab` y la página global) para
  no duplicar la lógica de tres estados dos veces. La página global se refactoriza
  para consumirlo, sin cambio visual.

### 3. Autoguardado — `NewDefinitionForm.tsx` (sin fila en BD todavía)

`useEffect` que persiste `{title, brainDump}` en `localStorage` (key
`definicion-draft-${clientCrmId}`, escopada por cliente) con debounce corto (~500ms)
en cada cambio de `title`/`brainDump`. Al montar, si existe una entrada guardada para
ese `clientCrmId`, se restaura como valor inicial de los `useState` (en vez de string
vacío). Se limpia la entrada de `localStorage` al hacer submit exitoso
(`createDefinitionAction` con `r.success`) en cualquiera de los dos botones
("Guardar borrador" / "Comenzar definición") — evita que un draft viejo reaparezca
tras crear la definición.

### 4. Autoguardado — `DraftEditor.tsx` (fila ya existe, `status: "draft"`)

`useEffect` con debounce (~1.5s de inactividad tras el último cambio en
`[title, brainDump]`) que llama a `updateDraftAction` automáticamente cuando
`valid` es `true` — sin toast (silencioso), para no interrumpir mientras se escribe.
El toast "Borrador guardado" queda reservado solo para el clic explícito en el botón
"Guardar borrador" (`saveDraft()`, sin cambios). El autoguardado en background reusa
`updateDraftAction` tal cual existe hoy — no hace falta acción ni endpoint nuevo.

### 5. Manejo de errores

- Fallo al listar definiciones en `ProyectosTab` (`listClientDefinitionsAction`): no
  bloquea la pestaña; la sección "Definiciones" simplemente no aparece y se hace
  `console.error` — mismo criterio que otros fetches silenciosos del panel (p. ej.
  `ContratosTab` no muestra error visible si `loadContracts` falla en el mount inicial).
- Fallo del autoguardado server-side en background (`updateDraftAction` disparado por
  el debounce de `DraftEditor`): silencioso, sin toast — se reintenta solo en el
  próximo debounce (siguiente cambio del usuario). El guardado explícito por clic
  sigue mostrando error si falla, para no ocultar un problema real justo cuando el
  usuario decide avanzar.
- `localStorage` no disponible (modo privado, cuota excedida): `try/catch` silencioso
  alrededor de `getItem`/`setItem`/`removeItem`; nunca rompe el formulario ni bloquea
  el submit normal a BD.

### 6. Testing

- `listDefinitionsByClient`: test de repo — filtra por el cliente correcto (no trae
  definiciones de otro cliente del mismo owner), orden por `updatedAt desc`.
- `listClientDefinitionsAction`: test de autorización — solo devuelve definiciones del
  `ownerId` autenticado aunque el `clientId` pertenezca a otro owner.
- `DefinitionStatusBadge`: test de snapshot/render para los 3 estados (completed /
  draft / estación intermedia con su `stepLabel`).
- Debounce de `DraftEditor`: test con fake timers — confirma que `updateDraftAction`
  se llama tras la pausa de inactividad y no en cada keystroke; que un keystroke nuevo
  reinicia el temporizador.
- Manual en dev (9002): abrir un cliente con una definición sin terminar → aparece en
  "Definiciones" y el botón dice "Continuar `<título>`"; escribir en el formulario
  nuevo, recargar sin guardar → el texto vuelve; escribir en un borrador existente,
  esperar sin tocar el botón, recargar → el cambio persistió.

## Fuera de alcance

- Editar o eliminar una definición desde la lista embebida en `ProyectosTab` (solo
  navega al detalle — cualquier acción se hace ahí, como hoy).
- Cambiar el listado global `/proyectos/definicion` más allá de reusar
  `DefinitionStatusBadge` (sin cambio de comportamiento ni de datos mostrados).
- Sincronizar el autoguardado entre pestañas/dispositivos abiertos en simultáneo
  (localStorage es por navegador; el server-side de `DraftEditor` último-en-escribir-gana,
  sin merge).
- Notificaciones o avisos de "definición abandonada" — esta spec solo resuelve
  visibilidad + no perder texto sin guardar, no recordatorios proactivos.

## Auto-revisión

- **Consistencia con patrones existentes**: la lista nueva espeja
  `listDefinitionsByOwner` línea por línea (mismo shape `DefinitionListItem`, mismo
  join), el fetch-on-mount espeja `ContratosTab.loadContracts`, y el autoguardado
  server-side reusa `updateDraftAction` sin tocar el repo de escritura — cero acciones
  ni endpoints nuevos fuera de `listClientDefinitionsAction`. Riesgo bajo de romper
  algo existente porque no se modifica ninguna función de escritura ya en uso
  (`createDefinition`, `updateDraft`, `sealStation`, etc. quedan intactas).
- **Riesgo de datos**: ninguna migración de esquema — todo lee columnas/índices que ya
  existen (`project_definitions_client_idx`). El único cambio de comportamiento
  observable en BD es un `updateDraft` adicional disparado por el debounce en vez de
  solo por clic explícito; `updateDraft` ya es idempotente y valida `status === "draft"`
  server-side (`definitions.ts:266`), así que no hay riesgo de escribir sobre una
  definición ya iniciada.
- **Ambigüedad resuelta**: "definición sin terminar" para decidir el botón
  "Continuar" se define como `status !== "completed"` (incluye `draft` e
  `in_progress`), y se usa la de `updatedAt` más reciente si hay varias — no estaba
  explícito en la aprobación previa, se deja anotado aquí para que Miguel lo confirme
  o corrija en la revisión de esta spec.
- **Placeholder pendiente de decidir**: el copy exacto del link secundario "Nuevo
  Proyecto" degradado (¿"Nuevo Proyecto" a secas, o algo como "Empezar otra
  definición"?) se deja para implementación — no cambia el diseño, es texto de UI.
- **Fuera de alcance explícito revisado**: no toca `reopenStation`/`sealStation`/flujo
  comercial (contratos, propuestas) — la spec de notificaciones del mismo día
  (`2026-07-15-notificaciones-propuesta-y-retiro-telegram-design.md`) ya cubre avisos
  de decisión de propuesta; esta spec no se superpone con esa.
