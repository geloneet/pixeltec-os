# Notificaciones de decisión de propuesta + retiro de Telegram — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Avisar a Miguel por WhatsApp, email e in-app cuando un cliente decide una propuesta, y eliminar por completo el bot de Telegram.

**Architecture:** Un helper puro arma los textos (testeable sin DB); la ruta `POST /api/proposals/action` dispara los 3 canales con `after()` de Next (no bloquea la respuesta, cada canal con try/catch propio). El retiro de Telegram borra 2 rutas + 5 libs + 2 tablas (migración drizzle) + la dep `grammy`.

**Tech Stack:** Next 15.5 (`after` de `next/server`), Drizzle/Postgres, Resend, Meta WhatsApp Cloud API, vitest.

**Spec:** `docs/superpowers/specs/2026-07-15-notificaciones-propuesta-y-retiro-telegram-design.md`

## Global Constraints

- Las notificaciones NUNCA hacen fallar la respuesta al cliente — cada canal en su propio try/catch, errores a `console.error` con prefijo `[proposals/action]`.
- `rate-limit.ts` NO se borra (corrección al spec: `src/lib/auth-brute-force.ts` lo usa).
- La migración corre contra el Postgres compartido (contenedor `pixeltec-os-db`) — solo dropea `infra_silences` e `infra_command_log` (logs del bot, sin datos de negocio).
- No pushear a origin (main = deploy directo a prod). Commits locales solamente.
- Copy exacto de mensajes: ver Task 1 (no improvisar variantes).

---

### Task 1: Helper puro de textos de notificación

**Files:**
- Create: `src/lib/notifications/proposal-decision.ts`
- Test: `src/lib/notifications/proposal-decision.test.ts`

**Interfaces:**
- Consumes: `BillingItemDraft` de `@/types/documents` (`{ concept: string; amount: number; frequency: "unico" | "mensual" | "trimestral" | "semestral" | "anual" }`).
- Produces: `buildProposalDecisionNotification(input: ProposalDecisionInput): ProposalDecisionMessages` — la usa Task 3. Tipos exactos abajo.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/notifications/proposal-decision.test.ts
import { describe, expect, it } from "vitest";
import { buildProposalDecisionNotification } from "./proposal-decision";

const base = {
  action: "aceptada" as const,
  title: "Calculadora v2",
  clientName: "VillaNogal",
  billingItemDrafts: [
    { concept: "APP", amount: 5999, frequency: "unico" as const },
    { concept: "Mantenimiento", amount: 500, frequency: "trimestral" as const },
  ],
};

