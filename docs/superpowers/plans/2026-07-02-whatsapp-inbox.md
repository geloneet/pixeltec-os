# WhatsApp Inbox (PixelBot ↔ PixelTEC OS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nueva sección `/whatsapp` en PixelTEC OS para ver en tiempo real las conversaciones del bot de WhatsApp Business (PixelBot), tomar control humano de cualquier conversación (el bot se calla), y enviar mensajes manuales como asesor.

**Architecture:** PixelBot ya proyecta cada mensaje a Firestore (`/tenants/{tenantId}/conversations/{phone}/messages/{msgId}`) vía outbox pattern, ya respeta modos `BOT/HUMAN/PAUSED` por conversación (si el modo ≠ BOT persiste el inbound pero no responde — `agent/main.py:313-319`), y ya expone `POST /internal/send` para mensajes manuales del asesor. El plan agrega: (A) en PixelBot, un endpoint interno para cambiar el modo de una conversación que actualiza SQLite (source of truth) y proyecta `mode` + audit log a Firestore; (B) en PixelTEC OS, reglas de Firestore de solo-lectura para `/tenants/**`, dos API routes proxy (`send`, `mode`) protegidas con `requireAdmin` que llaman a PixelBot por la red Docker `web-network` (`http://pixelbot:3011`) con `X-Internal-Secret`, y la UI de inbox en tiempo real con `onSnapshot` (hook `useCollection` existente).

**Tech Stack:** PixelBot: Python 3.11, FastAPI, SQLAlchemy async + SQLite, pytest (`asyncio_mode = auto`). PixelTEC OS: Next.js 15 App Router, Firebase client SDK (realtime) + Admin SDK (server), Tailwind + shadcn/ui, sonner (toasts), lucide-react.

## Global Constraints

- **Dos repos:** Parte A se trabaja en `/home/ubuntu/pixelbot` (repo git propio). Parte B en `/home/ubuntu/pixeltec-os`. Cada uno commitea en su propio repo.
- **NUNCA hacer deploy al VPS ni `firebase deploy` sin autorización explícita de Miguel.** La sección "Lanzamiento" es una checklist manual que ejecuta Miguel o requiere su OK.
- SQLite de PixelBot es **source of truth**; Firestore es proyección write-only desde el bot. El dashboard jamás escribe en `/tenants/**` (rules `write: false`).
- Toda ruta de PixelTEC OS que use Admin SDK declara `export const runtime = "nodejs"`.
- UI en español, dark theme existente (fondo `#030303`, zinc/cyan), componentes shadcn/ui ya instalados.
- PixelBot: formato canónico de timestamps string `'YYYY-MM-DD HH:MM:SS'` (UTC) — usar `format_canonical`/`parse_canonical` de `agent/outbox/time_utils.py`.
- Campos Firestore ya definidos por los writers del bot (no inventar otros):
  - Doc conversación: `lastMessageAt` (string canónico), `lastMessagePreview`, `lastMessageDirection` (`"inbound"|"outbound"`), `updatedAt` (Timestamp), y tras este plan `mode` (`"BOT"|"HUMAN"|"PAUSED"`).
  - Doc mensaje: `id`, `direction`, `from`, `type`, `text`, `mediaUrl`, `caption`, `metaTimestamp` (Timestamp), `deliveryStatus`, `systemEvent`, `createdAt` (Timestamp).
- `INTERNAL_API_SECRET` (bot) y `PIXELBOT_INTERNAL_SECRET` (OS) son el **mismo valor**, mínimo 32 chars, comparación constant-time (ya implementada en `_verify_internal_secret`).
- Nuevas env vars OS (runtime, `.env.production` del VPS — nunca en el repo): `PIXELBOT_INTERNAL_URL`, `PIXELBOT_INTERNAL_SECRET`, `PIXELBOT_TENANT_ID`.

---

## Estado actual (verificado 2026-07-02)

Ya existe y NO hay que construir:

| Pieza | Dónde | Estado |
|---|---|---|
| Multi-tenant SQLite (`tenants`, `conversaciones` con `mode` + `unread_count`, `mensajes`) | `pixelbot/agent/memory.py` | ✅ |
| Bot se calla si `mode != BOT` | `pixelbot/agent/main.py:313-319` | ✅ |
| `POST /internal/send` (mensaje manual del asesor, persiste antes de enviar, `sent_by_uid` para auditoría) | `pixelbot/agent/main.py:380-433` | ✅ |
| Outbox → Firestore con retry + dead-letter Telegram | `pixelbot/agent/firestore_queue.py` | ✅ |
| Writers `write_message`, `update_conversation`, `log_audit` | `pixelbot/agent/firestore_writers.py` | ✅ |
| Hook realtime `useCollection(ref, { listen: true })` | `pixeltec-os/src/firebase/firestore/use-collection.tsx` | ✅ |
| Guard `requireAdmin` + patrón de proxy API (rutas VPS) | `pixeltec-os/src/lib/auth-guards.ts`, `src/app/api/vps/pause/route.ts` | ✅ |
| Ambos containers en la red Docker `web-network` | compose de ambos repos | ✅ |

Falta (lo que cubre este plan): endpoint de cambio de modo en el bot (+ soporte `log_audit` en el dispatcher del outbox), reglas Firestore para `/tenants/**`, proxies y UI en PixelTEC OS, navegación.

**Fuera de alcance (fase 2, no implementar):** contador de no-leídos, envío de plantillas fuera de la ventana de 24h, media saliente (imágenes/audio), listado multi-tenant dinámico (hoy hay un solo tenant; el id va por env var), backfill de mensajes históricos v1, paginación de mensajes (>200).

---

# Parte A — PixelBot (`/home/ubuntu/pixelbot`)

### Task 1: Dispatcher del outbox soporta `log_audit`

El outbox (`pending_firestore_sync`) hoy solo despacha `inbound_message`, `outbound_message` y `update_conversation`. El cambio de modo necesita encolar también un evento de auditoría, así que el dispatcher debe reconocer `operation_type == "log_audit"`.

**Files:**
- Modify: `agent/firestore_queue.py` (función `dispatch`, ~línea 53-88)
- Create: `tests/test_conversation_mode.py`

**Interfaces:**
- Consumes: `log_audit(tenant_id, event, actor_uid, actor_email, target_phone, details)` de `agent/firestore_writers.py` (ya existe, retorna `bool`).
- Produces: `dispatch()` acepta registros con `operation_type="log_audit"` y `payload_json` con claves `tenant_id, event, actor_uid, actor_email, target_phone, details`. Task 2 encola estos registros.

- [ ] **Step 1: Crear el archivo de tests con el test del dispatcher (falla)**

Crear `tests/test_conversation_mode.py`:

