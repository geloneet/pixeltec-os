# PixelBot Console — Productización UX del módulo WhatsApp (P0 frontend)

**Fecha:** 2026-07-30 · **Rama:** `feat/pixelbot-console-productization` (base `edc1429` = origin/main = prod)
**Autoridad:** instrucción de Miguel (PROMPT-MAESTRO-CLAUDE-CODE-PIXELBOT-CONSOLE.md §0). Extiende la excepción DEV-only del freeze v1.0 (2026-07-11) al frontend completo del módulo WhatsApp. **Sin deploy. Sin backend. Sin otros módulos.**

## Diagnóstico verificado

Fuentes: código (lectura directa), screenshots baseline (`evidence/pixelbot-console/baseline/`, 25 capturas, 5 viewports, datos sintéticos vía stub local del API interno).

| # | Problema (prompt §4) | Verificación |
|---|---|---|
| 1 | Modo Bot/Humano/Pausa duplicado header + ficha | Código: `ChatThread.tsx:285` y `ContactPanel.tsx:482` renderizan `ModeToggle` · screenshot 1440-thread |
| 2 | Estado de conversación duplicado header + ficha | Código+screenshot: select "Nuevo" en header y sección ATENCIÓN en ficha |
| 3 | Notas duplicadas composer + ficha | Código: `Composer` (modo Nota) + `ContactPanel` (Nota rápida) |
| 4 | Filtros ocupan demasiado alto | Screenshot 1440-inbox: 7 categorías + 5 chips operativos ≈ 220px antes de la primera conversación |
| 5 | Badges acumulados por fila | Screenshot: hasta 4 indicadores (unread, modo, estado, dot) |
| 6 | Config = grid 2 columnas de tarjetas iguales | Screenshot 1440/2560-config |
| 7 | Tono/delay/timing/escalamiento solapados | Código: `response_delay_seconds` y `timing` en secciones separadas; consumo real en pixelbot NO trazado → se presentan juntos sin unificar payload |
| 8 | Ejemplos expone prioridad numérica | Screenshot ejemplos: "prioridad 15", input crudo "0" (0–20) |
| 9 | Publicar/restaurar sin confirmación suficiente | Código `ConfigVersionsPanel`: `confirm()` nativo del navegador; sin explicación de impacto; status crudo en inglés |
| 10 | `SectionCard` duplicado | 4 copias: BotConfigView:71, ConfigVersionsPanel:11, ExamplesView:18, ContactPanel:73 (divergente) |
| 11 | Clases de color repetidas | `MODE_META` ×2 divergentes (ConversationList:15, ContactPanel:39) + labels distintos en ModeToggle:17 ("Tú" vs "Control humano") |
| 12 | Texto 10–11px | `text-[10px]`/`text-[11px]` en lista, timeline, metadata |
| 13 | Ultrawide sin límites | Screenshot 2560-config: inputs de ~1000px, sin max-width |
| 14 | Estados vacíos pobres | Screenshots sin backend: error rojo diminuto en lista; "No se pudo cargar la configuración del bot / No se pudo cargar la configuración" duplicado |

Extras detectados: typo "CONVERSACIÓNES"; `extractErrorMessage` ×3; `formatRelative` ×2; fallback `?? "BOT"` ×4.

**Fallos preexistentes del baseline `edc1429`** (criterio de aceptación 14): 15 tests en `definition/NewDefinitionForm.test.tsx` (3) y `pixelforge/NewPixelforgeForm.test.tsx` (12) — fuera del módulo WhatsApp. Warning `DYNAMIC_SERVER_USAGE` en `/blog-admin` durante build (build PASS). Todo lo del módulo WhatsApp pasa en verde.

## Alcance

**IN:** `src/components/whatsapp-inbox/**` (+ nueva subcarpeta `ui/`), este doc, evidencia. Hooks/tipos solo para presentación.
**OUT:** rutas API (contratos intactos), `components/ui/*`, otros módulos, backend PixelBot, Drizzle, deploy, Tailwind 4.

## IA objetivo (prompt §5)

`Inbox→Bandeja · Configuración del bot→Bot · Ejemplos→Entrenamiento · Versiones y playground→Pruebas(Simulador|Versiones)`.
Bot con subnav de secciones: General · Voz y estilo · Temas y límites · Captura de prospectos · Escalamiento · Horarios · Avanzado — **en un solo componente con estado de formulario compartido** (sin rutas: preserva dirty state).

