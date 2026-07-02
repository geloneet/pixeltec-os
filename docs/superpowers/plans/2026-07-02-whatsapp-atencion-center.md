# WhatsApp Centro de Atención — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el módulo `/whatsapp` en un centro de atención funcional: filtros y búsqueda de conversaciones, clasificación de contactos, panel lateral de contacto, notas internas, estados de conversación, pausa temporal del bot, y configuración editable del comportamiento del bot desde el dashboard.

**Architecture:** Se respeta la arquitectura existente en 3 capas: (1) **PixelBot SQLite = source of truth** del comportamiento del bot (modo, pausa temporal, configuración) — se extiende con 2 migraciones y 2 endpoints internos; (2) **Firestore `/tenants/**` = proyección write-only del bot** — gana campos `pausedUntil` y `suggestedClassification` vía el writer `update_conversation` existente (merge, no rompe nada); (3) **datos de atención propiedad del dashboard** (contacto, clasificación, tags, estado de conversación, notas, historial) viven en una colección NUEVA `whatsappContacts/{phoneE164}` escrita con client SDK + rules auth (mismo criterio que `tickets`/`finances`) — el bot jamás la toca, la UI mergea por teléfono. Las quick actions CRM reutilizan `useCRM()` (blob `crm_data/{uid}`), que es el sistema CRM activo.

**Tech Stack:** PixelBot: Python 3.11+/FastAPI/SQLAlchemy async/pytest (tests SIEMPRE en Docker `python:3.12-slim` — host tiene 3.10). PixelTEC OS: Next.js 15 App Router, Firebase client SDK realtime, shadcn/ui (existen `tabs, dropdown-menu, select, popover, badge, textarea, switch, input, label`), sonner, lucide-react, Tailwind dark zinc/cyan.

## Global Constraints

- **Dos repos:** Parte Bot en `/home/ubuntu/pixelbot`, Parte OS en `/home/ubuntu/pixeltec-os`. Commits en cada repo, rama main.
- **NUNCA deploy ni `firebase deploy` sin autorización explícita de Miguel.** Producción del bot corre en el contenedor `pixelbot` — no tocarlo.
- **Tests pixelbot:** `docker run --rm -v /home/ubuntu/pixelbot:/work -w /work python:3.12-slim bash -c "pip install -q -r requirements.txt && python -m pytest -p no:cacheprovider -q"` (~94 tests base, ~1286 warnings pre-existentes que se ignoran).
- **Gates OS:** `npm run typecheck` 0 errores + `npm run lint` 0 errores nuevos (hay 21 errores pre-existentes ajenos) en cada task.
- **No romper flujos existentes:** el flujo webhook→brain→send, los modos BOT/HUMAN/PAUSED, `/internal/send`, `/internal/conversations/mode` y la UI actual del inbox siguen funcionando igual cuando la config nueva no existe (defaults = comportamiento actual).
- **UI:** español, dark theme actual (fondo `#030303`, zinc/cyan/emerald/amber), sin modales salvo confirmaciones destructivas — preferir paneles, tabs custom (patrón `ClientWorkspace.tsx`: botones con estado activo, NO shadcn Tabs), dropdowns y acciones inline. Responsive desktop (≥1280) y laptop (1024-1280): el panel derecho de contacto es visible en `xl+` y toggleable siempre.
- **Contratos de datos exactos** (los define este plan, no inventar otros):
  - `ConversationStatus = 'nuevo'|'en_atencion'|'esperando_cliente'|'resuelto'|'archivado'`
  - `ContactClassification = 'cliente'|'prospecto'|'soporte'|'proveedor'|'spam'|'otro'`
  - `BotTone = 'formal'|'cercano'|'tecnico'|'comercial'`
  - Doc conversación del bot gana (opcionales): `pausedUntil` (string canónico `'YYYY-MM-DD HH:MM:SS'` UTC o null), `suggestedClassification` (ContactClassification).
  - `BotConfig` (contrato bot↔OS, claves snake_case): `{ bot_name: string, tone: BotTone, response_delay_seconds: number (0-600), schedule: { days: number[] (0=Dom..6=Sáb), start: 'HH:MM', end: 'HH:MM' } (hora America/Mexico_City), out_of_hours_message: string, initial_message: string, escalation_message: string, can_answer: string[], cannot_answer: string[], escalation_rules: string[], quote_questions: string[] }` (+ `updated_at`, `updated_by` de solo lectura).
- **CRM activo = `useCRM()`** de `src/components/crm/CRMContextCore.tsx` (blob `crm_data/{uid}`); el layout admin ya envuelve con `CRMProvider`, así que los componentes de `/whatsapp` pueden llamarlo. `addClient(data)` valida con `clientSchema` (`name` requerido; `phone`, `contactName`, `notes` opcionales). `addTask(clientId, projectId, {name, desc, prio})` requiere proyecto existente. Colección `tickets` top-level: shape mínimo que lee el portal `{ticketId, problema, estado}` — escribible con client SDK (rules auth).

---

## Estado actual (verificado 2026-07-02, post-lanzamiento v1)

Ya existe y funciona en producción: inbox realtime (`ConversationList` 132 líneas, `ChatThread` 143, `Composer` 90, `ModeToggle` 70, `InboxShell` 68), modos BOT/HUMAN/PAUSED con takeover, envío manual, ventana 24h, endpoints internos del bot con `X-Internal-Secret`, proxies OS con `requireAdmin`, rules `/tenants/**` read-only desplegadas. El bot compone su prompt desde `config/prompts.yaml` (estático, con marcadores `<<ESCALAR_LEAD|ASESOR|DUDA>>` ya parseados en `main.py:329-338`) y usa `RESPONSE_DELAY_SECONDS` env (30s). `tools.py` tiene `obtener_horario()`/`_calcular_si_abierto()` sobre `business.yaml`.

**Fuera de alcance (no implementar):** multi-tenant UI, multi-agente/asignación real a varios usuarios (responsable = campo informativo, single-admin), plantillas de Meta fuera de ventana 24h, adjuntos/media salientes, respuestas automáticas por reglas sin LLM (aparte del mensaje fuera de horario), notificaciones push, métricas/reportes.

---

# Parte Bot — PixelBot (`/home/ubuntu/pixelbot`)

### Task 1: Pausa temporal — migración 004 `paused_until` + auto-reanudación + endpoint

**Files:**
- Create: `agent/migrations/004_paused_until.py` (misma interfaz `async def correr(conn)` que 003 — leer `agent/migrations/003_pending_firestore_sync.py` antes para replicar estructura e idempotencia)
- Modify: `agent/memory.py` (columna en modelo `Conversacion`), `agent/tenants.py` (param en `set_conversacion_mode`), `agent/main.py` (registro migración + auto-resume + param endpoint)
- Test: `tests/test_paused_until.py` (fixtures `local_engine`/`patched_session`/`tenant_id` copiadas del patrón de `tests/test_conversation_mode.py`, agregando migración 004 a la cadena)