```python
# tests/test_conversation_mode.py — Tests de cambio de modo de conversación
#
# Cubre:
#   - dispatch() con operation_type="log_audit" (Task 1)
#   - set_conversacion_mode() atómico (Task 2)
#   - POST /internal/conversations/mode (Task 3)
#
# Aislamiento (mismo patrón que test_internal_send.py):
#   - ASGITransport (httpx) para llamadas HTTP sin levantar el servidor real
#   - mem.async_session y ten.async_session parchados a un engine local
#   - INTERNAL_API_SECRET seteado vía monkeypatch.setenv

import json
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text, select

import agent.memory as mem
import agent.tenants as ten
from agent.main import app
from agent.memory import ConversacionMode, Conversacion, PendingFirestoreSync
from agent.migrations import migration_001, migration_003

TEST_SECRET = "test-internal-secret-exactly-32-chars-x"


# ── Fixtures (mismo patrón que test_internal_send.py) ────────────────────────

@pytest_asyncio.fixture
async def local_engine(tmp_path):
    db = tmp_path / "conversation_mode_test.db"
    engine = create_async_engine(f"sqlite+aiosqlite:///{db}", echo=False)

    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE mensajes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telefono TEXT NOT NULL, role TEXT NOT NULL,
                content TEXT NOT NULL, timestamp TEXT NOT NULL
            )
        """))
        await conn.execute(text("""
            CREATE TABLE mensajes_procesados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mensaje_id TEXT NOT NULL, procesado_en TEXT NOT NULL
            )
        """))

    async with engine.begin() as conn:
        await migration_001.correr(conn)
    async with engine.begin() as conn:
        await migration_003.correr(conn)

    from agent.scripts.bootstrap_first_tenant import bootstrap
    await bootstrap(db_path=str(db), slug="pixeltec", phone_number_id="TEST_PHONE_NUM_ID", dry_run=False)

    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def patched_session(local_engine, monkeypatch):
    local_session = async_sessionmaker(local_engine, class_=AsyncSession, expire_on_commit=False)
    monkeypatch.setattr(mem, "async_session", local_session)
    monkeypatch.setattr(ten, "async_session", local_session)
    return local_session


@pytest_asyncio.fixture
async def tenant_id(local_engine):
    async with local_engine.connect() as conn:
        result = await conn.execute(text("SELECT id FROM tenants WHERE slug='pixeltec'"))
        return result.scalar_one()


def _audit_payload():
    return {
        "tenant_id": "tenant-001",
        "event": "mode_changed",
        "actor_uid": "uid_miguel_001",
        "actor_email": None,
        "target_phone": "+52555900001",
        "details": {"previous_mode": "BOT", "new_mode": "HUMAN"},
    }


def _make_record(operation_type: str, payload: dict):
    record = MagicMock()
    record.id = 42
    record.operation_type = operation_type
    record.payload_json = json.dumps(payload, ensure_ascii=False)
    return record


# ── Task 1: dispatch soporta log_audit ────────────────────────────────────────

async def test_dispatch_log_audit_llama_writer():
    from agent.firestore_queue import dispatch

    record = _make_record("log_audit", _audit_payload())
    with patch("agent.firestore_queue.log_audit", new=AsyncMock(return_value=True)) as mock_audit:
        await dispatch(record)

    mock_audit.assert_awaited_once_with(
        tenant_id="tenant-001",
        event="mode_changed",
        actor_uid="uid_miguel_001",
        actor_email=None,
        target_phone="+52555900001",
        details={"previous_mode": "BOT", "new_mode": "HUMAN"},
    )


async def test_dispatch_log_audit_writer_false_levanta_runtime_error():
    from agent.firestore_queue import dispatch

    record = _make_record("log_audit", _audit_payload())
    with patch("agent.firestore_queue.log_audit", new=AsyncMock(return_value=False)):
        with pytest.raises(RuntimeError):
            await dispatch(record)
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v`
Expected: FAIL — `AttributeError: <module 'agent.firestore_queue'> does not have the attribute 'log_audit'` (el módulo no importa `log_audit` todavía) o `ValueError: operation_type desconocido: 'log_audit'`.

- [ ] **Step 3: Implementar el soporte en `dispatch()`**

En `agent/firestore_queue.py`:

1. Agregar `log_audit` al import existente de writers (busca la línea `from agent.firestore_writers import ...` cerca del top del archivo y añade `log_audit`):

```python
from agent.firestore_writers import write_message, update_conversation, log_audit
```

2. En `dispatch()`, después del bloque `elif record.operation_type == "update_conversation":` y **antes** del `else:` final, insertar:

```python
    elif record.operation_type == "log_audit":
        ok = await log_audit(
            tenant_id=payload["tenant_id"],
            event=payload["event"],
            actor_uid=payload.get("actor_uid"),
            actor_email=payload.get("actor_email"),
            target_phone=payload.get("target_phone"),
            details=payload.get("details"),
        )
        if not ok:
            raise RuntimeError(f"log_audit retornó False para registro {record.id}")
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v`
Expected: 2 PASS

- [ ] **Step 5: Correr la suite completa (regresión) y commit**

Run: `cd /home/ubuntu/pixelbot && pytest -v`
Expected: todo verde (56+ tests previos + 2 nuevos)

```bash
cd /home/ubuntu/pixelbot
git add agent/firestore_queue.py tests/test_conversation_mode.py
git commit -m "feat(outbox): dispatch soporta operation_type log_audit"
```

---

### Task 2: `set_conversacion_mode` atómico en `agent/tenants.py`

Cambia el modo en SQLite y encola en la **misma transacción** la proyección a Firestore (`update_conversation` con `mode`) y el evento de auditoría (`log_audit`). Así el CRM nunca ve un modo que SQLite no tenga.

**Files:**
- Modify: `agent/tenants.py` (agregar función al final)
- Modify: `tests/test_conversation_mode.py` (agregar tests)

**Interfaces:**
- Consumes: `encolar_firestore_sync(tenant_id, operation_type, payload, target_collection, target_doc_path=None, session=None)` de `agent/memory.py` (con `session` NO commitea — el caller controla la transacción). `dispatch()` con `log_audit` (Task 1).
- Produces: `async def set_conversacion_mode(tenant_id: str, phone: str, mode: ConversacionMode, changed_by_uid: str) -> tuple[Conversacion, ConversacionMode]` — retorna `(conversacion_actualizada, modo_anterior)`. Task 3 la consume.

- [ ] **Step 1: Escribir los tests (fallan)**

Agregar al final de `tests/test_conversation_mode.py`:

```python
# ── Task 2: set_conversacion_mode atómico ─────────────────────────────────────

async def test_set_conversacion_mode_actualiza_sqlite_y_encola(patched_session, tenant_id):
    phone = "+52555900001"

    # Pre-crear la conversación en modo BOT
    conv_inicial = await ten.get_or_create_conversacion(tenant_id, phone)
    assert conv_inicial.mode == ConversacionMode.BOT

    conv, previous = await ten.set_conversacion_mode(
        tenant_id, phone, ConversacionMode.HUMAN, "uid_miguel_001"
    )

    assert previous == ConversacionMode.BOT
    assert conv.mode == ConversacionMode.HUMAN
    assert conv.id == conv_inicial.id  # misma conversación, no duplicada

    # SQLite refleja el cambio
    async with patched_session() as session:
        result = await session.execute(select(Conversacion).where(Conversacion.id == conv.id))
        assert result.scalar_one().mode == ConversacionMode.HUMAN

    # Outbox: un update_conversation con mode=HUMAN y un log_audit
    async with patched_session() as session:
        result = await session.execute(select(PendingFirestoreSync))
        records = result.scalars().all()

    ops = {r.operation_type: json.loads(r.payload_json) for r in records}
    assert "update_conversation" in ops
    assert ops["update_conversation"]["mode"] == "HUMAN"
    assert ops["update_conversation"]["phone"] == phone
    assert "log_audit" in ops
    assert ops["log_audit"]["event"] == "mode_changed"
    assert ops["log_audit"]["actor_uid"] == "uid_miguel_001"
    assert ops["log_audit"]["details"] == {"previous_mode": "BOT", "new_mode": "HUMAN"}


async def test_set_conversacion_mode_crea_conversacion_si_no_existe(patched_session, tenant_id):
    phone = "+52555900002"

    conv, previous = await ten.set_conversacion_mode(
        tenant_id, phone, ConversacionMode.PAUSED, "uid_miguel_001"
    )

    assert previous == ConversacionMode.BOT  # modo default de una conv nueva
    assert conv.mode == ConversacionMode.PAUSED
    assert conv.phone == phone
    assert conv.tenant_id == tenant_id
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v -k set_conversacion_mode`
Expected: FAIL — `AttributeError: module 'agent.tenants' has no attribute 'set_conversacion_mode'`

