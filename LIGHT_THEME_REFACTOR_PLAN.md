# LIGHT_THEME_REFACTOR_PLAN.md

**Estado:** ✅ Fases 1–9 completas y verificadas (2026-07-14). Las 9 fases se ejecutaron con subagentes dedicados (lint + typecheck + vitest en verde en cada dispatch), más una revisión final de todo el rango (`9fe5567..HEAD`, agente en Opus) que encontró y cerró un hallazgo Importante (badges de estado con contraste bajo en ~10 archivos). Sin regresiones en tema oscuro confirmadas. Commits locales en `main`, pendientes de push/deploy con confirmación aparte.
**Alcance:** Dashboard de PixelTEC OS (`src/app/(admin)/**`, `src/components/**` excepto el sitio público de marketing y el Portal de Cliente — este último deliberadamente fijo en oscuro, ver `globals.css`).
**Excepciones aceptadas y documentadas** (no son deuda): `logs-sheet.tsx`, `ServerView.tsx` (visor de logs) y `KnowledgeMarkdown.tsx` (bloque de código) mantienen fondo oscuro fijo — convención de terminal/código, igual en ambos temas por diseño. Acentos de marca (cyan) y semánticos (verde/ámbar/rojo) sin variante `dark:` en iconos, hovers y CTAs — precedente establecido esta sesión.

---

## 1. Diagnóstico

### Qué está mal

El Design System **sí existe** y su fundación es sólida: variables CSS en `src/app/globals.css` (`:root` = claro, `.dark` = oscuro), mapeadas a clases Tailwind semánticas en `tailwind.config.ts` (`darkMode: ['class']`), servidas por un único mecanismo de tema (`next-themes` vía `src/components/theme-provider.tsx`, sin contexto competidor). El problema no es la fundación — es que **la mayoría de las pantallas nunca la consumen**. En su lugar, cada pantalla reimplementa su propia jerarquía visual a mano con la paleta cruda de Tailwind (`zinc-100` a `zinc-950`), afinada visualmente para verse bien sobre un fondo casi negro. Esas clases no reaccionan al toggle — son valores fijos — así que cuando el usuario cambia a claro, esas pantallas se quedan literalmente iguales, y el resultado (texto casi blanco sobre fondo casi blanco, tarjetas en gris translúcido) es el que reportaste.

### Tres patrones compitiendo, no uno

1. **Correcto (tokens semánticos)** — `bg-card`, `text-foreground`, `border-border`, etc. Reacciona al tema. **15.8% de los archivos** lo usan.
2. **Legacy (paleta cruda con opacidad)** — `bg-zinc-900/40`, `text-zinc-300`, `border-white/[0.06]`, `bg-black/60`. No reacciona al tema; diseñado para un fondo casi negro, se "lava" a gris sobre fondo claro. **34.6% de los archivos** lo tiene (168 de 486); **20.2%** específicamente usa la variante con opacidad (la más dañina, la que causó el bug de `/hoy`).
3. **Tercer patrón, inconsistente (`dark:` + colores literales)** — `dark:bg-black/50`, `dark:text-cyan-400`, mezclando el prefijo `dark:` de Tailwind con valores hardcodeados en vez de tokens. **23 archivos (4.7%)**, concentrado casi por completo en los componentes de marketing del sitio público (no en el dashboard admin) — pero confirma que ha habido dos estrategias de tematización desarrollándose en paralelo sin coordinación.

**15 archivos (3.1%)** están a medio migrar (tienen ambos patrones a la vez — el estado más confuso de todos: partes reaccionan al tema, partes no).

### Componentes que están rompiendo el tema (los de mayor severidad, por número de clases hardcodeadas)