**Interfaces:**
- Produces: `Conversacion.paused_until: datetime | None`; `set_conversacion_mode(tenant_id, phone, mode, changed_by_uid, paused_until: datetime | None = None)`; `POST /internal/conversations/mode` acepta `paused_until: str | None` (formato canónico o ISO, solo válido con `mode="PAUSED"`); proyección Firestore `pausedUntil` (string canónico o `None`). Task 5 (proxy OS) y Task 8 (UI) lo consumen.

- [ ] **Step 1: Tests que fallan** — en `tests/test_paused_until.py`:

```python
# tests/test_paused_until.py — pausa temporal del bot con auto-reanudación
import json
from datetime import timedelta
import pytest
from sqlalchemy import select, text
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

import agent.tenants as ten
from agent.main import app
from agent.memory import ConversacionMode, Conversacion, PendingFirestoreSync
from agent.outbox.time_utils import now_canonical, format_canonical

TEST_SECRET = "test-internal-secret-exactly-32-chars-x"

# [fixtures local_engine / patched_session / tenant_id — copiar del patrón de
#  tests/test_conversation_mode.py AGREGANDO migración 004 después de la 003]


async def test_set_mode_paused_con_paused_until_persiste(patched_session, tenant_id):
    until = now_canonical() + timedelta(hours=1)
    conv, prev = await ten.set_conversacion_mode(
        tenant_id, "+52555900010", ConversacionMode.PAUSED, "uid_m", paused_until=until
    )
    assert conv.mode == ConversacionMode.PAUSED
    assert conv.paused_until == until
    # proyección incluye pausedUntil canónico
    async with patched_session() as s:
        recs = (await s.execute(select(PendingFirestoreSync))).scalars().all()
    upd = next(json.loads(r.payload_json) for r in recs if r.operation_type == "update_conversation")
    assert upd["pausedUntil"] == format_canonical(until)


async def test_set_mode_no_paused_limpia_paused_until(patched_session, tenant_id):
    until = now_canonical() + timedelta(hours=1)
    await ten.set_conversacion_mode(tenant_id, "+52555900011", ConversacionMode.PAUSED, "uid_m", paused_until=until)
    conv, _ = await ten.set_conversacion_mode(tenant_id, "+52555900011", ConversacionMode.HUMAN, "uid_m")
    assert conv.paused_until is None


async def test_endpoint_mode_rechaza_paused_until_sin_paused(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/internal/conversations/mode",
            json={"tenant_id": "t", "phone": "+52", "mode": "HUMAN",
                  "changed_by_uid": "u", "paused_until": "2030-01-01 00:00:00"},
            headers={"X-Internal-Secret": TEST_SECRET},
        )
    assert resp.status_code == 400


async def test_endpoint_mode_paused_until_invalido_400(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/internal/conversations/mode",
            json={"tenant_id": "t", "phone": "+52", "mode": "PAUSED",
                  "changed_by_uid": "u", "paused_until": "no-es-fecha"},
            headers={"X-Internal-Secret": TEST_SECRET},
        )
    assert resp.status_code == 400


async def test_auto_resume_cuando_pausa_expiro(patched_session, tenant_id):
    """Si mode=PAUSED y paused_until ya pasó, resolver_modo_efectivo reanuda a BOT."""
    from agent.main import resolver_modo_efectivo
    past = now_canonical() - timedelta(minutes=5)
    conv, _ = await ten.set_conversacion_mode(tenant_id, "+52555900012", ConversacionMode.PAUSED, "uid_m", paused_until=past)
    modo = await resolver_modo_efectivo(conv, tenant_id, "+52555900012")
    assert modo == ConversacionMode.BOT
    async with patched_session() as s:
        row = (await s.execute(select(Conversacion).where(Conversacion.id == conv.id))).scalar_one()
    assert row.mode == ConversacionMode.BOT
    assert row.paused_until is None


async def test_no_resume_si_pausa_vigente(patched_session, tenant_id):
    from agent.main import resolver_modo_efectivo
    future = now_canonical() + timedelta(minutes=30)
    conv, _ = await ten.set_conversacion_mode(tenant_id, "+52555900013", ConversacionMode.PAUSED, "uid_m", paused_until=future)
    modo = await resolver_modo_efectivo(conv, tenant_id, "+52555900013")
    assert modo == ConversacionMode.PAUSED


async def test_human_nunca_auto_resume(patched_session, tenant_id):
    from agent.main import resolver_modo_efectivo
    conv, _ = await ten.set_conversacion_mode(tenant_id, "+52555900014", ConversacionMode.HUMAN, "uid_m")
    modo = await resolver_modo_efectivo(conv, tenant_id, "+52555900014")
    assert modo == ConversacionMode.HUMAN
```

- [ ] **Step 2: Verificar RED** — correr `pytest tests/test_paused_until.py` en el contenedor; falla por columna/función inexistentes.

- [ ] **Step 3: Implementación**

1. `agent/memory.py` — en el modelo `Conversacion`, después de `unread_count`:
```python
    paused_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

2. `agent/migrations/004_paused_until.py` — idempotente, misma estructura que 003:
```python
# Chequear con: PRAGMA table_info(conversaciones) → si 'paused_until' no está:
# ALTER TABLE conversaciones ADD COLUMN paused_until DATETIME
```
(replicar helpers/logs del archivo 003; el implementer lo lee primero).

3. `agent/main.py` — registrar en la lista de migraciones del lifespan: `from agent.migrations import migration_004 as _m004` y agregar `(_m004, "004_paused_until")`. **Verificar cómo exporta `agent/migrations/__init__.py` los módulos 001-003 y replicar para 004.**

4. `agent/tenants.py` — `set_conversacion_mode` gana param `paused_until: datetime | None = None`:
   - `conv.paused_until = paused_until if mode == ConversacionMode.PAUSED else None`
   - payload `update_conversation` agrega `"pausedUntil": format_canonical(paused_until) if (mode == ConversacionMode.PAUSED and paused_until) else None`
   - details del audit agrega `"paused_until": format_canonical(paused_until) if paused_until else None`

5. `agent/main.py` — nueva función y uso en `procesar_mensaje` (reemplaza el bloque PASO 1.5 actual):
```python
async def resolver_modo_efectivo(conv, tenant_id: str, phone: str) -> ConversacionMode:
    """Retorna el modo vigente, auto-reanudando a BOT si la pausa temporal expiró."""
    mode = getattr(conv, "mode", None) or ConversacionMode.BOT
    paused_until = getattr(conv, "paused_until", None)
    if mode == ConversacionMode.PAUSED and paused_until is not None and now_canonical() >= paused_until:
        await set_conversacion_mode(tenant_id, phone, ConversacionMode.BOT, "auto_resume")
        logger.info(f"[MODE] Pausa expirada para {phone} — auto-reanudado a BOT")
        return ConversacionMode.BOT
    return mode