- [ ] **Step 3: Implementar `set_conversacion_mode`**

Agregar al final de `agent/tenants.py`:

```python
async def set_conversacion_mode(
    tenant_id: str,
    phone: str,
    mode: ConversacionMode,
    changed_by_uid: str,
) -> tuple[Conversacion, ConversacionMode]:
    """
    Cambia el modo de la conversación (tenant_id, phone) en SQLite y encola,
    en la MISMA transacción, la proyección del modo a Firestore y el evento
    de auditoría. Si la conversación no existe, la crea (modo previo = BOT).

    Retorna (conversacion_actualizada, modo_anterior).
    """
    from agent.memory import encolar_firestore_sync

    async with async_session() as session:
        result = await session.execute(
            select(Conversacion).where(
                Conversacion.tenant_id == tenant_id,
                Conversacion.phone == phone,
            )
        )
        conv = result.scalar_one_or_none()

        if conv is None:
            conv = Conversacion(
                id=nanoid_generate(),
                tenant_id=tenant_id,
                phone=phone,
                mode=ConversacionMode.BOT,
                unread_count=0,
                created_at=datetime.utcnow(),
            )
            session.add(conv)

        previous_mode = conv.mode
        conv.mode = mode

        await encolar_firestore_sync(
            tenant_id=tenant_id,
            operation_type="update_conversation",
            payload={"tenant_id": tenant_id, "phone": phone, "mode": mode.value},
            target_collection="conversations",
            session=session,
        )
        await encolar_firestore_sync(
            tenant_id=tenant_id,
            operation_type="log_audit",
            payload={
                "tenant_id": tenant_id,
                "event": "mode_changed",
                "actor_uid": changed_by_uid,
                "actor_email": None,
                "target_phone": phone,
                "details": {"previous_mode": previous_mode.value, "new_mode": mode.value},
            },
            target_collection="auditLog",
            session=session,
        )

        await session.commit()
        await session.refresh(conv)
        logger.info(
            f"[MODE] Conversación {phone} (tenant={tenant_id}): "
            f"{previous_mode.value} → {mode.value} by={changed_by_uid}"
        )
        return conv, previous_mode
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/pixelbot
git add agent/tenants.py tests/test_conversation_mode.py
git commit -m "feat(tenants): set_conversacion_mode atomico con outbox mode+audit"
```

---

### Task 3: Endpoint `POST /internal/conversations/mode`

Endpoint interno (mismo esquema de auth que `/internal/send`: header `X-Internal-Secret`, comparación constant-time) para que PixelTEC OS cambie el modo de una conversación.

**Files:**
- Modify: `agent/main.py`
- Modify: `tests/test_conversation_mode.py` (agregar tests)

**Interfaces:**
- Consumes: `set_conversacion_mode` (Task 2), `_verify_internal_secret` y `get_tenant_by_id` (ya existen en `main.py`).
- Produces: `POST /internal/conversations/mode` body `{tenant_id, phone, mode, changed_by_uid}` → `200 {"status":"ok","phone":...,"previous_mode":...,"mode":...}` | `400` modo inválido | `401` secret inválido | `404` tenant inexistente/inactivo | `503` secret no configurado. Parte B (Task 6) lo consume.

- [ ] **Step 1: Escribir los tests del endpoint (fallan)**

Agregar al final de `tests/test_conversation_mode.py`:

```python
# ── Task 3: POST /internal/conversations/mode ────────────────────────────────

def _make_mock_tenant(tid="mock-tenant-id-001", active=True):
    t = MagicMock()
    t.id = tid
    t.active = active
    return t


def _mode_body(mode="HUMAN"):
    return {
        "tenant_id": "mock-tenant-id-001",
        "phone": "+52555900001",
        "mode": mode,
        "changed_by_uid": "uid_miguel_001",
    }


async def _post_mode(body, secret=TEST_SECRET):
    headers = {"X-Internal-Secret": secret} if secret is not None else {}
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.post("/internal/conversations/mode", json=body, headers=headers)


async def test_mode_sin_secret_devuelve_401(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)
    resp = await _post_mode(_mode_body(), secret=None)
    assert resp.status_code == 401


async def test_mode_invalido_devuelve_400(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)
    resp = await _post_mode(_mode_body(mode="ROBOT"))
    assert resp.status_code == 400


async def test_mode_tenant_inexistente_devuelve_404(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)
    with patch("agent.main.get_tenant_by_id", new=AsyncMock(return_value=None)):
        resp = await _post_mode(_mode_body())
    assert resp.status_code == 404


async def test_mode_ok_devuelve_previous_y_nuevo(monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)

    conv = MagicMock()
    conv.mode = ConversacionMode.HUMAN
    with patch("agent.main.get_tenant_by_id", new=AsyncMock(return_value=_make_mock_tenant())), \
         patch("agent.main.set_conversacion_mode",
               new=AsyncMock(return_value=(conv, ConversacionMode.BOT))) as mock_set:
        resp = await _post_mode(_mode_body(mode="HUMAN"))

    assert resp.status_code == 200
    data = resp.json()
    assert data == {
        "status": "ok",
        "phone": "+52555900001",
        "previous_mode": "BOT",
        "mode": "HUMAN",
    }
    mock_set.assert_awaited_once_with(
        "mock-tenant-id-001", "+52555900001", ConversacionMode.HUMAN, "uid_miguel_001"
    )


async def test_mode_end_to_end_persiste_en_sqlite(patched_session, tenant_id, monkeypatch):
    monkeypatch.setenv("INTERNAL_API_SECRET", TEST_SECRET)

    body = {
        "tenant_id": tenant_id,
        "phone": "+52555900003",
        "mode": "HUMAN",
        "changed_by_uid": "uid_miguel_001",
    }
    resp = await _post_mode(body)
    assert resp.status_code == 200

    async with patched_session() as session:
        result = await session.execute(
            select(Conversacion).where(
                Conversacion.tenant_id == tenant_id,
                Conversacion.phone == "+52555900003",
            )
        )
        assert result.scalar_one().mode == ConversacionMode.HUMAN
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v -k mode_`
Expected: FAIL — los POST devuelven 404 (ruta no existe)

- [ ] **Step 3: Implementar el endpoint en `agent/main.py`**

1. En el import de `agent.tenants` (línea ~31-36), agregar `set_conversacion_mode`:

```python
from agent.tenants import (
    get_tenant_by_phone_number_id,
    get_tenant_by_id,
    get_or_create_conversacion,
    update_conversacion_last_message,
    set_conversacion_mode,
)
```

2. Junto a `class InternalSendRequest` (sección "Modelo interno"), agregar:

```python
class InternalModeRequest(BaseModel):
    tenant_id: str
    phone: str
    mode: str  # "BOT" | "HUMAN" | "PAUSED"
    changed_by_uid: str  # uid del asesor PixelTEC OS — auditoría
```