| Componente | Archivo | Hits | Área reportada |
|---|---|---|---|
| `ServerView` | `src/components/crm/ServerView.tsx` | **44** | CRM/Proyectos |
| `ProjectView` | `src/components/crm/ProjectView.tsx` | **35** | CRM/Proyectos — "cards oscuras" |
| `ContactPanel` | `src/components/whatsapp-inbox/ContactPanel.tsx` | **27** | WhatsApp (no reportado, hallado en la auditoría) |
| `cobros-view` | `src/components/cobros/cobros-view.tsx` | **18** | Finanzas — "cards negras, filtros negros" |
| `BotConfigView` | `src/components/whatsapp-inbox/BotConfigView.tsx` | **18** | WhatsApp |
| `EndSessionDialog` | `src/components/workspace/EndSessionDialog.tsx` | **16** | Workspace/Sesiones |
| `IATemplateEditor` | `src/components/ia/IATemplateEditor.tsx` | **11** | Centro IA — "contenedor gris, tabs sin jerarquía" |
| `RecordPaymentDialog` | `src/components/cobros/RecordPaymentDialog.tsx` | **9** | Finanzas |
| `ia-factory/page.tsx` | shell de Centro IA | **9** | Centro IA |
| **`toast.tsx`** | `src/components/ui/toast.tsx` | — | **Toda la app** — ver abajo |

### El hallazgo más importante: un bug de fundación, no solo de pantallas

`src/components/ui/toast.tsx` (la primitiva shadcn que dibuja **todas** las notificaciones toast de todo el sistema) está **100% hardcodeada** a una paleta oscura de vidrio esmerilado (`bg-zinc-950/85`, `text-zinc-50/200/400/500`, `border-white/10`) y **no tiene ni una sola clase `dark:`**. Esto significa que cada notificación toast en toda la aplicación se ve igual (oscura) sin importar el tema — el único componente de fundación realmente roto, y el que más apalancamiento tiene arreglar primero porque una sola corrección arregla toasts en las ~486 pantallas que los usan.

Relacionado: los overlays de modal (`bg-black/80`) están hardcodeados de forma idéntica en `alert-dialog.tsx`, `dialog.tsx` y `sheet.tsx` — el valor por defecto del scaffold de shadcn, nunca actualizado a un token.

### Deuda técnica adicional encontrada

- **Archivos que yo mismo marqué como "ya migrados" en la ronda anterior todavía tienen residuos**: `ProyectosTab.tsx` (8 hits), `DiscoveryTab.tsx` (7 hits), y el propio dashboard de VPS (7 hits repartidos). La migración pantalla-por-pantalla dejó huecos incluso donde creí haber terminado — es exactamente el riesgo que señalaste al pedir parar los fixes aislados.
- `src/components/ui/animated-menu.tsx` reimplementa `cn()` localmente en vez de importar el compartido — inconsistencia menor, sin riesgo funcional.
- 10 archivos usan `style={{ color/background }}` inline — un cuarto mecanismo que evita Tailwind por completo (`ToolsView.tsx`, `ClientsView.tsx`, `ProjectTaskCard.tsx`, `ClientDetail.tsx`, `TodayView.tsx`, `ToolDetailView.tsx`, `ProjectView.tsx`, `SessionTasksPanel.tsx`, `proposal-client.tsx`, `crecimiento/brand-brain/[brandId]/page.tsx`).
- No existe un componente `StatCard`/`DataTable`/`FilterBar` compartido — cada pantalla reimplementa su propia tarjeta/tabla/filtro desde cero, lo que explica por qué el mismo error se repitió tantas veces en vez de vivir en un solo lugar.
- `src/components/ui/shiny-button.tsx` es una **excepción documentada e intencional** (el código ya trae un comentario explicando que el botón CTA debe verse negro/blanco en ambos temas por identidad de marca) — no es deuda, hay que preservarlo tal cual.

### Qué porcentaje ya usa tokens correctamente

| Capa | % correcto |
|---|---|
| Fundación (tokens CSS + Tailwind config) | **100%** — bien diseñada, sin cambios necesarios |
| Primitivas UI (`components/ui/`, las 36 de shadcn) | **89%** (32/36) — sólo `toast.tsx` y los 3 overlays de modal |
| Todo el árbol de componentes/pantallas del dashboard | **15.8%** (77/486 archivos) |
| — de las pantallas de dominio ya migradas manualmente esta semana | ~92% correctas, con residuos puntuales (ver arriba) |
| — del resto del dashboard (nunca tocado) | **34%** (91/137 archivos) tiene el anti-patrón activo |