```
En `procesar_mensaje`, PASO 1.5 pasa a: `mode = await resolver_modo_efectivo(conv, tenant_id, msg.telefono)` seguido del `if mode != ConversacionMode.BOT: ... return` existente. Importar `now_canonical` ya está.

6. `agent/main.py` — `InternalModeRequest` gana `paused_until: str | None = None`; en el endpoint, antes de llamar `set_conversacion_mode`:
```python
    paused_dt = None
    if body.paused_until is not None:
        if nuevo_modo != ConversacionMode.PAUSED:
            raise HTTPException(400, "paused_until solo es válido con mode=PAUSED")
        try:
            paused_dt = parse_canonical(body.paused_until).replace(tzinfo=None)
        except (ValueError, TypeError):
            raise HTTPException(400, f"paused_until inválido: {body.paused_until!r}")
```
y pasar `paused_until=paused_dt`. La respuesta 200 agrega `"paused_until": format_canonical(paused_dt) if paused_dt else None`. Importar `parse_canonical` de `agent.outbox.time_utils`.

- [ ] **Step 4: GREEN + suite completa** en contenedor. **Step 5: Commit** `feat(pause): pausa temporal con paused_until y auto-reanudacion` (+ trailer Co-Authored-By: Claude Fable 5 <noreply@anthropic.com> — aplica a TODOS los commits del plan).

---

### Task 2: Configuración dinámica — migración 005 `bot_config` + módulo + endpoints GET/PUT

**Files:**
- Create: `agent/migrations/005_bot_config.py`, `agent/bot_config.py`
- Modify: `agent/main.py` (registro migración + 2 endpoints), `agent/migrations/__init__.py` si aplica
- Test: `tests/test_bot_config.py`

**Interfaces:**
- Produces: `get_bot_config() -> dict` (siempre completo: fila almacenada mergeada sobre `DEFAULTS`), `set_bot_config(new: dict, updated_by: str) -> dict` (valida, mergea sobre DEFAULTS, persiste, invalida cache), `validar_config(d: dict) -> list[str]` (lista de errores, vacía = ok); `GET /internal/config` → `{"config": {...}}`; `PUT /internal/config` body `{"config": {...}, "updated_by_uid": str}` → 200 `{"config": {...}}` | 400 con `detail` listando errores. Tasks 3, 5 y 9 lo consumen.

- [ ] **Step 1: Tests (RED)** — `tests/test_bot_config.py` con fixtures del mismo patrón (cadena de migraciones 001+003+004+005; la 002 no es necesaria en fixtures previos, mantener consistencia con lo que use test_conversation_mode.py):

```python
async def test_get_config_sin_fila_devuelve_defaults(patched_session):
    from agent.bot_config import get_bot_config, DEFAULTS, invalidar_cache
    invalidar_cache()
    cfg = await get_bot_config()
    assert cfg["bot_name"] == DEFAULTS["bot_name"]
    assert cfg["response_delay_seconds"] == 30
    assert cfg["tone"] in ("formal", "cercano", "tecnico", "comercial")

async def test_set_y_get_roundtrip(patched_session):
    from agent.bot_config import get_bot_config, set_bot_config, DEFAULTS, invalidar_cache
    invalidar_cache()
    stored = await set_bot_config({**DEFAULTS, "bot_name": "Sofia", "response_delay_seconds": 10}, "uid_m")
    assert stored["bot_name"] == "Sofia"
    invalidar_cache()
    again = await get_bot_config()
    assert again["bot_name"] == "Sofia" and again["response_delay_seconds"] == 10
    assert again["updated_by"] == "uid_m"

async def test_validacion_rechaza_valores_invalidos(patched_session):
    from agent.bot_config import validar_config, DEFAULTS
    malo = {**DEFAULTS, "tone": "gritón", "response_delay_seconds": 9999,
            "schedule": {"days": [9], "start": "25:00", "end": "x"}}
    errores = validar_config(malo)
    assert any("tone" in e for e in errores)
    assert any("response_delay_seconds" in e for e in errores)
    assert any("schedule" in e for e in errores)

async def test_endpoint_get_config_requiere_secret(monkeypatch):
    # GET sin header → 401 (usar ASGITransport como en test_conversation_mode)
    ...

async def test_endpoint_put_config_invalido_400(monkeypatch, patched_session):
    # PUT con tone inválido → 400 y el detail menciona 'tone'
    ...

async def test_endpoint_put_y_get_roundtrip(monkeypatch, patched_session):
    # PUT válido → 200; GET → refleja el cambio
    ...
```
(Los 3 tests de endpoint siguen el patrón exacto de auth/transport de `tests/test_conversation_mode.py`; escribirlos completos.)

- [ ] **Step 2: RED. Step 3: Implementación**

1. `agent/migrations/005_bot_config.py` — crea tabla si no existe:
```sql
CREATE TABLE IF NOT EXISTS bot_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    config_json TEXT NOT NULL,
    updated_at DATETIME,
    updated_by TEXT
)
```

2. `agent/bot_config.py`:
```python
# agent/bot_config.py — Configuración dinámica del bot (SQLite source of truth)
# Defaults = comportamiento actual del bot (business.yaml/env), para no romper nada.
import json, re, os, time
from sqlalchemy import text
from agent.memory import async_session
from agent.outbox.time_utils import now_canonical

TONOS_VALIDOS = ("formal", "cercano", "tecnico", "comercial")
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

DEFAULTS: dict = {
    "bot_name": "PixelBot",
    "tone": "cercano",
    "response_delay_seconds": int(os.getenv("RESPONSE_DELAY_SECONDS", 30)),
    "schedule": {"days": [1, 2, 3, 4, 5, 6], "start": "09:00", "end": "18:00"},
    "out_of_hours_message": (
        "Gracias por escribirnos. Nuestro horario es Lunes a Viernes 9am-6pm y "
        "Sábado 10am-2pm (hora de Vallarta). Te respondemos en cuanto abramos."
    ),
    "initial_message": "Hola, soy parte del equipo de PIXELTEC. ¿En qué te puedo ayudar?",
    "escalation_message": "Con gusto, le aviso a Miguel ahora mismo. ¿Cuál es el mejor número/horario para contactarte?",
    "can_answer": ["servicios", "precios generales", "horarios", "soporte básico", "estado de proyecto"],
    "cannot_answer": ["datos sensibles", "promesas de entrega", "descuentos no autorizados", "temas fuera de PixelTEC"],
    "escalation_rules": [
        "cliente molesto", "pide hablar con una persona", "solicita precio exacto",
        "soporte de proyecto activo", "mensaje ambiguo después de 2 intentos",
    ],
    "quote_questions": ["nombre", "empresa", "tipo de proyecto", "presupuesto aproximado", "fecha objetivo", "medio de contacto"],
}

_CACHE_TTL = 60.0
_cache: dict | None = None
_cache_at: float = 0.0