3. Después del endpoint `internal_send` (tras la línea ~433), agregar:

```python
@app.post("/internal/conversations/mode")
async def internal_set_mode(
    body: InternalModeRequest,
    x_internal_secret: str | None = Header(None, alias="X-Internal-Secret"),
):
    """
    Cambia el modo de una conversación (takeover humano / devolver al bot / pausar).
    SQLite es source of truth; el modo y el evento de auditoría se proyectan a
    Firestore vía outbox. Requiere X-Internal-Secret (mismo esquema que /internal/send).
    """
    _verify_internal_secret(x_internal_secret)

    try:
        nuevo_modo = ConversacionMode(body.mode)
    except ValueError:
        raise HTTPException(400, f"Modo inválido: {body.mode!r}. Usa BOT, HUMAN o PAUSED")

    tenant = await get_tenant_by_id(body.tenant_id)
    if not tenant or not tenant.active:
        raise HTTPException(404, "Tenant not found or inactive")

    conv, previous_mode = await set_conversacion_mode(
        tenant.id, body.phone, nuevo_modo, body.changed_by_uid
    )

    logger.info(
        f"[INTERNAL_MODE] tenant={tenant.id} phone={body.phone} "
        f"{previous_mode.value} → {nuevo_modo.value} by_uid={body.changed_by_uid}"
    )
    return {
        "status": "ok",
        "phone": body.phone,
        "previous_mode": previous_mode.value,
        "mode": conv.mode.value,
    }
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `cd /home/ubuntu/pixelbot && pytest tests/test_conversation_mode.py -v`
Expected: 9 PASS

- [ ] **Step 5: Suite completa y commit**

Run: `cd /home/ubuntu/pixelbot && pytest -v`
Expected: todo verde

```bash
cd /home/ubuntu/pixelbot
git add agent/main.py tests/test_conversation_mode.py
git commit -m "feat(internal): endpoint POST /internal/conversations/mode (takeover)"
```

---

# Parte B — PixelTEC OS (`/home/ubuntu/pixeltec-os`)

> PixelTEC OS no tiene framework de tests; las puertas de calidad del repo son `npm run typecheck` + `npm run lint` + verificación manual con `npm run dev` (puerto 9002). Cada task termina con typecheck verde.

### Task 4: Reglas de Firestore para `/tenants/**`

Hoy `/tenants/**` no tiene match → denegado por default, y el inbox necesita lectura realtime desde el browser. Lectura para usuarios autenticados (mismo criterio que `tickets`/`finances`/`tasks`), escritura denegada (solo el SA de PixelBot vía Admin SDK, que bypasea rules).

**Files:**
- Modify: `firestore.rules` (agregar bloque antes del cierre, después del match de `authLockouts`)

**Interfaces:**
- Produces: lectura client-side de `/tenants/{tenantId}`, `/tenants/{tenantId}/conversations/{phone}` y `.../messages/{msgId}` para `request.auth != null`. Tasks 7-9 la consumen.

- [ ] **Step 1: Agregar el bloque de reglas**

En `firestore.rules`, después de la línea `match /authLockouts/{docId} { allow read, write: if false; }` y antes de las dos llaves de cierre finales, insertar:

```
    // ═══════════════════════════════════════════════════════════════
    // PixelBot WhatsApp Inbox — proyección de solo lectura
    // Escrita EXCLUSIVAMENTE por pixelbot vía Admin SDK (SA
    // pixelbot-runtime@...). SQLite del bot = source of truth.
    // El dashboard la lee en tiempo real; toda acción (enviar,
    // takeover) pasa por /api/whatsapp-inbox/* → bot interno.
    // ═══════════════════════════════════════════════════════════════
    match /tenants/{tenantId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
    match /tenants/{tenantId}/{path=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }
```

- [ ] **Step 2: Verificar sintaxis**

Run: `cd /home/ubuntu/pixeltec-os && npx firebase --project studio-1487114664-78b63 deploy --only firestore:rules --dry-run 2>&1 | head -20` — si el CLI no soporta `--dry-run` en esta versión, verificación visual: llaves balanceadas, `rules_version = '2'` intacto.
Expected: sin errores de sintaxis. **NO desplegar las reglas todavía** (va en Lanzamiento, con OK de Miguel).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/pixeltec-os
git add firestore.rules
git commit -m "feat(rules): lectura autenticada de /tenants/** para WhatsApp inbox"
```

---

### Task 5: Tipos, cliente interno de PixelBot y env vars

**Files:**
- Create: `src/types/whatsapp-inbox.ts`
- Create: `src/lib/whatsapp-inbox/pixelbot-client.ts`
- Create: `src/lib/whatsapp-inbox/time.ts`
- Modify: `.env.example` (documentar las 3 vars nuevas)

**Interfaces:**
- Produces:
  - Tipos `WhatsAppMode`, `InboxConversation`, `InboxMessage` (Tasks 6-9).
  - `fetchPixelbot(path: string, body: Record<string, unknown>): Promise<{ data: unknown; status: number }>` — server-only, lanza `Error` si faltan env vars (Task 6).
  - `parseCanonical(s: string): Date` (Tasks 8-9).

- [ ] **Step 1: Crear `src/types/whatsapp-inbox.ts`**

```typescript
import type { Timestamp } from 'firebase/firestore';

/** Modo de una conversación en PixelBot. SQLite del bot = source of truth. */
export type WhatsAppMode = 'BOT' | 'HUMAN' | 'PAUSED';

/**
 * Doc de /tenants/{tenantId}/conversations/{phone}.
 * Escrito por pixelbot (agent/firestore_writers.py — update_conversation).
 * `id` = teléfono E164 (doc id). `lastMessageAt` usa el formato canónico
 * del bot 'YYYY-MM-DD HH:MM:SS' (UTC) — parsear con parseCanonical().
 */
export interface InboxConversation {
  id: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastMessageDirection?: 'inbound' | 'outbound';
  mode?: WhatsAppMode; // ausente en docs previos al takeover → tratar como 'BOT'
  updatedAt?: Timestamp;
}

/**
 * Doc de /tenants/{tenantId}/conversations/{phone}/messages/{msgId}.
 * Escrito por pixelbot (agent/firestore_writers.py — write_message).
 */
export interface InboxMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  /** "bot" | uid Firebase del asesor | teléfono del cliente */
  from?: string | null;
  type: string;
  text?: string | null;
  mediaUrl?: string | null;
  caption?: string | null;
  metaTimestamp?: Timestamp;
  deliveryStatus?: string | null;
  systemEvent?: string | null;
  createdAt?: Timestamp;
}

/** Respuestas del bot vía los proxies /api/whatsapp-inbox/*. */
export interface SendResult {
  status: 'sent' | 'persisted_but_send_failed';
  phone: string;
}

export interface ModeResult {
  status: 'ok';
  phone: string;
  previous_mode: WhatsAppMode;
  mode: WhatsAppMode;
}
```

- [ ] **Step 2: Crear `src/lib/whatsapp-inbox/pixelbot-client.ts`**

```typescript
/**
 * Cliente server-side hacia la API interna de PixelBot.
 *
 * PixelBot corre como container `pixelbot` en la red Docker `web-network`
 * (misma red que este app). En producción PIXELBOT_INTERNAL_URL es
 * http://pixelbot:3011; en dev local (el VPS mismo) http://127.0.0.1:3011.
 *
 * Solo usar desde API routes / server actions — el secret jamás llega al browser.
 */