## Contrato de datos (invariante)

Endpoints, contratos, shapes y nombres de campos intactos: `BotConfig` completo en PUT (incluye `response_delay_seconds` Y `timing`), `manual_priority: number` con mapeo intencional de la UI al crear (Normal=5, Alta=12, Crítica=20), `/api/whatsapp-inbox/mode` con `{phone, mode, pausedUntil?}`. Mapeo UI↔payload documentado inline en `ui/meta.ts`.

## Secuencia de commits (Fase 3)

1. `feat(whatsapp): primitives ui/ + metadata semántica única` — `ui/meta.ts` (una sola fuente modo/estado/clasificación), `WhatsAppSection`, `SemanticBadge`, `EmptyState`, `AutosaveStatus`; `extractErrorMessage`→`lib/whatsapp-inbox/errors.ts`, `formatRelative`→`time.ts`
2. `feat(whatsapp): shell PixelBot Console + navegación Bandeja/Bot/Entrenamiento/Pruebas`
3. `feat(whatsapp): bandeja con vistas rápidas + popover de filtros + chips`
4. `feat(whatsapp): header del hilo + AutomationStateMenu + composer contextual`
5. `feat(whatsapp): ficha tabulada Perfil/Bot/Actividad sin controles duplicados`
6. `feat(whatsapp): configuración por secciones con subnav y ancho legible`
7. `feat(whatsapp): entrenamiento con dialog de alta e importancia semántica`
8. `feat(whatsapp): pruebas con subtabs simulador/versiones y confirmaciones`
9. `feat(whatsapp): pasada responsive + accesibilidad`
10. `refactor(whatsapp): limpieza de duplicación residual`

Cada commit: tests dirigidos + typecheck + screenshot + diff revisado.

## Riesgos y rollback

- `BotConfigView` (879 líneas): refactor por secciones manteniendo su test en verde en cada paso; el form state no se fragmenta.
- Filtros: la presentación cambia, el conjunto de filtros se preserva 1:1 (test de regresión en `ConversationList.test.tsx`).
- Rollback: rama aislada; `git switch main` desactiva todo; evidencia before/after para comparar.

## Matriz de tests (prompt §12) — resumen

Bandeja (filtros preservados, búsqueda, teclado, empty/error) · Automatización (todas las transiciones, error API, bloqueo por request en vuelo, labels) · Composer (CTA bot activo→takeover, nota nunca envía, Enter/Shift+Enter, ventana cerrada) · Ficha (tabs, acciones de negocio, resolve/archive en menú secundario, drawer móvil) · Config (carga, dirty, discard, save, payload íntegro, navegación de secciones) · Entrenamiento (empty, dialog, validación, importancia→manual_priority, toggle optimista) · Pruebas (simulación, publish/rollback confirm, status traducido).

## Criterios de aceptación

Los 17 de prompt §13. Dictamen `PASS` solo con todos; si no, `ITERATE`.

## Backlog NO implementado

**P1** (requieren backend/API): plantillas aprobadas + selector fuera de 24h · sync/estado de plantillas · adjuntos/media · quick replies/macros · usuarios/equipos y asignación real ("Mías") · snooze · vistas guardadas · menciones en notas · editar/duplicar/eliminar ejemplos · knowledge sources · test cases batch · diff/notas de versión · health real de Meta/canal · onboarding checklist · SLA/métricas · convertir conversación en ejemplo.
**P2:** multi-tenant control plane · billing · cuotas · RBAC por workspace · round-robin · broadcasts/campaigns · flow builder · WhatsApp Flows · multi-number/omnichannel · analytics avanzada.
Criterio de activación: cada P1 se activa cuando exista su contrato en pixelbot (endpoint + shape versionado); ninguno se simula en UI.

## Entorno de validación local

Postgres local `pixeltec-os-db` (127.0.0.1:5437) + stub del API interno de PixelBot en `127.0.0.1:3998` (datos sintéticos; script en scratchpad de la sesión, fuera del repo). `EGRESS_INTERNAL_MODE=allowlist` con `pixelbot:127.0.0.1:3998`. El envío real (`send_message`) permanece bloqueado fuera de producción por el guard — comportamiento correcto.