def invalidar_cache() -> None: ...
def validar_config(d: dict) -> list[str]: ...
async def get_bot_config() -> dict: ...
async def set_bot_config(new: dict, updated_by: str) -> dict: ...
```
Reglas de `validar_config` (implementar completas): `bot_name` str 1-60 chars; `tone` ∈ TONOS_VALIDOS; `response_delay_seconds` int 0-600; `schedule.days` lista de ints únicos 0-6 no vacía; `schedule.start/end` regex HH:MM; los 3 mensajes str 1-1000; las 4 listas: listas de str no vacíos (cada uno ≤200 chars, máx 20 items, lista puede estar vacía). Claves desconocidas se ignoran (se filtra a las claves de DEFAULTS). `get_bot_config`: si cache vigente → cache; si no, `SELECT config_json, updated_at, updated_by FROM bot_config WHERE id=1` vía `async_session` + `text()`; merge `{**DEFAULTS, **stored}` + `updated_at/updated_by`; cachear. `set_bot_config`: filtrar claves → validar (raise `ValueError("; ".join(errores))` si hay) → `INSERT OR REPLACE INTO bot_config (id, config_json, updated_at, updated_by) VALUES (1, :j, :at, :by)` → invalidar cache → retornar merged.

3. `agent/main.py` — registrar migración 005 y endpoints:
```python
from agent.bot_config import get_bot_config, set_bot_config

class InternalConfigPut(BaseModel):
    config: dict
    updated_by_uid: str

@app.get("/internal/config")
async def internal_get_config(x_internal_secret: str | None = Header(None, alias="X-Internal-Secret")):
    _verify_internal_secret(x_internal_secret)
    return {"config": await get_bot_config()}

@app.put("/internal/config")
async def internal_put_config(body: InternalConfigPut,
                              x_internal_secret: str | None = Header(None, alias="X-Internal-Secret")):
    _verify_internal_secret(x_internal_secret)
    try:
        stored = await set_bot_config(body.config, body.updated_by_uid)
    except ValueError as e:
        raise HTTPException(400, f"Config inválida: {e}")
    logger.info(f"[CONFIG] Actualizada por uid={body.updated_by_uid}")
    return {"config": stored}
```

- [ ] **Step 4: GREEN + suite completa. Step 5: Commit** `feat(config): bot_config dinamico en SQLite + endpoints internos GET/PUT`.

---

### Task 3: El bot obedece la config — prompt dinámico, delay, fuera de horario, marcador CLASIFICAR

**Files:**
- Modify: `agent/brain.py`, `agent/main.py`, `agent/tenants.py` (helper de proyección suelta)
- Test: `tests/test_dynamic_behavior.py`

**Interfaces:**
- Consumes: `get_bot_config()` (Task 2).
- Produces: `componer_system_prompt(config: dict) -> str` (brain); `generar_respuesta(mensaje, historial, config: dict | None = None)` (compat: sin config carga `get_bot_config()`); `fuera_de_horario(config: dict, ahora=None) -> bool` (main, TZ America/Mexico_City vía `zoneinfo`); `project_conversation_fields(tenant_id, phone, fields: dict) -> None` (tenants — encola `update_conversation` en transacción propia); parsing de `<<CLASIFICAR:x>>` en `procesar_mensaje`.

- [ ] **Step 1: Tests (RED)** — `tests/test_dynamic_behavior.py`:

```python
def test_componer_system_prompt_incluye_secciones():
    from agent.brain import componer_system_prompt
    from agent.bot_config import DEFAULTS
    cfg = {**DEFAULTS, "bot_name": "Sofia", "tone": "formal",
           "cannot_answer": ["descuentos no autorizados"]}
    prompt = componer_system_prompt(cfg)
    assert "Sofia" in prompt
    assert "descuentos no autorizados" in prompt
    assert "<<CLASIFICAR:" in prompt  # instrucción del marcador presente
    # el prompt base de prompts.yaml sigue presente (identidad PIXELTEC)
    assert "PIXELTEC" in prompt

def test_fuera_de_horario_true_fuera_y_false_dentro():
    from agent.main import fuera_de_horario
    from datetime import datetime
    cfg = {"schedule": {"days": [1, 2, 3, 4, 5], "start": "09:00", "end": "18:00"}}
    # miércoles 10:00 local → dentro; domingo → fuera; miércoles 20:00 → fuera
    dentro = datetime(2026, 7, 1, 10, 0)   # naive = hora local America/Mexico_City para el test
    noche  = datetime(2026, 7, 1, 20, 0)
    domingo = datetime(2026, 7, 5, 12, 0)
    assert fuera_de_horario(cfg, ahora=dentro) is False
    assert fuera_de_horario(cfg, ahora=noche) is True
    assert fuera_de_horario(cfg, ahora=domingo) is True

async def test_clasificar_marker_se_extrae_y_proyecta(patched_session, tenant_id):
    from agent.main import extraer_clasificacion
    texto, clasif = extraer_clasificacion("<<CLASIFICAR:prospecto>> Hola, claro que sí")
    assert clasif == "prospecto" and texto == "Hola, claro que sí"
    texto2, clasif2 = extraer_clasificacion("Hola sin marcador")
    assert clasif2 is None and texto2 == "Hola sin marcador"
    texto3, clasif3 = extraer_clasificacion("<<CLASIFICAR:alienigena>> Hola")
    assert clasif3 is None and texto3 == "Hola"  # valor fuera del enum se descarta

async def test_project_conversation_fields_encola(patched_session, tenant_id):
    import agent.tenants as ten, json
    from agent.memory import PendingFirestoreSync
    from sqlalchemy import select
    await ten.project_conversation_fields(tenant_id, "+52555900020", {"suggestedClassification": "prospecto"})
    async with patched_session() as s:
        recs = (await s.execute(select(PendingFirestoreSync))).scalars().all()
    payload = json.loads(recs[-1].payload_json)
    assert payload["suggestedClassification"] == "prospecto"
```

- [ ] **Step 2: RED. Step 3: Implementación**

1. `agent/brain.py`:
```python
TONE_INSTRUCTIONS = {
    "formal": "Tono formal y profesional: trata de 'usted', frases completas, sin modismos.",
    "cercano": "Tono cercano y cálido: trata de 'tú', mexicano natural, directo y amable.",
    "tecnico": "Tono técnico: preciso, con terminología correcta, sin rodeos comerciales.",
    "comercial": "Tono comercial consultivo: orientado a valor y siguiente paso, sin presionar.",
}

def componer_system_prompt(config: dict) -> str:
    base = cargar_system_prompt()
    lineas = [
        base,
        "\n## Configuración vigente (editada desde el dashboard — PRIORIDAD sobre lo anterior si contradice)",
        f"- Te llamas {config['bot_name']}.",
        f"- {TONE_INSTRUCTIONS.get(config['tone'], TONE_INSTRUCTIONS['cercano'])}",
        f"- Horario de atención: días {config['schedule']['days']} (0=Dom..6=Sáb) de {config['schedule']['start']} a {config['schedule']['end']} hora de Vallarta.",
        f"- Mensaje inicial sugerido para conversaciones nuevas: \"{config['initial_message']}\"",
        f"- Al escalar a un humano usa: \"{config['escalation_message']}\" (con el marcador <<ESCALAR_ASESOR>>).",
        "- SÍ puedes responder sobre: " + "; ".join(config["can_answer"]) + ".",
        "- NO puedes responder sobre: " + "; ".join(config["cannot_answer"]) + ". Si te preguntan por esos temas, escala con <<ESCALAR_ASESOR>>.",
        "- Escala a humano (<<ESCALAR_ASESOR>>) cuando: " + "; ".join(config["escalation_rules"]) + ".",
        "- Para cotizar, recaba SIEMPRE (una pregunta a la vez): " + "; ".join(config["quote_questions"]) + ".",
        "\n## Clasificación del contacto",
        "Cuando identifiques con ALTA confianza qué tipo de contacto es, antepone UNA sola vez al inicio "
        "de tu respuesta el marcador <<CLASIFICAR:valor>> con valor ∈ {cliente, prospecto, soporte, proveedor, spam}. "
        "El marcador se elimina antes de enviar; no lo menciones ni lo expliques.",
    ]
    return "\n".join(lineas)