export async function fetchPixelbot(
  path: string,
  body: Record<string, unknown>
): Promise<{ data: unknown; status: number }> {
  const baseUrl = process.env.PIXELBOT_INTERNAL_URL;
  const secret = process.env.PIXELBOT_INTERNAL_SECRET;

  if (!baseUrl || !secret) {
    throw new Error('PIXELBOT_INTERNAL_URL / PIXELBOT_INTERNAL_SECRET no configurados');
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json().catch(() => ({}));
  return { data, status: res.status };
}
```

- [ ] **Step 3: Crear `src/lib/whatsapp-inbox/time.ts`**

```typescript
/**
 * PixelBot serializa timestamps de conversación como string canónico
 * 'YYYY-MM-DD HH:MM:SS' en UTC (agent/outbox/time_utils.py).
 */
export function parseCanonical(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z');
}
```

- [ ] **Step 4: Documentar env vars en `.env.example`**

Agregar al final de `.env.example`:

```bash
# ── PixelBot WhatsApp Inbox ──────────────────────────────────────────
# URL interna del bot. Producción (Docker web-network): http://pixelbot:3011
# Dev local en el VPS: http://127.0.0.1:3011
PIXELBOT_INTERNAL_URL=http://pixelbot:3011
# Mismo valor que INTERNAL_API_SECRET en el .env.production de pixelbot.
# Generar con: openssl rand -hex 32
PIXELBOT_INTERNAL_SECRET=change-me-use-a-32-plus-char-random-string
# ID del tenant en SQLite del bot:
# docker exec pixelbot python3 -c "import sqlite3; print(sqlite3.connect('/app/data/agentkit.db').execute('SELECT id, slug FROM tenants').fetchall())"
PIXELBOT_TENANT_ID=
```

- [ ] **Step 5: Typecheck y commit**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck`
Expected: 0 errores

```bash
cd /home/ubuntu/pixeltec-os
git add src/types/whatsapp-inbox.ts src/lib/whatsapp-inbox/ .env.example
git commit -m "feat(whatsapp-inbox): tipos, cliente interno pixelbot y env vars"
```

---

### Task 6: API routes proxy `/api/whatsapp-inbox/send` y `/api/whatsapp-inbox/mode`

Mismo patrón que las rutas VPS: `requireAdmin` con audit context, validación de body, proxy al bot. El `uid` del guard se inyecta como `sent_by_uid`/`changed_by_uid` — el browser nunca elige la identidad.

> Namespace `whatsapp-inbox` (no `whatsapp`): `/api/whatsapp/*` ya existe y es el webhook del número de notificaciones del asistente — no mezclar.

**Files:**
- Create: `src/app/api/whatsapp-inbox/send/route.ts`
- Create: `src/app/api/whatsapp-inbox/mode/route.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`src/lib/auth-guards.ts`), `fetchPixelbot` (Task 5), endpoints del bot (`/internal/send` existente, `/internal/conversations/mode` de Task 3).
- Produces:
  - `POST /api/whatsapp-inbox/send` body `{phone: string, text: string}` → passthrough del bot (`SendResult`) o `400/401/403/500/503`.
  - `POST /api/whatsapp-inbox/mode` body `{phone: string, mode: WhatsAppMode}` → passthrough del bot (`ModeResult`) o `400/401/403/500/503`. Task 9 los consume.

- [ ] **Step 1: Crear `src/app/api/whatsapp-inbox/send/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/send",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone, text } = await req.json();
    if (typeof phone !== "string" || !phone.trim() || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "phone y text son requeridos" }, { status: 400 });
    }
    if (text.length > 4096) {
      return NextResponse.json({ error: "text excede 4096 caracteres" }, { status: 400 });
    }

    const tenantId = process.env.PIXELBOT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
    }

    const { data, status } = await fetchPixelbot("/internal/send", {
      tenant_id: tenantId,
      phone: phone.trim(),
      text,
      sent_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Send failed: " + message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Crear `src/app/api/whatsapp-inbox/mode/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";

export const runtime = "nodejs";

const VALID_MODES = ["BOT", "HUMAN", "PAUSED"] as const;

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req.cookies.get("__session")?.value, {
    route: "/api/whatsapp-inbox/mode",
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const { phone, mode } = await req.json();
    if (typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ error: "phone es requerido" }, { status: 400 });
    }
    if (!VALID_MODES.includes(mode)) {
      return NextResponse.json(
        { error: "mode debe ser BOT, HUMAN o PAUSED" },
        { status: 400 }
      );
    }

    const tenantId = process.env.PIXELBOT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "PIXELBOT_TENANT_ID no configurado" }, { status: 503 });
    }

    const { data, status } = await fetchPixelbot("/internal/conversations/mode", {
      tenant_id: tenantId,
      phone: phone.trim(),
      mode,
      changed_by_uid: guard.uid,
    });
    return NextResponse.json(data, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Mode change failed: " + message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Typecheck y commit**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck`
Expected: 0 errores

```bash
cd /home/ubuntu/pixeltec-os
git add src/app/api/whatsapp-inbox/
git commit -m "feat(api): proxies whatsapp-inbox send/mode hacia pixelbot interno"
```

---

### Task 7: Navegación + ruta `/whatsapp` (shell de la página)

**Files:**
- Modify: `src/lib/routes/admin-routes.ts` (agregar `'whatsapp'` a `ADMIN_ROUTES`)
- Modify: `src/components/nav/command-palette-items.ts` (item de nav — sidebar y ⌘K se derivan solos)
- Create: `src/app/(admin)/whatsapp/page.tsx`
- Create: `src/components/whatsapp-inbox/InboxShell.tsx`

**Interfaces:**
- Consumes: tipos de Task 5.
- Produces: ruta protegida `/whatsapp` con layout de dos paneles. `InboxShell` mantiene el estado `selectedPhone: string | null` y renderiza `ConversationList` (Task 8) y `ChatThread` (Task 9). Para que esta task compile sola, `InboxShell` se crea con placeholders internos que Tasks 8-9 reemplazan.

- [ ] **Step 1: Registrar la ruta en `admin-routes.ts`**

En `src/lib/routes/admin-routes.ts`, dentro del array `ADMIN_ROUTES`, agregar `'whatsapp',` después de `'clientes',`:

```typescript
export const ADMIN_ROUTES = [
  'hoy',
  'tareas',
  'proyectos',
  'clientes',
  'whatsapp',
  'cobros',
  'accesos',
  'vps',
  'portal',
  'crypto-intel',
  'perfil',
  'notificaciones',
  'blog-admin',
  'crecimiento',
  'documentos',
  'ia-factory',
] as const;
```

(El middleware usa matcher amplio y deriva `PROTECTED_PATHS`/`KNOWN_ROUTES` de este array — no hay que tocar `middleware.ts`.)

- [ ] **Step 2: Agregar el item de navegación**

En `src/components/nav/command-palette-items.ts`:

1. Agregar `MessageCircle` al import de `lucide-react` existente.
2. En `PALETTE_NAV_ITEMS`, dentro de la sección `trabajo` (después del item de `/clientes`), agregar:

```typescript
  {
    href: "/whatsapp",
    label: "WhatsApp",
    description: "Inbox del bot: conversaciones en vivo, takeover humano y envío manual",
    icon: MessageCircle,
    section: "trabajo",
  },
```

- [ ] **Step 3: Crear la página `src/app/(admin)/whatsapp/page.tsx`**

Server component: lee `PIXELBOT_TENANT_ID` en runtime (no build-time) y lo pasa al shell client-side.

```tsx
import { InboxShell } from "@/components/whatsapp-inbox/InboxShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WhatsApp | PixelTEC OS",
};

export default function WhatsAppInboxPage() {
  const tenantId = process.env.PIXELBOT_TENANT_ID ?? "";
  return <InboxShell tenantId={tenantId} />;
}
```

- [ ] **Step 4: Crear `src/components/whatsapp-inbox/InboxShell.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

interface InboxShellProps {
  tenantId: string;
}

/**
 * Layout de dos paneles del inbox de WhatsApp.
 * - Desktop (≥768px): lista de conversaciones + hilo lado a lado.
 * - Mobile: un panel a la vez (lista ↔ hilo con botón de regreso).
 */
export function InboxShell({ tenantId }: InboxShellProps) {
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);

  if (!tenantId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
          <MessageCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
          <h2 className="mb-2 text-lg font-semibold text-zinc-100">Inbox no configurado</h2>
          <p className="text-sm text-zinc-400">
            Falta <code className="text-amber-300">PIXELBOT_TENANT_ID</code> en las variables de
            entorno. Obtén el id del tenant desde el SQLite de pixelbot y redeploy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Panel izquierdo: lista de conversaciones */}
      <div
        className={
          "w-full border-r border-zinc-800/60 md:block md:w-80 lg:w-96 " +
          (selectedPhone ? "hidden" : "block")
        }
      >
        {/* Task 8 reemplaza este placeholder por <ConversationList /> */}
        <div className="p-4 text-sm text-zinc-500">Conversaciones…</div>
      </div>

      {/* Panel derecho: hilo activo */}
      <div className={"min-w-0 flex-1 md:block " + (selectedPhone ? "block" : "hidden")}>
        {/* Task 9 reemplaza este placeholder por <ChatThread /> */}
        <div className="flex h-full items-center justify-center text-sm text-zinc-500">
          {selectedPhone ?? "Selecciona una conversación"}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificación manual + typecheck + commit**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck && npm run lint`
Expected: 0 errores. Opcional: `npm run dev` → `http://localhost:9002/whatsapp` muestra el shell (o el aviso de configuración si no hay `PIXELBOT_TENANT_ID` en `.env.local`), la ruta pide sesión, y "WhatsApp" aparece en sidebar y ⌘K.

```bash
cd /home/ubuntu/pixeltec-os
git add src/lib/routes/admin-routes.ts src/components/nav/command-palette-items.ts "src/app/(admin)/whatsapp/" src/components/whatsapp-inbox/
git commit -m "feat(whatsapp): ruta /whatsapp protegida, nav y shell del inbox"
```

---

### Task 8: `ConversationList` en tiempo real

**Files:**
- Create: `src/components/whatsapp-inbox/ConversationList.tsx`
- Modify: `src/components/whatsapp-inbox/InboxShell.tsx` (reemplazar placeholder del panel izquierdo)

**Interfaces:**
- Consumes: `useFirestore`, `useCollection` (de `@/firebase`), `InboxConversation`, `parseCanonical`.
- Produces: `<ConversationList tenantId={string} selectedPhone={string | null} onSelect={(phone: string) => void} />` — lista realtime ordenada por `lastMessageAt` desc.

- [ ] **Step 1: Crear `src/components/whatsapp-inbox/ConversationList.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { collection, orderBy, query, type Query } from "firebase/firestore";
import { Bot, Hand, LoaderCircle, PauseCircle } from "lucide-react";
import { useCollection, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import type { InboxConversation, WhatsAppMode } from "@/types/whatsapp-inbox";

const MODE_META: Record<WhatsAppMode, { label: string; icon: typeof Bot; className: string }> = {
  BOT: { label: "Bot", icon: Bot, className: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30" },
  HUMAN: { label: "Tú", icon: Hand, className: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  PAUSED: { label: "Pausa", icon: PauseCircle, className: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
};

function formatRelative(canonical?: string): string {
  if (!canonical) return "";
  const date = parseCanonical(canonical);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

interface ConversationListProps {
  tenantId: string;
  selectedPhone: string | null;
  onSelect: (phone: string) => void;
}

export function ConversationList({ tenantId, selectedPhone, onSelect }: ConversationListProps) {
  const firestore = useFirestore();

  // Nota: orderBy('lastMessageAt') excluye docs sin ese campo — solo aparecen
  // conversaciones con al menos un mensaje proyectado, que es lo deseado.
  const ref = useMemo(() => {
    if (!firestore || !tenantId) return null;
    return query(
      collection(firestore, "tenants", tenantId, "conversations"),
      orderBy("lastMessageAt", "desc")
    ) as Query<InboxConversation>;
  }, [firestore, tenantId]);

  const { data: conversations, loading, error } = useCollection<InboxConversation>(ref, {
    listen: true,
  });

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-400">
        Error cargando conversaciones: {error.message}
      </div>
    );
  }

  if (!conversations?.length) {
    return (
      <div className="p-6 text-center text-sm text-zinc-500">
        Sin conversaciones todavía. Cuando alguien le escriba al bot, aparecerá aquí.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-800/60 px-4 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          WhatsApp — {conversations.length} conversación{conversations.length === 1 ? "" : "es"}
        </h1>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {conversations.map((conv) => {
          const mode = MODE_META[conv.mode ?? "BOT"];
          const ModeIcon = mode.icon;
          const isSelected = conv.id === selectedPhone;
          const hasInboundLast = conv.lastMessageDirection === "inbound";
          return (
            <li key={conv.id}>
              <button
                type="button"
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-zinc-900 px-4 py-3 text-left transition-colors",
                  isSelected ? "bg-zinc-800/60" : "hover:bg-zinc-900/60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {hasInboundLast && (
                      <span
                        aria-label="Último mensaje del cliente"
                        className="h-2 w-2 flex-shrink-0 rounded-full bg-cyan-400"
                      />
                    )}
                    <span className="truncate font-medium text-zinc-100">{conv.id}</span>
                    <span className="ml-auto flex-shrink-0 text-xs text-zinc-500">
                      {formatRelative(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-zinc-400">
                    {conv.lastMessagePreview ?? ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "mt-0.5 inline-flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    mode.className
                  )}
                >
                  <ModeIcon className="h-3 w-3" />
                  {mode.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Conectar la lista en `InboxShell.tsx`**

En `src/components/whatsapp-inbox/InboxShell.tsx`, agregar el import y reemplazar el placeholder del panel izquierdo:

```tsx
import { ConversationList } from "./ConversationList";
```

```tsx
      {/* Panel izquierdo: lista de conversaciones */}
      <div
        className={
          "w-full border-r border-zinc-800/60 md:block md:w-80 lg:w-96 " +
          (selectedPhone ? "hidden" : "block")
        }
      >
        <ConversationList
          tenantId={tenantId}
          selectedPhone={selectedPhone}
          onSelect={setSelectedPhone}
        />
      </div>
```

- [ ] **Step 3: Typecheck + verificación manual + commit**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck && npm run lint`
Expected: 0 errores. Manual (requiere reglas de Task 4 desplegadas o emulador): `/whatsapp` lista las conversaciones reales en tiempo real. Si las reglas aún no están desplegadas se verá `permission-denied` en el panel de error — esperado hasta el Lanzamiento.

```bash
cd /home/ubuntu/pixeltec-os
git add src/components/whatsapp-inbox/
git commit -m "feat(whatsapp): lista de conversaciones realtime desde Firestore"
```

---

### Task 9: `ChatThread` + `Composer` + `ModeToggle` (takeover)

El hilo de mensajes en vivo, el control de modo (Bot / Control humano / Pausa) y el composer. Reglas de UX que evitan pisarse con el bot:

- El composer solo se habilita en modo `HUMAN` — para escribir hay que "Tomar control" primero (evita respuesta doble bot+humano).
- Banner de ventana de 24h: Meta solo permite mensajes de sesión dentro de 24h desde el último mensaje **del cliente**; fuera de ella se muestra advertencia (el envío igual se intenta; Meta lo rechazará y el bot responde `persisted_but_send_failed`).
- El cambio de modo y el eco del mensaje enviado llegan por el outbox del bot → pueden tardar unos segundos en reflejarse en Firestore. El toast confirma la acción de inmediato; el chip se actualiza cuando llega el snapshot.

**Files:**
- Create: `src/components/whatsapp-inbox/ChatThread.tsx`
- Create: `src/components/whatsapp-inbox/ModeToggle.tsx`
- Create: `src/components/whatsapp-inbox/Composer.tsx`
- Modify: `src/components/whatsapp-inbox/InboxShell.tsx` (reemplazar placeholder del panel derecho)

**Interfaces:**
- Consumes: `useCollection`/`useDoc`/`useFirestore` (de `@/firebase`), `InboxMessage`, `InboxConversation`, `WhatsAppMode`, `SendResult`, `ModeResult`, API routes de Task 6, `toast` de `sonner` (ya montado en el layout admin).
- Produces:
  - `<ChatThread tenantId={string} phone={string} onBack={() => void} />`
  - `<ModeToggle mode={WhatsAppMode} phone={string} />` (interno, usado por ChatThread)
  - `<Composer phone={string} mode={WhatsAppMode} windowOpen={boolean} />` (interno, usado por ChatThread)

- [ ] **Step 1: Crear `src/components/whatsapp-inbox/ModeToggle.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Bot, Hand, LoaderCircle, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ModeResult, WhatsAppMode } from "@/types/whatsapp-inbox";

const OPTIONS: { mode: WhatsAppMode; label: string; icon: typeof Bot; activeClass: string }[] = [
  { mode: "BOT", label: "Bot", icon: Bot, activeClass: "bg-cyan-500/15 text-cyan-300 border-cyan-500/40" },
  { mode: "HUMAN", label: "Control humano", icon: Hand, activeClass: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40" },
  { mode: "PAUSED", label: "Pausa", icon: PauseCircle, activeClass: "bg-amber-500/15 text-amber-300 border-amber-500/40" },
];

interface ModeToggleProps {
  phone: string;
  mode: WhatsAppMode;
}

export function ModeToggle({ phone, mode }: ModeToggleProps) {
  const [pending, setPending] = useState<WhatsAppMode | null>(null);

  async function changeMode(next: WhatsAppMode) {
    if (next === mode || pending) return;
    setPending(next);
    try {
      const res = await fetch("/api/whatsapp-inbox/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, mode: next }),
      });
      const data = (await res.json()) as ModeResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      toast.success(
        next === "HUMAN"
          ? "Tomaste el control — el bot ya no responde en esta conversación"
          : next === "BOT"
            ? "Conversación devuelta al bot"
            : "Conversación en pausa — nadie responde automáticamente"
      );
    } catch (err) {
      toast.error(`No se pudo cambiar el modo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
      {OPTIONS.map(({ mode: m, label, icon: Icon, activeClass }) => (
        <button
          key={m}
          type="button"
          disabled={pending !== null}
          onClick={() => changeMode(m)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1 text-xs font-medium transition-colors",
            mode === m ? activeClass : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          {pending === m ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crear `src/components/whatsapp-inbox/Composer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";
import type { SendResult, WhatsAppMode } from "@/types/whatsapp-inbox";

interface ComposerProps {
  phone: string;
  mode: WhatsAppMode;
  windowOpen: boolean;
}

export function Composer({ phone, mode, windowOpen }: ComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const canWrite = mode === "HUMAN";

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending || !canWrite) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp-inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, text: trimmed }),
      });
      const data = (await res.json()) as SendResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      if (data.status === "persisted_but_send_failed") {
        toast.warning(
          "Meta rechazó el envío (¿ventana de 24h cerrada?). El mensaje quedó registrado en el bot."
        );
      } else {
        setText("");
      }
      // El eco del mensaje llega vía Firestore (outbox del bot) en unos segundos.
    } catch (err) {
      toast.error(`Error enviando: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="border-t border-zinc-800/60 p-3">
      {!windowOpen && canWrite && (
        <p className="mb-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-xs text-amber-300">
          Ventana de 24h cerrada: Meta solo acepta plantillas aprobadas. El envío libre
          probablemente falle.
        </p>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={4096}
          disabled={!canWrite || sending}
          placeholder={
            canWrite
              ? "Escribe como PIXELTEC… (Enter envía, Shift+Enter salto de línea)"
              : 'Toma el control ("Control humano") para escribir'
          }
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!canWrite || sending || !text.trim()}
          className="inline-flex h-[44px] items-center gap-2 rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
          Enviar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Crear `src/components/whatsapp-inbox/ChatThread.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  collection,
  doc,
  limitToLast,
  orderBy,
  query,
  type DocumentReference,
  type Query,
} from "firebase/firestore";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { useCollection, useDoc, useFirestore } from "@/firebase";
import { cn } from "@/lib/utils";
import type { InboxConversation, InboxMessage } from "@/types/whatsapp-inbox";
import { Composer } from "./Composer";
import { ModeToggle } from "./ModeToggle";

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 200;

function formatTime(msg: InboxMessage): string {
  const ts = msg.metaTimestamp ?? msg.createdAt;
  if (!ts) return "";
  return ts.toDate().toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChatThreadProps {
  tenantId: string;
  phone: string;
  onBack: () => void;
}

export function ChatThread({ tenantId, phone, onBack }: ChatThreadProps) {
  const firestore = useFirestore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const convRef = useMemo(() => {
    if (!firestore) return null;
    return doc(
      firestore,
      "tenants",
      tenantId,
      "conversations",
      phone
    ) as DocumentReference<InboxConversation>;
  }, [firestore, tenantId, phone]);

  const messagesRef = useMemo(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, "tenants", tenantId, "conversations", phone, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(MAX_MESSAGES)
    ) as Query<InboxMessage>;
  }, [firestore, tenantId, phone]);

  const { data: conv } = useDoc<InboxConversation>(convRef, { listen: true });
  const { data: messages, loading } = useCollection<InboxMessage>(messagesRef, { listen: true });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const mode = conv?.mode ?? "BOT";

  // Ventana de 24h de Meta: cuenta desde el último mensaje DEL CLIENTE (inbound).
  const windowOpen = useMemo(() => {
    const lastInbound = [...(messages ?? [])]
      .reverse()
      .find((m) => m.direction === "inbound");
    const ts = lastInbound?.metaTimestamp ?? lastInbound?.createdAt;
    if (!ts) return false;
    return Date.now() - ts.toDate().getTime() < WINDOW_MS;
  }, [messages]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header del hilo */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800/60 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1 text-zinc-400 hover:text-zinc-100 md:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-semibold text-zinc-100">{phone}</h2>
          <p className="text-xs text-zinc-500">
            {windowOpen ? "Ventana de 24h abierta" : "Ventana de 24h cerrada"}
          </p>
        </div>
        <ModeToggle phone={phone} mode={mode} />
      </div>

      {/* Mensajes */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="flex justify-center py-8">
            <LoaderCircle className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}
        {messages?.map((msg) => {
          const isOutbound = msg.direction === "outbound";
          const isManual = isOutbound && msg.from !== "bot";
          return (
            <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                  isOutbound
                    ? isManual
                      ? "rounded-br-sm bg-emerald-600/25 text-emerald-50"
                      : "rounded-br-sm bg-cyan-600/25 text-cyan-50"
                    : "rounded-bl-sm bg-zinc-800 text-zinc-100"
                )}
              >
                {isOutbound && (
                  <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide opacity-60">
                    {isManual ? "Tú (manual)" : "Bot"}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.text ?? `[${msg.type}]`}</p>
                <p className="mt-1 text-right text-[10px] opacity-50">{formatTime(msg)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <Composer phone={phone} mode={mode} windowOpen={windowOpen} />
    </div>
  );
}
```

> Nota: verifica la firma real de `useDoc` en `src/firebase/firestore/use-doc.tsx` antes de usarla — si su API difiere (p. ej. no acepta `{ listen: true }` o retorna otra forma), ajusta la llamada a su patrón real. El resto del componente no depende de eso.

- [ ] **Step 4: Conectar el hilo en `InboxShell.tsx`**

En `src/components/whatsapp-inbox/InboxShell.tsx`, agregar el import y reemplazar el placeholder del panel derecho:

```tsx
import { ChatThread } from "./ChatThread";
```

```tsx
      {/* Panel derecho: hilo activo */}
      <div className={"min-w-0 flex-1 md:block " + (selectedPhone ? "block" : "hidden")}>
        {selectedPhone ? (
          <ChatThread
            tenantId={tenantId}
            phone={selectedPhone}
            onBack={() => setSelectedPhone(null)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Selecciona una conversación
          </div>
        )}
      </div>
```

- [ ] **Step 5: Typecheck + lint + commit**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck && npm run lint`
Expected: 0 errores

```bash
cd /home/ubuntu/pixeltec-os
git add src/components/whatsapp-inbox/
git commit -m "feat(whatsapp): hilo realtime, takeover humano y composer manual"
```

---

### Task 10: Verificación global de ambos repos

**Files:** ninguno nuevo — solo verificación.

- [ ] **Step 1: Suite completa de PixelBot**

Run: `cd /home/ubuntu/pixelbot && pytest -v`
Expected: todo verde (los 56 previos + 9 nuevos de `test_conversation_mode.py`)

- [ ] **Step 2: Build de producción de PixelTEC OS**

Run: `cd /home/ubuntu/pixeltec-os && npm run typecheck && npm run lint && npm run build`
Expected: build exitoso, 0 errores de tipos, ruta `/whatsapp` en el output del build

- [ ] **Step 3: Smoke test local end-to-end (sin tocar producción)**

1. Bot local: `cd /home/ubuntu/pixelbot && INTERNAL_API_SECRET=$(openssl rand -hex 32) uvicorn agent.main:app --port 8000` (anota el secret).
2. `curl -s -X POST http://127.0.0.1:8000/internal/conversations/mode -H "Content-Type: application/json" -H "X-Internal-Secret: <secret>" -d '{"tenant_id":"<id-de-sqlite-local>","phone":"+5215500000000","mode":"HUMAN","changed_by_uid":"uid_test"}'`
   Expected: `{"status":"ok","previous_mode":"BOT","mode":"HUMAN",...}`
3. OS dev con `.env.local`: `PIXELBOT_INTERNAL_URL=http://127.0.0.1:8000`, `PIXELBOT_INTERNAL_SECRET=<secret>`, `PIXELBOT_TENANT_ID=<id>` → `npm run dev` → en `/whatsapp` cambiar modo desde la UI y ver el toast de éxito.

- [ ] **Step 4: Verificar que no quedó nada sin commitear**

Run: `cd /home/ubuntu/pixelbot && git status && cd /home/ubuntu/pixeltec-os && git status`
Expected: working trees limpios

---

# Lanzamiento (manual — REQUIERE autorización explícita de Miguel)

> ⛔ **Ninguno de estos pasos se ejecuta sin OK de Miguel.** Referencias: `pixelbot/docs/DEPLOY_CHECKLIST.md` y `pixelbot/docs/ROLLBACK_PLAN.md`.

- [ ] **1. Secret compartido:** generar `openssl rand -hex 32`. Agregarlo como `INTERNAL_API_SECRET` en `/home/ubuntu/pixelbot/.env.production` y como `PIXELBOT_INTERNAL_SECRET` en `/home/ubuntu/pixeltec-os/.env.production`.
- [ ] **2. Deploy PixelBot:** `cd /home/ubuntu/pixelbot && git pull && docker compose build --no-cache app && docker compose up -d app` → verificar `curl http://localhost:3011/health` y que los logs NO muestren el warning "INTERNAL_API_SECRET no configurado". Confirmar `FIRESTORE_WRITE_MODE=live`.
- [ ] **3. Tenant ID:** `docker exec pixelbot python3 -c "import sqlite3; print(sqlite3.connect('/app/data/agentkit.db').execute('SELECT id, slug FROM tenants').fetchall())"` → poner el id en `PIXELBOT_TENANT_ID` del `.env.production` de pixeltec-os, junto con `PIXELBOT_INTERNAL_URL=http://pixelbot:3011`.
- [ ] **4. Reglas Firestore:** `cd /home/ubuntu/pixeltec-os && firebase deploy --only firestore:rules`.
- [ ] **5. Deploy PixelTEC OS:** `docker compose build --no-cache app && docker compose up -d --force-recreate app && docker exec pixeltec-nginx nginx -s reload` (NUNCA `restart` — no recarga env_file).
- [ ] **6. Smoke test en producción:** abrir `https://pixeltec.mx/whatsapp` → se ven las conversaciones reales; escribirle al bot desde un teléfono propio → el mensaje aparece en vivo; "Control humano" → el bot deja de responder (verificar en `docker compose logs -f app` de pixelbot: `modo HUMAN — inbound persistido, bot no responde`); enviar mensaje manual → llega al teléfono y aparece en el hilo; "Bot" → el bot vuelve a responder.
- [ ] **7. Recordatorio de deuda:** al conectar el primer cliente productivo aplica el trigger de rotación de claves de `pixelbot/docs/TECH_DEBT.md` (secretos expuestos 2026-05-08).

---

## Self-Review (hecho al escribir el plan)

- **Cobertura del spec:** ver conversaciones → Tasks 4, 7, 8; tomar control → Tasks 1-3, 6, 9 (ModeToggle); acceso total para escribir como el negocio → Task 6 (`send`) + Task 9 (Composer); todo integrado en pixeltec-os como sección nueva → Task 7 (nav + ruta).
- **Riesgo conocido #1:** el doc raíz `/tenants/{tenantId}` puede no existir en Firestore (el bot solo escribe subcolecciones) — por eso el tenant id viaja por env var y la UI nunca lista `/tenants` (solo `conversations` del tenant conocido).
- **Riesgo conocido #2:** la firma exacta de `useDoc` no fue verificada — Task 9 Step 3 incluye la instrucción de verificar y ajustar.
- **Latencia del outbox:** modo y eco de mensajes se reflejan cuando el worker del bot drena la cola (segundos). La UX lo cubre con toasts inmediatos.