**Conclusión del diagnóstico**: no hay que rediseñar el sistema de tokens — hay que terminar de adoptarlo. La fundación es correcta; lo que falta es disciplina de migración con una fundación arreglada primero (toast + overlays) y después un barrido sistemático de la capa de dominio, en vez de arreglar pantalla por pantalla sin un mapa.

---

## 2. Inventario completo

### Nivel 1 — Fundación (no son "componentes", son la base)
| Elemento | Archivo | Estado |
|---|---|---|
| Variables CSS (temas claro/oscuro) | `src/app/globals.css` | 🟩 Certificado |
| Mapeo Tailwind → tokens | `tailwind.config.ts` | 🟩 Certificado |
| Proveedor de tema | `src/components/theme-provider.tsx` | 🟩 Certificado |
| Botón de cambio de tema | `src/components/theme-toggle.tsx` | 🟩 Certificado |

### Nivel 2 — Primitivas UI (`src/components/ui/`, 36 componentes shadcn)
| Componente | Estado | Nota |
|---|---|---|
| Button, Card, Input, Badge, Tabs, Table, Select, Switch, Textarea, Checkbox, Radio Group, Popover, Avatar, Skeleton, Separator, Label, Progress, Slider, Tooltip, Accordion, Calendar, Carousel, Chart, Collapsible, Command, Dropdown Menu, Form, Menubar, Scroll Area, Spinner, Toaster, WavePath | 🟩 Certificado | Sin clases hardcodeadas |
| Alert | 🟨 Migrado (nota menor) | Un `dark:border-destructive` (override sobre un token, no un color crudo) |
| Alert Dialog, Dialog, Sheet | 🟨 Migrado (nota menor) | `bg-black/80` en el overlay — mismo valor por defecto de shadcn en los 3, nunca actualizado a token |
| **Toast** | ⬜ Pendiente — **prioridad 1** | 100% hardcodeado, cero clases `dark:`, afecta toda la app |

### Nivel 3 — Superficies compartidas (chrome de navegación)
| Componente | Estado |
|---|---|
| TopNavigation, SecondaryNavigation, UserMenu, NotificationsMenu, CommandPalette | 🟩 Certificado |
| CmdKDialog | 🟩 Certificado (código muerto, nunca se renderiza — no urgente) |
| Shell / layout admin (`(admin)/layout.tsx`) | 🟩 Certificado |

### Nivel 4 — Componentes de dominio reutilizables (bloques pequeños, usados dentro de vistas más grandes)
| Componente | Archivo | Estado |
|---|---|---|
| ProjectTaskCard | `src/components/crm/ProjectTaskCard.tsx` | ⬜ Pendiente (6 hits) |
| IATemplateCard | `src/components/ia/IATemplateCard.tsx` | ⬜ Pendiente (3 hits) |
| BrandBrainCard | `src/components/growth/brand-brain/BrandBrainCard.tsx` | ⬜ Pendiente |
| ConnectedAccountCard | `src/components/growth/publisher/ConnectedAccountCard.tsx` | ⬜ Pendiente |
| PortalTab (dentro de ClientWorkspace) | `src/components/crm/workspace-tabs/PortalTab.tsx` | 🟩 Certificado |

### Nivel 5 — Vistas compuestas / pantallas grandes, por área