```
`generar_respuesta(mensaje, historial, config: dict | None = None)`: si `config is None` → `from agent.bot_config import get_bot_config; config = await get_bot_config()`; `system_prompt = componer_system_prompt(config)`. Resto igual.

2. `agent/tenants.py`:
```python
async def project_conversation_fields(tenant_id: str, phone: str, fields: dict) -> None:
    """Encola una proyección suelta de campos al doc de conversación en Firestore."""
    from agent.memory import encolar_firestore_sync
    async with async_session() as session:
        await encolar_firestore_sync(
            tenant_id=tenant_id, operation_type="update_conversation",
            payload={"tenant_id": tenant_id, "phone": phone, **fields},
            target_collection="conversations", session=session,
        )
        await session.commit()
```

3. `agent/main.py`:
```python
from zoneinfo import ZoneInfo
CLASIFICACIONES_VALIDAS = {"cliente", "prospecto", "soporte", "proveedor", "spam"}
_TZ_LOCAL = ZoneInfo("America/Mexico_City")

def fuera_de_horario(config: dict, ahora: datetime | None = None) -> bool:
    sched = config.get("schedule") or {}
    days, start, end = sched.get("days"), sched.get("start"), sched.get("end")
    if not days or not start or not end:
        return False  # sin horario configurado → siempre abierto (comportamiento actual)
    local = ahora if ahora is not None else datetime.now(_TZ_LOCAL)
    # weekday(): lunes=0..domingo=6 → convertir a 0=Dom..6=Sáb
    dia = (local.weekday() + 1) % 7
    if dia not in days:
        return True
    hhmm = local.strftime("%H:%M")
    return not (start <= hhmm < end)

def extraer_clasificacion(respuesta: str) -> tuple[str, str | None]:
    if respuesta.startswith("<<CLASIFICAR:"):
        fin = respuesta.find(">>")
        if fin != -1:
            valor = respuesta[len("<<CLASIFICAR:"):fin].strip().lower()
            resto = respuesta[fin + 2:].lstrip()
            return resto, (valor if valor in CLASIFICACIONES_VALIDAS else None)
    return respuesta, None
```
En `procesar_mensaje`: (a) tras resolver modo, `config = await get_bot_config()`; (b) si `fuera_de_horario(config)` → `respuesta = config["out_of_hours_message"]` y saltar el LLM (seguir con delay/envío/persistencia normales — NO parsear marcadores); (c) si dentro de horario → `respuesta = await generar_respuesta(msg.texto, historial, config)` seguido de `respuesta, clasif = extraer_clasificacion(respuesta)` y si `clasif` → `await project_conversation_fields(tenant_id, msg.telefono, {"suggestedClassification": clasif})` (best-effort try/except con warning, nunca rompe el flujo); (d) el loop de `<<ESCALAR_*>>` existente queda DESPUÉS de extraer clasificación, sin cambios; (e) `await asyncio.sleep(...)` usa `config["response_delay_seconds"]` en vez de `RESPONSE_DELAY_SECONDS` (env queda como default de DEFAULTS — no borrar la constante, otros paths la usan: el rechazo de guardia en el paso 1 puede seguir con la constante).

- [ ] **Step 4: GREEN + suite completa. Step 5: Commit** `feat(brain): prompt dinamico desde bot_config + fuera de horario + marcador CLASIFICAR`.

---

# Parte OS — PixelTEC OS (`/home/ubuntu/pixeltec-os`)

### Task 4: Modelo de datos OS — rules + tipos + servicio de contactos/notas

**Files:**
- Modify: `firestore.rules` (bloque `whatsappContacts` tras el bloque de `tenants`), `src/types/whatsapp-inbox.ts` (extender)
- Create: `src/lib/whatsapp-inbox/contacts.ts`, `src/hooks/use-whatsapp-contacts.ts`

**Interfaces (Produces — contratos exactos para Tasks 6-9):**

1. `firestore.rules`:
```
    // WhatsApp atención — datos del dashboard (contacto, clasificación, notas).
    // Escritos por el admin autenticado via client SDK; el bot NUNCA los toca.
    match /whatsappContacts/{phone} {
      allow read, write: if request.auth != null;
    }
    match /whatsappContacts/{phone}/{path=**} {
      allow read, write: if request.auth != null;
    }
```
**NO desplegar** (`firebase deploy` es de Miguel).

2. `src/types/whatsapp-inbox.ts` — agregar (y extender `InboxConversation` con `pausedUntil?: string | null; suggestedClassification?: ContactClassification;`):
```typescript
export type ConversationStatus = 'nuevo' | 'en_atencion' | 'esperando_cliente' | 'resuelto' | 'archivado';
export type ContactClassification = 'cliente' | 'prospecto' | 'soporte' | 'proveedor' | 'spam' | 'otro';
export type BotTone = 'formal' | 'cercano' | 'tecnico' | 'comercial';

export interface ContactAction { at: string; byUid: string; action: string; }