describe("buildProposalDecisionNotification", () => {
  it("aceptada con conceptos: monto único + recurrentes en el WhatsApp", () => {
    const m = buildProposalDecisionNotification(base);
    expect(m.whatsappText).toBe(
      "✅ VillaNogal aceptó la propuesta «Calculadora v2» — $5,999 MXN único + 1 concepto recurrente\n👉 pixeltec.mx/crm",
    );
    expect(m.emailSubject).toBe("✅ Propuesta aceptada: Calculadora v2 — VillaNogal");
    expect(m.inApp.type).toBe("success");
    expect(m.inApp.title).toBe("Propuesta aceptada");
    expect(m.inApp.body).toBe("VillaNogal aceptó «Calculadora v2».");
  });

  it("rechazada: ❌, type warning y sin montos", () => {
    const m = buildProposalDecisionNotification({ ...base, action: "rechazada", billingItemDrafts: [] });
    expect(m.whatsappText).toBe("❌ VillaNogal rechazó la propuesta «Calculadora v2»\n👉 pixeltec.mx/crm");
    expect(m.emailSubject).toBe("❌ Propuesta rechazada: Calculadora v2 — VillaNogal");
    expect(m.inApp.type).toBe("warning");
    expect(m.inApp.title).toBe("Propuesta rechazada");
  });

  it("sin conceptos: omite el monto", () => {
    const m = buildProposalDecisionNotification({ ...base, billingItemDrafts: undefined });
    expect(m.whatsappText).toBe("✅ VillaNogal aceptó la propuesta «Calculadora v2»\n👉 pixeltec.mx/crm");
  });

  it("solo recurrentes: pluraliza y no muestra $0 único", () => {
    const m = buildProposalDecisionNotification({
      ...base,
      billingItemDrafts: [
        { concept: "Dominio", amount: 1999, frequency: "anual" as const },
        { concept: "Mantenimiento", amount: 500, frequency: "trimestral" as const },
      ],
    });
    expect(m.whatsappText).toContain("— 2 conceptos recurrentes");
    expect(m.whatsappText).not.toContain("$");
  });

  it("cliente sin nombre: usa 'Un cliente'", () => {
    const m = buildProposalDecisionNotification({ ...base, clientName: "" });
    expect(m.whatsappText).toContain("Un cliente aceptó");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/notifications/proposal-decision.test.ts`
Expected: FAIL — `Cannot find module './proposal-decision'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/notifications/proposal-decision.ts
// Textos de las notificaciones de decisión de propuesta (WhatsApp / email /
// in-app). Función pura para testear el copy sin DB ni red — la dispara
// src/app/api/proposals/action/route.ts.
import type { BillingItemDraft } from "@/types/documents";

export interface ProposalDecisionInput {
  action: "aceptada" | "rechazada";
  title: string;
  clientName: string;
  billingItemDrafts?: BillingItemDraft[];
}

export interface ProposalDecisionMessages {
  whatsappText: string;
  emailSubject: string;
  inApp: { type: "success" | "warning"; title: string; body: string };
}

function investmentSummary(drafts: BillingItemDraft[] | undefined): string {
  const items = (drafts ?? []).filter((d) => d.concept && d.amount > 0);
  if (items.length === 0) return "";
  const unique = items.filter((d) => d.frequency === "unico").reduce((s, d) => s + d.amount, 0);
  const recurring = items.filter((d) => d.frequency !== "unico").length;
  const parts: string[] = [];
  if (unique > 0) parts.push(`$${unique.toLocaleString("es-MX")} MXN único`);
  if (recurring > 0) parts.push(`${recurring} concepto${recurring === 1 ? "" : "s"} recurrente${recurring === 1 ? "" : "s"}`);
  return parts.length ? ` — ${parts.join(" + ")}` : "";
}

export function buildProposalDecisionNotification(input: ProposalDecisionInput): ProposalDecisionMessages {
  const client = input.clientName.trim() || "Un cliente";
  const accepted = input.action === "aceptada";
  const verb = accepted ? "aceptó" : "rechazó";
  // El monto solo aporta en la aceptación; en el rechazo es ruido.
  const money = accepted ? investmentSummary(input.billingItemDrafts) : "";

  return {
    whatsappText: `${accepted ? "✅" : "❌"} ${client} ${verb} la propuesta «${input.title}»${money}\n👉 pixeltec.mx/crm`,
    emailSubject: `${accepted ? "✅" : "❌"} Propuesta ${input.action}: ${input.title} — ${client}`,
    inApp: {
      type: accepted ? "success" : "warning",
      title: `Propuesta ${input.action}`,
      body: `${client} ${verb} «${input.title}».`,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/notifications/proposal-decision.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/proposal-decision.ts src/lib/notifications/proposal-decision.test.ts
git commit -m "feat(notificaciones): helper puro de textos de decisión de propuesta"
```

---

### Task 2: Template de email ProposalDecisionEmail

**Files:**
- Create: `src/emails/ProposalDecisionEmail.ts`
- Modify: `src/lib/email.ts` (import nuevo + función `sendProposalDecisionEmail` junto a `sendDiagnosticNotification`, ~línea 158)

**Interfaces:**
- Consumes: `internalLayout, escapeHtml` de `src/emails/shared.ts` (mismo patrón que `DiagnosticNotificationEmail.ts`); `sendEmail`/`TEAM_EMAIL` ya existentes en `email.ts`.
- Produces: `sendProposalDecisionEmail(props: ProposalDecisionEmailProps & { subject: string }): Promise<EmailResult>` — la usa Task 3.

- [ ] **Step 1: Crear el template**

```ts
// src/emails/ProposalDecisionEmail.ts
/**
 * Aviso interno al equipo cuando un cliente decide (acepta/rechaza) una
 * propuesta desde la página pública /p/[token]. Patrón espejo de
 * DiagnosticNotificationEmail.ts.
 */
import { internalLayout, escapeHtml } from './shared';

export interface ProposalDecisionEmailProps {
  action: 'aceptada' | 'rechazada';
  title: string;
  clientName: string;
  /** Resumen de inversión ya formateado ("" si no hay conceptos). */
  investmentSummary: string;
  decidedAt: string;
}

export function renderProposalDecisionEmail(props: ProposalDecisionEmailProps): string {
  const accepted = props.action === 'aceptada';
  const body = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#09090b;">
      Propuesta ${accepted ? 'aceptada ✅' : 'rechazada ❌'}
    </h1>
    <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
      pixeltec.mx/p/[token] · ${escapeHtml(props.decidedAt)}
    </p>
    <div style="background:#f4f4f5;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#71717a;width:140px;">Cliente</td>
          <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${escapeHtml(props.clientName || 'Un cliente')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#71717a;">Propuesta</td>
          <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${escapeHtml(props.title)}</td>
        </tr>
        ${props.investmentSummary ? `<tr>
          <td style="padding:8px 0;font-size:13px;color:#71717a;">Inversión</td>
          <td style="padding:8px 0;font-size:14px;color:#09090b;font-weight:600;">${escapeHtml(props.investmentSummary)}</td>
        </tr>` : ''}
      </table>
    </div>
    <a href="https://pixeltec.mx/crm"
       style="display:inline-block;background:#09090b;color:#fafafa;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Abrir el CRM
    </a>`;
  return internalLayout(body);
}
```

Nota: si `internalLayout` recibe más argumentos en `shared.ts` (verificar firma real antes de usar), imitar EXACTAMENTE la llamada de `DiagnosticNotificationEmail.ts`.

- [ ] **Step 2: Agregar el sender en `src/lib/email.ts`**

Import arriba junto a los demás:

```ts
import { renderProposalDecisionEmail, type ProposalDecisionEmailProps } from '@/emails/ProposalDecisionEmail';
```

Función junto a `sendDiagnosticNotification`:

```ts
/** Aviso interno cuando un cliente decide una propuesta en /p/[token]. */
export async function sendProposalDecisionEmail(
  props: ProposalDecisionEmailProps & { subject: string }
): Promise<EmailResult> {
  const { subject, ...templateProps } = props;
  const html = renderProposalDecisionEmail(templateProps);
  return sendEmail(TEAM_EMAIL, subject, html);
}
```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/emails/ProposalDecisionEmail.ts src/lib/email.ts
git commit -m "feat(notificaciones): email interno de decisión de propuesta"
```

---

### Task 3: Disparar los 3 canales en /api/proposals/action

**Files:**
- Modify: `src/app/api/proposals/action/route.ts` (archivo completo abajo)

**Interfaces:**
- Consumes: `buildProposalDecisionNotification` (Task 1), `sendProposalDecisionEmail` (Task 2), `sendWhatsApp(message: string)` de `@/lib/whatsapp/sender`, `createNotification` de `@/lib/notifications/actions` — OJO: `createNotification` de actions hace `auth()`? NO — revisa: la de `@/lib/notifications/actions` NO exige sesión (el daily cron la usa sin sesión); usa esa, igual que el cron. `users`/`db` de drizzle para iterar staff.
- Produces: nada (endpoint final).

- [ ] **Step 1: Reescribir la ruta**

```ts
// src/app/api/proposals/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getProposalByToken, updateProposalActionStatus } from "@/lib/documents/proposals-admin";
import { buildProposalDecisionNotification } from "@/lib/notifications/proposal-decision";
import { createNotification } from "@/lib/notifications/actions";
import { sendProposalDecisionEmail } from "@/lib/email";
import { sendWhatsApp } from "@/lib/whatsapp/sender";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json() as { token?: string; action?: string };
    const { token, action } = body;

    if (!token || (action !== "aceptada" && action !== "rechazada")) {
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const proposal = await getProposalByToken(token);
    if (!proposal) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const result = await updateProposalActionStatus(proposal, action);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }

    // Avisos a Miguel/staff DESPUÉS de responder al cliente. La decisión ya
    // está guardada e idempotente (segunda decisión -> 409 arriba), así que
    // esto corre exactamente una vez por propuesta. Cada canal aislado: un
    // canal caído no tumba a los otros ni afecta la respuesta.
    after(async () => {
      const messages = buildProposalDecisionNotification({
        action,
        title: proposal.title,
        clientName: proposal.clientName,
        billingItemDrafts: proposal.billingItemDrafts,
      });

      try {
        await sendWhatsApp(messages.whatsappText);
      } catch (err) {
        console.error("[proposals/action] notify whatsapp FAILED:", err);
      }

      try {
        await sendProposalDecisionEmail({
          action,
          title: proposal.title,
          clientName: proposal.clientName,
          investmentSummary: messages.whatsappText.includes("—")
            ? messages.whatsappText.split("—")[1]?.split("\n")[0]?.trim() ?? ""
            : "",
          decidedAt: new Date().toLocaleString("es-MX", { timeZone: "America/Mexico_City" }),
          subject: messages.emailSubject,
        });
      } catch (err) {
        console.error("[proposals/action] notify email FAILED:", err);
      }

      try {
        const staff = await db.select({ id: users.id }).from(users);
        for (const u of staff) {
          await createNotification({
            userId: u.id,
            type: messages.inApp.type,
            title: messages.inApp.title,
            body: messages.inApp.body,
            href: "/crm",
            source: "proposal-decision",
          });
        }
      } catch (err) {
        console.error("[proposals/action] notify in-app FAILED:", err);
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[proposals/action]", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
```

NOTA de limpieza: extraer el `investmentSummary` parseando el whatsappText es frágil — mejor: exportar `investmentSummary()` desde `proposal-decision.ts` (quitarle el `function` privado y exportarla) y llamarla directo aquí con `proposal.billingItemDrafts`. Hacerlo así, con su test (`expect(investmentSummary(base.billingItemDrafts)).toBe(" — $5,999 MXN único + 1 concepto recurrente")` ajustando el formato sin el " — " inicial si se prefiere firma limpia). El implementador decide la firma pero el email NO debe parsear strings del WhatsApp.

- [ ] **Step 2: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores, 210 tests pass (205 + 5 nuevos).

- [ ] **Step 3: Smoke E2E en dev (9002)**

```bash
# Resetear la propuesta de prueba "Calculadora en HTML" a no-decidida:
docker exec pixeltec-os-db psql -U pixeltec_os -d pixeltec_os -c \
  "UPDATE proposals SET status='publicada', accepted_at=NULL WHERE id='f5e1bee7-5170-4efc-9a9c-cdb1992ae4c5';"
# Aceptarla vía la API pública:
curl -s -X POST http://localhost:9002/api/proposals/action \
  -H 'Content-Type: application/json' \
  -d '{"token":"ecfe436fe38e7550","action":"aceptada"}'
```

Expected: `{"ok":true}`; WhatsApp real llega al teléfono de Miguel; fila nueva en `notifications` (`SELECT title, body FROM notifications WHERE source='proposal-decision';`); email en equipo@pixeltec.mx. Si `status` no admite 'publicada', ver valores válidos con `SELECT DISTINCT status FROM proposals;` y usar uno no-decidido.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/proposals/action/route.ts src/lib/notifications/proposal-decision.ts src/lib/notifications/proposal-decision.test.ts
git commit -m "feat(notificaciones): WhatsApp + email + in-app al decidir una propuesta"
```

---

### Task 4: Retiro de Telegram — código

**Files:**
- Delete: `src/app/api/notifications/telegram/webhook/route.ts` (y el directorio `telegram/` si queda vacío)
- Delete: `src/app/api/notifications/alert/route.ts`
- Delete: `src/lib/notifications/infra-bot.ts`, `src/lib/notifications/telegram.ts`, `src/lib/notifications/telegram-auth.ts`, `src/lib/notifications/silence.ts`, `src/lib/notifications/alert-formatter.ts`, `src/lib/notifications/types.ts`
- Modify: `package.json` (quitar `"grammy": "^1.42.0"` de dependencies)
- **NO tocar:** `src/lib/notifications/rate-limit.ts` (lo usa `src/lib/auth-brute-force.ts`)

- [ ] **Step 1: Verificar que no hay consumidores fuera de la lista**

```bash
grep -rn "notifications/telegram\|notifications/infra-bot\|notifications/silence\|notifications/alert-formatter\|notifications/types\|infraSilences\|infraCommandLog\|grammy" src/ --include="*.ts" --include="*.tsx" | grep -v "src/lib/notifications/" | grep -v "src/app/api/notifications/alert" | grep -v "src/app/api/notifications/telegram"
```

Expected: solo los matches de `schema.ts` (tablas — se van en Task 5). Si aparece OTRO consumidor, DETENTE y revisa antes de borrar.

- [ ] **Step 2: Borrar archivos y dep**

```bash
git rm src/app/api/notifications/telegram/webhook/route.ts src/app/api/notifications/alert/route.ts \
  src/lib/notifications/infra-bot.ts src/lib/notifications/telegram.ts \
  src/lib/notifications/telegram-auth.ts src/lib/notifications/silence.ts \
  src/lib/notifications/alert-formatter.ts src/lib/notifications/types.ts
npm uninstall grammy
```

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: limpio. Si algo importaba tipos de `types.ts` que no vimos, corregirlo (mover el tipo o borrar el import muerto de ESE cambio).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(telegram): retirar bot de Telegram — rutas, libs y grammy"
```

---

### Task 5: Retiro de Telegram — schema y migración

**Files:**
- Modify: `src/lib/db/schema.ts` (borrar `infraSilences` ~línea 1355-1366 e `infraCommandLog` ~línea 1368+, con sus comentarios)
- Create (generada): `drizzle/0019_*.sql`

- [ ] **Step 1: Borrar las dos tablas de schema.ts** (los bloques `export const infraSilences = pgTable(...)` y `export const infraCommandLog = pgTable(...)` completos, incluidos comentarios e índices).

- [ ] **Step 2: Generar la migración**

Run: `npm run db:generate`
Expected: nuevo archivo `drizzle/0019_*.sql` con `DROP TABLE "infra_silences";` y `DROP TABLE "infra_command_log";` (drizzle puede pedir confirmación interactiva de que es un drop y no un rename — confirmar drop).

- [ ] **Step 3: Aplicar y verificar**

Run: `npm run db:migrate`
Verify:
```bash
docker exec pixeltec-os-db psql -U pixeltec_os -d pixeltec_os -c "\dt infra_*"
```
Expected: `Did not find any relation named "infra_*"`.

- [ ] **Step 4: Typecheck + tests + commit**

```bash
npx tsc --noEmit && npm test
git add -A
git commit -m "chore(telegram): drop de infra_silences e infra_command_log (migración 0019)"
```

---

### Task 6: Env vars y verificación final

**Files:**
- Modify: `.env` (quitar líneas `TELEGRAM_*`; NO se commitea — está gitignored)
- Modify: `.env.example` si existe y las menciona

- [ ] **Step 1: Limpiar envs**

```bash
grep -n "TELEGRAM" .env .env.example 2>/dev/null   # ver qué hay
sed -i '/^TELEGRAM_/d' .env
[ -f .env.example ] && sed -i '/^TELEGRAM_/d' .env.example
```

- [ ] **Step 2: Verificación integral**

```bash
grep -rin "telegram" src/ --include="*.ts" --include="*.tsx"   # Expected: 0 matches
npx tsc --noEmit && npx eslint src/ --quiet && npm test         # Expected: todo verde
```

- [ ] **Step 3: Reiniciar dev server para que tome el .env limpio** (el proceso `next-server` en 9002 — matar y relanzar con `nohup npm run dev > /tmp/dev9002.log 2>&1 &` desde `/home/ubuntu/pixeltec-os`; confirmar `curl -s -o /dev/null -w "%{http_code}" http://localhost:9002/` → 200).

- [ ] **Step 4: Commit final si `.env.example` cambió**

```bash
git add -A && git status   # si hay algo staged:
git commit -m "chore(telegram): limpiar envs de Telegram"
```

- [ ] **Step 5: Recordatorio a Miguel (manual, fuera del repo):** borrar el bot en BotFather con `/deletebot` — eso cierra TOKEN-001. Actualizar memoria `project_grupo_c_2026-07-13` cuando lo confirme.

---

## Self-Review

- **Spec coverage:** Parte A (canales 1-3, `after()`, ambas decisiones, datos del cliente) → Tasks 1-3. Parte B (rutas, libs, grammy, tablas+migración, envs, BotFather, nota flujo-comercial-fase2) → Tasks 4-6; la nota de `rollover.ts` no requiere task (rama sin mergear, queda anotada en spec y memoria). Testing del spec → Steps de test en cada task + E2E en Task 3 Step 3. ✔
- **Corrección al spec:** `rate-limit.ts` se conserva (consumidor real: `auth-brute-force.ts`). Documentado en Global Constraints y Task 4. ✔
- **Type consistency:** `buildProposalDecisionNotification` (Tasks 1→3), `sendProposalDecisionEmail(props & { subject })` (Tasks 2→3), enum in-app `success|warning` ⊂ `notificationTypeEnum`. La nota de Task 3 pide exportar `investmentSummary` — al hacerlo, ajustar el test de Task 1 en el mismo commit. ✔