**CRM / Proyectos**
| Componente | Estado |
|---|---|
| ProjectView | ⬜ Pendiente (35 hits — prioridad alta) |
| ServerView | ⬜ Pendiente (44 hits — prioridad alta, el más denso del repo) |
| ProjectBitacora | ⬜ Pendiente (4 hits) |
| ClientsView, ToolsView, ToolDetailView | ⬜ Pendiente |
| ClientWorkspace, ClientDetail, workspace-tabs/* (Propuesta, Contratos, Discovery, Facturación, Estrategia, Portal) | 🟩 Certificado (Discovery/Proyectos con residuos menores, ver §Deuda técnica) |

**Finanzas**
| Componente | Estado |
|---|---|
| cobros-view | ⬜ Pendiente (18 hits — prioridad alta, "filtros negros") |
| RecordPaymentDialog | ⬜ Pendiente (9 hits) |

**Centro IA**
| Componente | Estado |
|---|---|
| ia-factory/page.tsx (shell) | ⬜ Pendiente (9 hits — "contenedor gris") |
| IATemplateEditor | ⬜ Pendiente (11 hits) |
| BienvenidaGenerator | ⬜ Pendiente (6 hits) |

**Workspace / Sesiones** (12 archivos)
| Componente | Estado |
|---|---|
| EndSessionDialog | ⬜ Pendiente (16 hits, el más denso del área) |
| ExecutionAssistant, SessionObservations, ActivityWorkspace, BlockTracker | ⬜ Pendiente (12–15 hits c/u) |
| WorkspaceHeader, SessionGoals, FocusGuard, SessionHistory, SessionTimeline | ⬜ Pendiente (4–5 hits c/u) |
| SessionTasksPanel, WorkspaceLayout | ⬜ Pendiente (1–2 hits, casi listos) |

**WhatsApp Inbox** (módulo completo sin migrar)
| Componente | Estado |
|---|---|
| ContactPanel | ⬜ Pendiente (27 hits) |
| BotConfigView | ⬜ Pendiente (18 hits) |
| ChatThread | ⬜ Pendiente (12 hits) |
| ConversationList, InboxShell, Composer, ModeToggle, WhatsAppModule | ⬜ Pendiente (1–7 hits c/u) |

**Growth (Brand Brain / Campañas / Content Studio)**
| Componente | Estado |
|---|---|
| CampaignDetail, Step5Visual, Step4Voice, CalendarGrid, GeneratedPostView, PostGeneratorForm y ~13 más | ⬜ Pendiente (1–7 hits c/u, severidad media-baja) |
| CreditBalance | 🟩 Certificado |

**Definición de Proyecto**
| Componente | Estado |
|---|---|
| DefinitionWorkspace, DraftEditor, SealedStationView, NewDefinitionForm, DefinitionSummary, DefinitionStepper, StationComposer, StationThread, DefinitionAuditTrail | ⬜ Pendiente (2–5 hits c/u, severidad baja) |
| ApproveBar, CreateProposalButton | 🟩 Certificado |

**Blog Admin**
| Componente | Estado |
|---|---|
| page.tsx, post-editor-client.tsx | ⬜ Pendiente (10–11 hits) |
| nuevo-brief-form.tsx, nuevo/page.tsx, migrate-post/page.tsx | ⬜ Pendiente (1–3 hits) |

**Perfil**
| Componente | Estado |
|---|---|
| perfil/page.tsx, security-settings.tsx | ⬜ Pendiente (2–3 hits, severidad baja) |

### Nivel 6 — Dashboards / páginas de entrada
| Página | Estado |
|---|---|
| Hoy | 🟩 Certificado |
| VPS Command Center | 🟨 Migrado (7 hits residuales — ver §Deuda técnica) |

### Nota — sitio público de marketing (fuera del alcance del dashboard, mismo problema)
`src/components/ui/` también aloja 18 componentes de marketing del sitio público (hero, footer, marquee, dock, etc. — no son parte de PixelTEC OS/dashboard). Tienen el mismo problema pero con el patrón #3 (`dark:` + colores literales), liderado por `shape-landing-hero.tsx` (13 usos de `dark:`). Se documenta aquí para que quede registrado, pero **no está en el alcance de este plan** salvo autorización explícita aparte.

---

## 3. Clasificación

| Nivel | Qué incluye | Estado actual |
|---|---|---|
| **1 — Fundación** | Tokens CSS, Tailwind config, ThemeProvider/Toggle | 🟩 100% listo |
| **2 — Primitivas** | `components/ui/*` (36 componentes shadcn) | 🟨 89% listo — falta Toast + 3 overlays |
| **3 — Superficies compartidas** | Nav, chrome, shell admin | 🟩 100% listo |
| **4 — Componentes de dominio reutilizables** | Tarjetas pequeñas usadas dentro de vistas grandes (ProjectTaskCard, IATemplateCard, etc.) | ⬜ Pendiente |
| **5 — Vistas compuestas** | Pantallas grandes por área (ProjectView, cobros-view, IATemplateEditor, WhatsApp, Workspace) | ⬜ Mayormente pendiente (Clientes/Propuestas listo) |
| **6 — Dashboards** | Hoy, VPS | 🟩 Listo (con residuos menores) |
| **7 — Páginas / flujos completos** | Growth, Definición, Blog Admin, Perfil | ⬜ Pendiente (severidad baja-media) |
| **8 — QA visual** | Revisión cruzada en ambos temas, checklist de cierre | — |

---

## 4. Plan de migración

Orden propuesto: primero cerrar la fundación (apalancamiento máximo, un fix beneficia a toda la app), después los componentes de dominio pequeños y reutilizables (un fix se propaga a varias vistas), y sólo después las vistas grandes — en el orden de severidad reportada, para que las quejas concretas ("cards oscuras", "filtros negros", "contenedor gris") se resuelvan primero.

| Fase | Contenido | Por qué en este orden |
|---|---|---|
| **Fase 1 — Cerrar la Fundación** | `toast.tsx`, overlay `bg-black/80`→token en los 3 archivos, deduplicar `cn()`, limpiar residuos en VPS/ProyectosTab/DiscoveryTab | Máximo apalancamiento: toast se usa en TODA la app; cierra el trabajo "ya migrado" que quedó a medias |
| **Fase 2 — Componentes de dominio reutilizables** | ProjectTaskCard, IATemplateCard, BrandBrainCard, ConnectedAccountCard | Se usan dentro de las vistas grandes de la Fase 3+ — arreglarlos antes evita re-tocar el mismo código dos veces |
| **Fase 3 — CRM / Proyectos** | ProjectView (35), ServerView (44), ProjectBitacora, ClientsView, ToolsView | Mayor densidad de deuda + queja explícita ("cards oscuras") |
| **Fase 4 — Finanzas** | cobros-view (18), RecordPaymentDialog (9) | Queja explícita ("cards negras, filtros negros") |
| **Fase 5 — Centro IA** | ia-factory shell (9), IATemplateEditor (11), BienvenidaGenerator (6) | Queja explícita ("contenedor gris, tabs sin jerarquía") |
| **Fase 6 — Workspace / Sesiones** | EndSessionDialog y los 11 archivos restantes | Segunda área más densa, alto uso operativo diario |
| **Fase 7 — WhatsApp Inbox** | ContactPanel, BotConfigView, ChatThread y el resto del módulo | Módulo completo sin migrar, autocontenido |
| **Fase 8 — Growth + Definición + Blog Admin + Perfil** | ~35 archivos de severidad baja-media, se agrupan por ser menos críticos | Menor tráfico/urgencia, se procesan en lote |
| **Fase 9 — QA visual completa** | Recorrido de TODAS las pantallas en ambos temas, checklist final, captura de evidencia | Cierre formal antes de considerar el sistema "certificado" |

Cada fase se aprueba individualmente antes de empezar (no se ejecuta nada de esto todavía). Cada fase termina con: lint, typecheck, build, revisión visual en claro y oscuro, commit, y push sólo con tu confirmación explícita — igual que el resto de esta sesión.

---

## 5. Criterios visuales

Reglas, no colores — inspiradas en Linear/Vercel/Raycast, con identidad PixelTEC.

- **Background (fondo de página)**: el nivel más bajo de la jerarquía. Ligeramente diferenciado de las superficies que flotan sobre él — nunca debe competir visualmente con una tarjeta.
- **Surface (superficie/tarjeta)**: un paso claramente por encima del fondo. Debe leerse como "algo real que puedo tocar", nunca como una capa translúcida que deja ver lo que hay detrás.
- **Surface secondary (superficie secundaria, ej. filas dentro de una tarjeta, badges neutros)**: un paso intermedio entre transparente y la superficie principal — perceptible pero discreto, nunca al mismo nivel visual que la tarjeta que lo contiene.
- **Cards**: fondo sólido de superficie, borde de un tono, sombra mínima que solo aporta separación (no dramatismo), radio consistente con el resto del sistema. Una tarjeta nunca debe parecer deshabilitada por defecto — el estado disabled es explícito y distinto.
- **Hover**: cambio de superficie perceptible al primer vistazo pero sin saltar — un paso de intensidad, no un salto de color completo. Debe sentirse como retroalimentación, no como una alarma.
- **Selected/Active**: más marcado que hover, con un acento de marca (borde o indicador), nunca solo un cambio de fondo sutil que se pueda confundir con hover.
- **Disabled**: reducción real y consistente de opacidad/contraste sobre el elemento entero (texto e íconos incluidos), y cursor que lo comunique — nunca un color "casualmente apagado" que se confunda con un estado normal.
- **Borders**: un tono sutil que separa sin gritar. Un borde no debe ser más notorio que el contenido que delimita. Existe un nivel "subtle" para separaciones internas (ej. filas de una lista) más discreto que el borde de una tarjeta.
- **Inputs**: superficie ligeramente distinta del fondo que los rodea, borde visible en reposo (no solo al hacer focus), texto de alto contraste, placeholder claramente más tenue pero legible.
- **Focus**: anillo de acento de marca, siempre visible, consistente en todo el sistema — nunca omitido por estética.
- **Tables**: filas alternadas o separadas por borde sutil (no ambas a la vez, elegir una), encabezado con jerarquía tipográfica clara y fondo levemente distinto del cuerpo, hover de fila discreto.
- **Empty states**: texto centrado, tono secundario (nunca el tono más apagado del sistema — deben seguir siendo legibles), espacio generoso, sin simular ser un error.
- **Headers (de página/sección)**: máximo contraste disponible para el título, descripción en tono secundario legible — nunca en el tono más tenue del sistema.
- **Breadcrumbs**: tono secundario para los pasos intermedios, alto contraste solo para el paso actual, separadores discretos.
- **Filters**: misma superficie que un input o un chip según el tipo; el filtro activo se distingue con el acento de marca, no solo con un cambio de peso de fuente.
- **Chips/Badges**: sistema de color categórico (estado, tipo) independiente del tema — un chip "borrador" se ve igual de reconocible en claro y oscuro; solo cambia su superficie base, no su identidad de color.
- **Buttons**: primario = acento de marca sólido; secundario = superficie con borde; ghost/texto = sin fondo hasta hover. Los tres deben tener un estado hover y un estado disabled reales y distinguibles entre sí.
- **Alerts / Success / Warning / Danger / Info**: cada uno con su propia identidad de color reconocible en ambos temas, fondo tenue del color correspondiente (nunca el fondo genérico de tarjeta), texto del mismo color en versión de alto contraste, nunca texto blanco/negro fijo encima.
- **Skeletons / Loading**: tono de superficie apenas por encima del fondo, animación sutil — nunca oscuro fijo que rompa la coherencia del tema claro.

**Identidad PixelTEC**: el azul de marca (`#2196F3`, ya es el token `primary`/`ring` en ambos temas) es el color de interacción — enlaces activos, foco, iconos de estado activo, acentos puntuales. No se usa como color de fondo extendido en ninguna superficie grande. El resultado debe sentirse sobrio y orientado a productividad, no "azul por todos lados".

---

## 6. Tokens

**No se implementa nada de esto todavía — es la propuesta a discutir.**

La mayoría de lo solicitado **ya existe** en `globals.css`/`tailwind.config.ts`; se listan aquí mapeados para que quede explícito qué ya está cubierto y qué es genuinamente nuevo.

### Ya existen (reusar tal cual, sin crear duplicados)
| Token pedido | Token real ya existente |
|---|---|
| background | `--background` |
| foreground | `--foreground` |
| card / card-foreground | `--card` / `--card-foreground` |
| popover | `--popover` / `--popover-foreground` |
| muted / muted-foreground | `--muted` / `--muted-foreground` |
| border | `--border` |
| input | `--input` |
| accent | `--accent` / `--accent-foreground` |
| primary | `--primary` / `--primary-foreground` |
| secondary | `--secondary` / `--secondary-foreground` |
| ring | `--ring` |
| surface | ≈ `--card` (superficie principal) |
| surface secondary | ≈ `--secondary` / `--muted` (ya cubren este rol) |

### Propuestos como genuinamente nuevos (gap real detectado en la auditoría)
| Token nuevo | Para qué | Por qué hace falta |
|---|---|---|
| `--overlay` / `--overlay-foreground` | Scrim de modales/diálogos | Hoy `bg-black/80` está hardcodeado e idéntico en 3 primitivas — un token centralizado permite ajustarlo una vez y que se comporte igual en ambos temas |
| `--border-subtle` | Separadores internos más discretos que `--border` (filas de lista, divisores dentro de una tarjeta) | Hoy se resuelve con `border-white/[0.06]` (roto en claro) — no existe un nivel "más tenue que border" en el sistema actual |
| `--success` / `--success-foreground` | Estados de éxito | No existe como token formal — hoy se usa `emerald-*` crudo repetido en cada componente |
| `--warning` / `--warning-foreground` | Estados de advertencia | Igual — hoy `amber-*` crudo repetido |
| `--info` / `--info-foreground` | Estados informativos | Igual — hoy `sky-*`/`cyan-*` crudo repetido |
| `--surface-elevated` | Elementos flotantes por encima de una tarjeta (dropdowns anidados, popovers dentro de un modal) | Hoy se improvisa reutilizando `--popover` o `--card` sin criterio consistente |

`--destructive` ya cubre "danger". No se propone `foreground-secondary` como token aparte porque `--muted-foreground` ya cumple ese rol en el 100% de los casos auditados.

---

## 7. Checklist de migración

Leyenda: ⬜ pendiente · 🟨 migrado (funciona, sin certificar visualmente) · 🟩 certificado (migrado + verificado en ambos temas)

### Fundación y primitivas
- 🟩 Tokens CSS (`globals.css`)
- 🟩 Tailwind config
- 🟩 ThemeProvider / ThemeToggle
- 🟩 Button, Card, Input, Badge, Tabs, Table, Select, Switch, Textarea, Checkbox, Radio Group, Popover, Avatar, Skeleton, Separator, Label, Progress, Slider, Tooltip, Accordion, Calendar, Carousel, Chart, Collapsible, Command, Dropdown Menu, Form, Menubar, Scroll Area, Spinner, Toaster, WavePath
- 🟨 Alert (nota menor)
- 🟨 Alert Dialog, Dialog, Sheet (overlay `bg-black/80`)
- ⬜ **Toast** (prioridad 1)

### Superficies compartidas
- 🟩 TopNavigation, SecondaryNavigation, UserMenu, NotificationsMenu, CommandPalette, Shell admin

### Nivel 4 — Componentes de dominio reutilizables
- ⬜ ProjectTaskCard · ⬜ IATemplateCard · ⬜ BrandBrainCard · ⬜ ConnectedAccountCard
- 🟩 PortalTab

### Nivel 5 — CRM / Proyectos
- ⬜ ProjectView · ⬜ ServerView · ⬜ ProjectBitacora · ⬜ ClientsView · ⬜ ToolsView · ⬜ ToolDetailView
- 🟩 ClientWorkspace, ClientDetail
- 🟨 ProyectosTab, DiscoveryTab (residuos)
- 🟩 PropuestaTab, ContratosTab, FacturacionTab, EstrategiaTab

### Nivel 5 — Finanzas
- ⬜ cobros-view · ⬜ RecordPaymentDialog

### Nivel 5 — Centro IA
- ⬜ ia-factory/page.tsx · ⬜ IATemplateEditor · ⬜ BienvenidaGenerator

### Nivel 5 — Workspace / Sesiones
- ⬜ EndSessionDialog · ⬜ ExecutionAssistant · ⬜ SessionObservations · ⬜ ActivityWorkspace · ⬜ BlockTracker
- ⬜ WorkspaceHeader · ⬜ SessionGoals · ⬜ FocusGuard · ⬜ SessionHistory · ⬜ SessionTimeline
- ⬜ SessionTasksPanel · ⬜ WorkspaceLayout

### Nivel 5 — WhatsApp Inbox
- ⬜ ContactPanel · ⬜ BotConfigView · ⬜ ChatThread · ⬜ ConversationList · ⬜ InboxShell · ⬜ Composer · ⬜ ModeToggle · ⬜ WhatsAppModule

### Nivel 7 — Growth
- ⬜ ~19 archivos (CampaignDetail, CalendarGrid, PostGeneratorForm, wizard de Brand Brain, etc.)
- 🟩 CreditBalance

### Nivel 7 — Definición de Proyecto
- ⬜ DefinitionWorkspace · ⬜ DraftEditor · ⬜ SealedStationView · ⬜ NewDefinitionForm · ⬜ DefinitionSummary · ⬜ DefinitionStepper · ⬜ StationComposer · ⬜ StationThread · ⬜ DefinitionAuditTrail
- 🟩 ApproveBar, CreateProposalButton

### Nivel 7 — Blog Admin
- ⬜ page.tsx · ⬜ post-editor-client.tsx · ⬜ nuevo-brief-form.tsx · ⬜ nuevo/page.tsx · ⬜ migrate-post/page.tsx

### Nivel 7 — Perfil
- ⬜ perfil/page.tsx · ⬜ security-settings.tsx

### Nivel 6 — Dashboards
- 🟩 Hoy
- 🟨 VPS Command Center (residuos, 7 hits)

### Nivel 8 — QA
- ⬜ Recorrido visual completo, ambos temas, desktop + móvil
- ⬜ Checklist de cierre firmado

---

## 8. Evidencia por pantalla (correlación síntoma → causa técnica)

No tengo las imágenes adjuntas para incrustarlas en este documento, pero cada síntoma que describiste ya tiene una causa técnica confirmada en esta auditoría:

| Pantalla / síntoma reportado | Causa técnica confirmada |
|---|---|
| **Dashboard Hoy — contraste insuficiente** | Ya corregido en la ronda anterior (`hoy/page.tsx` + los 2 paneles). Pendiente tu confirmación visual. |
| **Proyectos — cards oscuras** | `ProjectView.tsx` (35 hits: `border-white/[0.06]` ×25, escalera `text-zinc-500→100`, `bg-zinc-900/20-40`) y `ServerView.tsx` (44 hits, el más denso del repo) |
| **CRM Discovery** | Mayormente migrado (dentro de `workspace-tabs/`), con 7 hits residuales de `border-white/[0.06]`/`[0.10]` sin limpiar |
| **Finanzas — cards negras, filtros negros** | `cobros-view.tsx` (18 hits, `border-zinc-800` ×12 en la barra de filtros — coincide exactamente con "filtros negros") + `RecordPaymentDialog.tsx` (9 hits) |
| **Centro IA — contenedor gris, tabs sin jerarquía** | `ia-factory/page.tsx` (`bg-zinc-950/40` en el contenedor principal — coincide con "contenedor gris") + `IATemplateEditor.tsx` (11 hits) |

---

## Resumen ejecutivo

- La fundación del Design System es sólida (100% tokens bien definidos, un solo mecanismo de tema). El problema es adopción, no arquitectura.
- 15.8% del árbol de componentes usa tokens correctamente hoy; 34.6% tiene el anti-patrón activo; existe un tercer patrón inconsistente (`dark:` + colores literales) en 4.7%, casi todo en el sitio público.
- Hay un bug de fundación real y de alto impacto (`toast.tsx`, cero respuesta al tema) que conviene arreglar primero porque beneficia a toda la app de una sola vez.
- Incluso el trabajo "ya migrado" de esta semana dejó residuos — confirma tu instrucción de no seguir corrigiendo pantalla por pantalla sin un mapa completo.
- Plan de 9 fases, en orden de apalancamiento y severidad reportada, cada una con su propio gate de aprobación y verificación (lint, typecheck, build, revisión visual, commit, push).

**Nada de esto se ha ejecutado.** Quedo a la espera de revisar el plan contigo y de tu aprobación fase por fase.