export interface WhatsAppContact {
  id: string; // phone E164 (doc id)
  name?: string;
  classification?: ContactClassification | null;
  tags?: string[];
  assignedTo?: string | null;
  origin?: string;
  status?: ConversationStatus;
  urgent?: boolean;
  linkedClientId?: string | null;
  actionHistory?: ContactAction[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ContactNote { id: string; text: string; createdBy: string; createdAt?: Timestamp; }

export interface BotSchedule { days: number[]; start: string; end: string; }
export interface BotConfig {
  bot_name: string; tone: BotTone; response_delay_seconds: number;
  schedule: BotSchedule; out_of_hours_message: string; initial_message: string;
  escalation_message: string; can_answer: string[]; cannot_answer: string[];
  escalation_rules: string[]; quote_questions: string[];
  updated_at?: string; updated_by?: string;
}

export const STATUS_META: Record<ConversationStatus, { label: string; className: string }> = {
  nuevo:             { label: 'Nuevo',             className: 'text-sky-300 bg-sky-500/10 border-sky-500/30' },
  en_atencion:       { label: 'En atención',       className: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
  esperando_cliente: { label: 'Esperando cliente', className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  resuelto:          { label: 'Resuelto',          className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  archivado:         { label: 'Archivado',         className: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30' },
};
export const CLASSIFICATION_META: Record<ContactClassification, { label: string; className: string }> = {
  cliente:   { label: 'Cliente',   className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  prospecto: { label: 'Prospecto', className: 'text-violet-300 bg-violet-500/10 border-violet-500/30' },
  soporte:   { label: 'Soporte',   className: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
  proveedor: { label: 'Proveedor', className: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
  spam:      { label: 'Spam',      className: 'text-red-300 bg-red-500/10 border-red-500/30' },
  otro:      { label: 'Otro',      className: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30' },
};
```

3. `src/lib/whatsapp-inbox/contacts.ts` (client SDK, `'use client'` no aplica a libs — sin directiva):
```typescript
import { arrayUnion, collection, doc, orderBy, query, serverTimestamp, setDoc, addDoc,
         type DocumentReference, type Firestore, type Query } from 'firebase/firestore';
import type { ContactNote, WhatsAppContact } from '@/types/whatsapp-inbox';

export function contactRef(fs: Firestore, phone: string): DocumentReference<WhatsAppContact>;
export function notesQuery(fs: Firestore, phone: string): Query<ContactNote>;  // orderBy('createdAt','asc')

/** setDoc merge; si `action` viene, agrega {at: ISO now, byUid, action} a actionHistory via arrayUnion
 *  y siempre pisa updatedAt: serverTimestamp(). createdAt solo con merge la primera vez:
 *  usar setDoc(ref, {createdAt: serverTimestamp()}, {merge:true}) NO es idempotente → en su lugar,
 *  el caller que sabe que el doc no existía pasa {createdAt: serverTimestamp()} dentro de data. */
export async function upsertContact(fs: Firestore, phone: string,
  data: Partial<Omit<WhatsAppContact, 'id' | 'actionHistory'>>, byUid: string, action?: string): Promise<void>;

export async function addContactNote(fs: Firestore, phone: string, text: string, byUid: string): Promise<void>;
```
(Implementar completas: `upsertContact` construye el objeto con spread de `data`, `updatedAt: serverTimestamp()` y condicionalmente `actionHistory: arrayUnion(entry)`; strip de `undefined` antes de `setDoc` — replicar el helper `stripUndefined` si existe en el repo o filtrar con `Object.fromEntries`.)

4. `src/hooks/use-whatsapp-contacts.ts`:
```typescript
'use client';
// useCollection(collection(fs,'whatsappContacts'), {listen:true}) →
// { contactsByPhone: Map<string, WhatsAppContact>, loading, error }
export function useWhatsappContacts(): { contactsByPhone: Map<string, WhatsAppContact>; loading: boolean; error?: Error };
```

**Steps:** implementar → `npm run typecheck && npm run lint` → commit `feat(whatsapp): modelo de datos de atencion — contactos, notas, config types y rules`.

---

### Task 5: Proxies OS — `/api/whatsapp-inbox/config` GET/PUT + `pausedUntil` en mode

**Files:**
- Modify: `src/lib/whatsapp-inbox/pixelbot-client.ts` (soporte método GET/PUT), `src/app/api/whatsapp-inbox/mode/route.ts`
- Create: `src/app/api/whatsapp-inbox/config/route.ts`

**Interfaces:**
- `fetchPixelbot(path, body?, method: 'POST'|'GET'|'PUT' = 'POST')` — GET no manda body (backward compatible: llamadas existentes no cambian).
- `GET /api/whatsapp-inbox/config` → passthrough de `GET /internal/config` (requireAdmin). `PUT /api/whatsapp-inbox/config` body `{config: BotConfig}` → passthrough de `PUT /internal/config` con `updated_by_uid: guard.uid`.
- `POST /api/whatsapp-inbox/mode` acepta opcional `pausedUntil: string` (ISO del cliente): validar `!isNaN(Date.parse(pausedUntil))` y solo con `mode==='PAUSED'` (400 si no); convertir a canónico UTC del bot: `new Date(pausedUntil).toISOString().slice(0, 19).replace('T', ' ')` → campo `paused_until` del body al bot.

Ambas routes: patrón `requireAdmin` idéntico a las existentes (audit context con route/ip/userAgent), `runtime = 'nodejs'`, try/catch → 500. **Steps:** implementar → typecheck+lint → commit `feat(api): proxy config del bot + pausa temporal en mode`.

---

### Task 6: Shell con tabs + ConversationList v2 (filtros, búsqueda, badges)

**Files:**
- Create: `src/components/whatsapp-inbox/WhatsAppModule.tsx`, `src/components/whatsapp-inbox/BotConfigView.tsx` (STUB: exporta componente que renderiza `<div className="p-8 text-sm text-zinc-500">Configuración del bot — Task 9</div>`)
- Modify: `src/app/(admin)/whatsapp/page.tsx` (renderiza `<WhatsAppModule tenantId/>`), `src/components/whatsapp-inbox/InboxShell.tsx`, `src/components/whatsapp-inbox/ConversationList.tsx`

**Spec (funcional, no solo visual):**

1. `WhatsAppModule` (client): header compacto del módulo con título "WhatsApp" y tabs custom estilo `ClientWorkspace.tsx` (botones con borde/acento activo, NO shadcn Tabs): **Inbox** | **Configuración del bot**. Estado local `activeTab`. Inbox → `<InboxShell tenantId/>`; config → `<BotConfigView/>`. El contenido ocupa `h-full min-h-0 flex flex-col`.

2. `InboxShell`: incorpora `useWhatsappContacts()` y pasa `contactsByPhone` a `ConversationList` y (prop-drill sencillo) al hilo. Mantiene `selectedPhone` y agrega estado `panelOpen: boolean` (default true) — el panel derecho se agrega en Task 8; por ahora solo el estado + placeholder `{/* Task 8: ContactPanel */}`.

3. `ConversationList` v2 — props `{ tenantId, contactsByPhone, selectedPhone, onSelect }`:
   - **Búsqueda**: input con icono `Search` arriba (estilo composer: `bg-zinc-900/60 border-zinc-800 rounded-lg`); filtra client-side por: teléfono (`conv.id`), `contact.name`, `lastMessagePreview`, y tags (`contact.tags`), case-insensitive.
   - **Filtros rápidos**: fila horizontal scrolleable (`overflow-x-auto`, chips `rounded-full border px-2.5 py-1 text-xs`) con: `Todos` (default — excluye `status==='archivado'`), `Sin responder` (`lastMessageDirection==='inbound'`), `Bot activo` (`mode BOT o ausente`), `Control humano` (`mode==='HUMAN'`), `Prospectos`, `Clientes`, `Soporte` (por `contact.classification`), `Archivados` (`status==='archivado'`). Un solo filtro activo a la vez (estado `activeFilter`). Chip activo: acento cyan.
   - **Fila de conversación**: si `contact.name` existe → nombre en `font-medium` + teléfono en `text-xs text-zinc-500`; si no, teléfono como hoy. Badges (máx 3 + los de modo): modo existente (Bot/Tú/Pausa), `Urgente` (rojo, si `contact.urgent`), `Nuevo` (sky, si `!contact?.status || status==='nuevo'`), chip de clasificación desde `CLASSIFICATION_META` si existe. Mantener punto cyan inbound y tiempo relativo actuales.
   - Contador del header refleja la lista filtrada.
   - Estado vacío del filtro: "Nada por aquí con este filtro."

**Steps:** implementar → typecheck+lint → verificación visual opcional en dev → commit `feat(whatsapp): tabs del modulo + filtros, busqueda y badges en la lista`.

---

### Task 7: ChatThread v2 — separadores de fecha, notas internas, banner de pausa, estado

**Files:**
- Modify: `src/components/whatsapp-inbox/ChatThread.tsx`, `src/components/whatsapp-inbox/Composer.tsx`
- Props nuevas de ChatThread: `{ tenantId, phone, onBack, contact?: WhatsAppContact, onOpenPanel: () => void }` (InboxShell se ajusta).

**Spec:**

1. **Separadores de fecha**: al renderizar la lista mergeada, insertar divisor cuando cambia el día (`toDateString()` de `createdAt`): línea zinc con pill central (`Hoy` / `Ayer` / `2 jul 2026` via `toLocaleDateString('es-MX', {day:'numeric', month:'short', year:'numeric'})`, comparando contra hoy/ayer locales).

2. **Notas internas en el hilo**: suscribirse a `notesQuery(fs, phone)` con `useCollection listen`. Mergear mensajes y notas en una sola timeline ordenada por timestamp (`createdAt.toDate()`); las notas se renderizan como tarjeta discreta centrada/ancho completo: `border border-violet-500/25 bg-violet-500/5 rounded-lg px-3 py-2 text-sm text-violet-200` con encabezado `📝 Nota interna · {hora}`. Las notas NUNCA se envían a WhatsApp (solo Firestore).

3. **Banner de estado del bot** (bajo el header, encima de mensajes): si `mode==='PAUSED'` → banner amber: "⏸ Bot en pausa{pausedUntil ? \` hasta las \${horaLocal}\` : ' hasta que lo reactives'} — nadie responde automáticamente". Si `mode==='HUMAN'` → banner emerald sutil: "🖐 Control humano activo — el bot no responde en esta conversación". `pausedUntil` es string canónico UTC → parsear con `parseCanonical` y mostrar hora local `toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'})`.

4. **Estado de conversación en el header**: `Select` (shadcn) compacto con las 5 opciones de `STATUS_META`, valor `contact?.status ?? 'nuevo'`; onChange → `upsertContact(fs, phone, {status}, uid, \`Estado → \${label}\`)` + toast. El uid del usuario: `useUser()` de `@/firebase` (verificar el hook exacto exportado — `useUser` existe en `src/firebase/index.ts`).

5. **Chip de sugerencia del bot**: si `conv.suggestedClassification` existe y `contact?.classification !== conv.suggestedClassification` → chip violeta bajo el header: "El bot sugiere: {label} — [Confirmar]" → `upsertContact(..., {classification: sugerida}, uid, \`Clasificación confirmada: \${label}\`)`. Nunca auto-aplicar.

6. **Header derecha**: botón icono `PanelRight` (lucide) que llama `onOpenPanel` (abre/cierra panel de Task 8) + `ModeToggle` existente.

7. **Composer v2**: toggle segmentado a la izquierda del textarea: `[Mensaje | Nota]` (dos botones pequeños). En modo Nota: borde/acento violeta, placeholder "Nota interna (no se envía por WhatsApp)…", habilitado en CUALQUIER modo (también BOT), submit → `addContactNote(fs, phone, text, uid)` + limpiar. En modo Mensaje: comportamiento actual intacto (solo HUMAN).

**Steps:** implementar → typecheck+lint → commit `feat(whatsapp): hilo con fechas, notas internas, banners de pausa y estado`.

---

### Task 8: ContactPanel derecho + pausa temporal en ModeToggle + quick actions CRM

**Files:**
- Create: `src/components/whatsapp-inbox/ContactPanel.tsx`
- Modify: `src/components/whatsapp-inbox/InboxShell.tsx` (tercer panel), `src/components/whatsapp-inbox/ModeToggle.tsx` (dropdown de pausa), `src/components/crm/CRMContextCore.tsx` (**solo** hacer que `addClient` retorne el id del cliente creado: `string | null` — cambio backward-compatible, verificar los call sites existentes no rompen)

**Spec:**

1. **InboxShell 3 paneles**: `lista (md:w-80 lg:w-96) | hilo (flex-1 min-w-0) | ContactPanel (w-80 shrink-0)`. Panel visible si `panelOpen && selectedPhone`; en `<xl` se muestra como overlay absoluto a la derecha (`absolute right-0 inset-y-0 z-20 border-l bg-[#0a0a0b] shadow-2xl`) para no aplastar el hilo en laptop; en `xl+` como columna normal. Botón de cierre (X) dentro del panel.

2. **ContactPanel** — props `{ tenantId, phone, contact?: WhatsAppContact, conv?: InboxConversation, onClose }`. Secciones (cards `border-zinc-800/60 rounded-xl p-3 space-y-*`, títulos `text-[11px] uppercase tracking-wider text-zinc-500`):
   - **Identidad**: input nombre (inline, guarda on-blur/Enter via `upsertContact(..., {name}, uid, 'Nombre actualizado')`), teléfono con botón copiar (`navigator.clipboard` + toast), "Última interacción: {relativo de conv.lastMessageAt}".
   - **Clasificación**: `Select` con `CLASSIFICATION_META` (+ opción "Sin clasificar" → null); sugerencia del bot como hint si difiere. Toggle `Urgente` (Switch shadcn) → `{urgent}`.
   - **Atención**: estado (mismo Select que el header del hilo — componente pequeño compartido o duplicación mínima aceptable), responsable: botón "Asignarme" / "Quitar" (`assignedTo: uid | null`), origen: input corto (ej. "Anuncio IG").
   - **Etiquetas**: chips removibles (x) + input "Nueva etiqueta ⏎" → `{tags: [...existentes, nueva]}` (dedupe, lowercase, máx 10).
   - **Bot**: estado del modo (chip actual) + `ModeToggle` (reuso) + si pausado, "hasta {hora}".
   - **Acciones** (botones full-width, jerarquía: primario cyan, secundarios ghost):
     - **Guardar contacto** — visible solo si no existe doc (`!contact`): crea con `upsertContact(fs, phone, {name: nombreInput || undefined, status:'nuevo', createdAt: serverTimestamp() as any}, uid, 'Contacto guardado')`.
     - **Convertir en cliente** — si `!contact?.linkedClientId`: llama `useCRM().addClient({name: contact?.name || phone, phone, contactName: contact?.name, notes: 'Origen: WhatsApp Inbox'})`; con el id retornado → `upsertContact(..., {linkedClientId: id, classification:'cliente'}, uid, 'Convertido en cliente CRM')` + toast éxito/error. Si ya está vinculado → texto "Vinculado al CRM ✓".
     - **Crear seguimiento** — habilitado solo si `linkedClientId` apunta a un cliente del CRM con ≥1 proyecto (leer de `useCRM().clients`): select inline de proyecto (si hay varios) + `addTask(clientId, projectId, {name: \`Seguimiento WhatsApp — \${contact?.name || phone}\`, desc: \`Conversación: \${phone}\`, prio: 'important'})` + historial. Si no → hint "Vincula un cliente con proyecto para crear seguimientos".
     - **Crear ticket de soporte** — `Popover` con `Textarea` "¿Cuál es el problema?" + botón: `addDoc(collection(fs,'tickets'), {ticketId: \`WA-\${Date.now().toString(36).toUpperCase()}\`, problema, estado: 'abierto', phone, nombre: contact?.name ?? null, source: 'whatsapp', createdAt: serverTimestamp()})` + historial `'Ticket creado: WA-…'` + toast con el folio.
     - **Marcar como resuelto** — `{status:'resuelto'}` + historial.
     - **Archivar** — `{status:'archivado'}` + historial.
   - **Notas**: lista compacta de las últimas 5 (`notesQuery` ya suscrita en el hilo — repetir suscripción aquí es aceptable, o levantarla a InboxShell si simple) + input rápido para añadir.
   - **Historial breve**: últimas 5 entradas de `actionHistory` invertido: `"{acción} · {fecha corta}"` en `text-xs text-zinc-500`.

3. **ModeToggle v2**: tercer control pasa a dropdown (shadcn `DropdownMenu`): trigger "Pausar ▾" (o el chip PAUSED activo) con items: `30 minutos`, `1 hora`, `2 horas`, `Hasta resolver`. Los 3 primeros → `pausedUntil = new Date(Date.now() + ms).toISOString()`; "Hasta resolver" → sin `pausedUntil`. POST a `/api/whatsapp-inbox/mode` con `{phone, mode:'PAUSED', pausedUntil?}`. Toasts: "Bot en pausa 30 min" etc.

4. **CRMContextCore.addClient** → retorna el `id` generado (`return newClient.id;` y ajustar tipo en la interfaz del contexto). Verificar que ningún call site rompa (retorno antes era void — nadie lo usa → seguro).

**Steps:** implementar → typecheck+lint → commit `feat(whatsapp): panel de contacto, pausa temporal y quick actions CRM`.

---

### Task 9: BotConfigView — formulario completo de configuración del bot

**Files:**
- Modify: `src/components/whatsapp-inbox/BotConfigView.tsx` (reemplaza stub)

**Spec:**

- Carga con `GET /api/whatsapp-inbox/config` al montar (estados loading/error/retry). Estado local `config: BotConfig` + `dirty` (comparación JSON con lo cargado). Barra sticky inferior con "Guardar cambios" (deshabilitado si `!dirty || saving`) + "Descartar".
- Guardar → `PUT /api/whatsapp-inbox/config` `{config}` → toast éxito ("El bot ya responde con la nueva configuración") / error con `detail`.
- Layout: grid `xl:grid-cols-2 gap-4` de cards (mismo estilo de cards del ContactPanel), secciones:
  1. **Identidad** — Input nombre del bot (máx 60); Select tono (4 opciones con descripción corta debajo: Formal/Cercano/Técnico/Comercial).
  2. **Tiempos y horario** — Input numérico delay en segundos (0-600, hint "default 30 — pausa humanizada antes de responder"); días de atención: 7 toggles D-L-M-M-J-V-S (`days` 0-6); dos `<input type="time">` start/end (estilizados dark); hint "Hora de Vallarta".
  3. **Mensajes** — 3 Textareas (máx 1000): fuera de horario, mensaje inicial, mensaje al escalar a humano.
  4. **Qué SÍ puede responder** — editor de lista tipo tags (chips + input ⏎, máx 20 items de 200 chars).
  5. **Qué NO puede responder** — mismo editor (chips rojos).
  6. **Reglas de escalamiento a humano** — mismo editor (chips amber).
  7. **Preguntas obligatorias para cotización** — mismo editor, con hint de orden.
  El editor de listas: extraer componente interno `ListEditor({label, hint, items, onChange, accent})` dentro del mismo archivo (no crear archivo aparte).
- Validaciones client-side espejo del bot (delay rango, HH:MM implícito por input time, strings no vacíos al agregar) — el server valida de verdad.
- Pie de card informativo: "Los cambios aplican al siguiente mensaje que reciba el bot (cache ~60s). El prompt base de identidad PIXELTEC no se edita desde aquí."
- Mostrar `updated_at`/`updated_by` si existen ("Última edición: …").

**Steps:** implementar → typecheck+lint → commit `feat(whatsapp): configuracion del bot editable desde el dashboard`.

---

### Task 10: Verificación global + pulido

**Steps:**
1. Suite pixelbot completa en contenedor py3.12 → todo verde (94 base + nuevos).
2. `npm run typecheck && npm run lint && npm run build` → 0 errores nuevos, build OK.
3. Smoke E2E containerizado (mismo patrón del smoke anterior, bot efímero puerto 8100 + DB temporal + tenant seed): `GET /internal/config` → defaults; `PUT` con tone inválido → 400; `PUT` válido → 200; `POST mode PAUSED con paused_until pasado` → 200; verificar en SQLite del contenedor que un inbound simulado NO aplica (no hay Meta real — basta validar endpoints + que `resolver_modo_efectivo` quedó cubierto por unit tests).
4. Pulido: revisar que los 3 paneles no rompen en 1024px (laptop: panel como overlay), transiciones `transition-colors` en chips/botones nuevos, focus-visible rings en inputs nuevos, ningún texto en inglés en UI.
5. `git status` limpio en ambos repos (solo esperables). Reporte final: archivos modificados, funciones listas, qué depende de Meta/API real.

---

## Self-Review

- **Cobertura del spec de Miguel:** filtros+búsqueda+badges → T6; burbujas diferenciadas+fechas+24h+estado+acciones → T7/T8 (24h ya existía); Bot/Humano+pausa temporal+aviso+no doble respuesta → T1/T7/T8 (no-doble-respuesta ya existía por modos); panel contacto completo → T8; configuración del bot (10 campos) → T2/T3/T9; clasificación manual+sugerida sin auto-aplicar → T3/T7/T8; notas internas → T4/T7/T8; modelo de datos → T1/T2/T4; UX → constraints + T10.
- **Decisión consciente:** "Crear prospecto" del spec = clasificar como Prospecto (Select del panel) — no crea entidad CRM separada porque el CRM activo no tiene concepto de prospecto standalone; "Crear cliente" sí crea en el CRM real vía `useCRM().addClient`.
- **Riesgos nombrados:** (1) `addClient` retorno — T8 lo cambia con verificación de call sites; (2) merge timeline mensajes+notas depende de `createdAt` serverTimestamp (nota recién creada puede llegar con null un instante — usar fallback `new Date()` al ordenar); (3) out-of-hours responde SIEMPRE fuera de horario (sin dedupe) — aceptado, anotar como fase 2 si molesta; (4) cache de config 60s — documentado en la UI.
