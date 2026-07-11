# Flujo comercial completo — Diseño técnico (Fase 2, Gate F2-1)

> Este documento es **diseño de arquitectura, sin código**. Gate F2-1 aprobado por Miguel el 2026-07-11 — las 5 decisiones quedan resueltas abajo (marcadas ✅ CONFIRMADO). Sigue el plan TDD ejecutable.

**Goal:** Cerrar el flujo Propuesta → Contrato → Cobro → Pago → PDF → Envío como scope confirmado de v1.0 (ver `04_PRODUCTOS/PixelTEC OS/PixelTEC OS.md`, corrección 2026-07-11).

**Stack real (corregido 2026-07-11 — NO Firebase):** Next.js 15 + PostgreSQL 16 vía Drizzle ORM + NextAuth v5. Ver [[ADR-0022 - Migracion completa de PixelTEC OS a Postgres|ADR-0022]] en NeuroPIXEL. Todo lo de abajo se diseña contra tablas Postgres (`proposals`, `contracts`, `billing_items`, `payment_records`, `invoices`, `invoice_items`), no colecciones Firestore.

## Estado real verificado (lectura de código, 2026-07-11 — no inventado)

| Pieza | Archivo | Estado |
|---|---|---|
| `updateProposalActionStatus` | `src/lib/documents/proposals-admin.ts:54-71` | Solo actualiza `status`/`acceptedAt` de la propuesta. Cero side effects. |
| `confirmContractFromWizard` | `src/lib/documents/contracts.ts:186-263` | Transacción Drizzle real. Inserta contrato (`status: "borrador"`) y llama `createBillingItemsForContract` **en la misma transacción** — hoy los cobros nacen al confirmar el wizard, no al firmar. |
| `createBillingItemsForContract` | `src/lib/documents/billing.ts:73-104` | **Ya es idempotente**: `SELECT ... WHERE contractId = X LIMIT 1` antes de `INSERT`. Reutilizar este patrón, no inventar uno nuevo. |
| `updateContract` | `src/lib/documents/contracts.ts:104-126` | Único punto que puede poner `status: "firmado"` — es un update genérico sin transacción ni side effects, llamado directo desde un `<select>` en `ContratosTab.tsx:291`. No existe `signContract()`. `signedAt` existe en el tipo `Contract` pero ningún caller lo usa hoy. |
| `computePaymentTransition` | `src/lib/documents/billing/payment-transition.ts:27-58` | Función pura, ya distingue `frequency: "unico"` vs. recurrente. Ya tiene tests. No se toca. |
| `invoices`/`invoice_items` | `src/lib/documents/invoices.ts` | Tabla y tipos existen (`Invoice.status`: `borrador/enviada/vista/pagada/vencida/cancelada` — **enum distinto** al de `BillingItem`). **Cero código llama a `createInvoice` desde el flujo de contratos/cobros hoy** — completamente desconectado. |
| `sendEmail` | `src/lib/email.ts` | Envía `to/subject/html` vía Resend. La SDK de Resend (`6.9.4`, ya instalada) **soporta `attachments`** — no usado hoy. |
| `sendWhatsApp` | `src/lib/whatsapp/sender.ts` | Solo `type: "text"` a la Meta Cloud API. **No existe envío de documentos/media** — sería código nuevo, no una capacidad ya construida sin usar. |
| PDFs (contrato/propuesta) | `src/lib/documents/contract-pdf-render.ts` + `src/app/api/documents/contract-pdf/route.ts` | Se generan **on-demand y se sirven como descarga directa** (`@react-pdf/renderer`, streaming). **No se persisten** — `pdfUrl` existe en el tipo `Contract` pero queda `null` siempre (`contracts.ts:160`, comentario explícito). No hay URL pública hoy. |
| R2 (Cloudflare) | `src/lib/r2/{client,upload}.ts` | Ya existe e integrado (usado para avatares/logos tras la migración). Reutilizable para persistir PDFs. |

## Módulos

### M1 — Propuesta aceptada → acceso directo a generar contrato

**Qué falta:** hoy `ContractWizard.tsx` tiene un dropdown "Propuesta relacionada (opcional)" que nunca se pre-llena.

**Diseño:** en la vista de detalle de una propuesta con `status === "aceptada"`, un botón **"Generar contrato"** que navega al tab de Contratos con el wizard abierto y pre-poblado desde la propuesta: `title`, `scope`, `deliverables` copiados tal cual; `clientId` resuelto; **`billingItems` NO se autogenera** desde `budget` (es texto libre — `budget?: string`, ej. `"$50,000 MXN/mes"` — parsearlo a monto+frecuencia de forma confiable no es viable sin ambigüedad). El wizard se abre en el paso de billing con el campo de monto vacío y el texto de `budget` visible como referencia para que el dueño lo capture manualmente.

**Nuevo código:** función pura `buildContractDraftFromProposal(proposal: Proposal): ContractWizardPrefill` (sin escritura a DB) + prop de pre-carga en `ContractWizard.tsx`. Cero cambio de schema.

**Qué NO se toca:** el wizard sigue siendo el único punto de confirmación — ningún dato se escribe en `contracts`/`billing_items` en este módulo.

---

### M2 — Generación de contrato al aceptar la propuesta

**✅ CONFIRMADO (Gate F2-1, 2026-07-11): opción (b), asistida de un clic.** Aceptar la propuesta no crea nada solo; se hace más prominente el botón de M1 (banner "Propuesta aceptada — genera el contrato ahora"). El contrato solo se crea cuando el dueño confirma el wizard, igual que hoy.

**Nuevo código:** ninguno adicional a M1 — solo el banner condicionado a `proposal.status === "aceptada" && !proposal.contractId`.

---

### M3 — Cobro automático en Finanzas + conexión con Facturas

**Dos cambios distintos, cada uno con su propia decisión:**

**M3a — Mover el disparo de "cobro creado" de "wizard confirmado" a "contrato firmado".**
Hoy `createBillingItemsForContract` corre dentro de `confirmContractFromWizard` (contrato en `borrador`). Un contrato en borrador con cobros ya programados es raro si el contrato nunca se firma.

**✅ CONFIRMADO (Gate F2-1): al firmar.** Se mueve la llamada a `createBillingItemsForContract` fuera de `confirmContractFromWizard` y se agrega una función nueva `signContract(contractId: string): Promise<{ok: boolean; reason?: string}>` en `contracts.ts` que, dentro de una transacción: valida que el contrato esté en `en_revision` o `borrador` (rechaza si ya `firmado`/`cancelado`, mismo patrón de guard que `updateProposalActionStatus`), hace `update(contracts).set({status: "firmado", signedAt: now})`, y llama `createBillingItemsForContract` en la misma tx. Reemplaza el `<select>` crudo de `ContratosTab.tsx:291` por un botón "Firmar contrato" que llama esta función (con confirmación, dado que dispara cobros reales).

**M3b — Conectar `invoices.ts` (hoy huérfano).**
**✅ CONFIRMADO (Gate F2-1): automático.** Al crear un `BillingItem` (dentro de la misma transacción de M3a/`signContract`), se genera también un `Invoice` en estado `borrador` con un único `InvoiceItem` derivado (`description: concept`, `qty: 1`, `unitPrice: amount`, `subtotal: amount`), enlazado por un nuevo campo `billingItemId` en `invoices` (no existe hoy — requiere migración Drizzle, ver Global Constraints de la implementación). Esto es lo que finalmente se envía al cliente (M4/M5), no el `BillingItem` (que es contabilidad interna).

**Idempotencia (ambos):** mismo patrón ya usado — `SELECT ... WHERE contractId = X LIMIT 1` antes de crear cobros; para facturas, `SELECT ... WHERE billingItemId = X LIMIT 1` antes de crear. Nada de tablas de idempotency-key nuevas (no existen en el schema, no se inventan aquí).

---

### M4 — PDF adjunto en email + envío de documentos por WhatsApp

**M4a — Email con PDF adjunto.** Extender `sendEmail` para aceptar `attachments?: {filename: string; content: Buffer}[]` y pasarlos directo a `resend.emails.send({..., attachments})` — soportado por la SDK ya instalada, sin upgrade. El PDF se genera en memoria (reusar `generateContractPdf`/el generador de propuesta) y se adjunta como buffer — **no requiere persistirlo**, solo para email.

**M4b — Documento por WhatsApp — requiere persistencia (decisión técnica, no de negocio).**
La Meta Cloud API para mandar un documento necesita un `link` público o un `media id` pre-subido — no acepta bytes inline. Como los PDFs hoy son efímeros (se generan y se descartan), hace falta elegir cómo resolverlo:

**✅ CONFIRMADO (Gate F2-1): R2 con URL firmada de vigencia corta** (24-48h, suficiente para que Meta la descargue y el cliente la vea desde el chat) — no un URL público permanente, dado que contienen datos de clientes.

**Nuevo código:** `sendWhatsAppDocument(documentUrl: string, options?: {filename?: string; caption?: string}): Promise<SendWhatsAppResult>` en `sender.ts`, payload `type: "document"` — esto es capacidad nueva, no existe hoy ni parcialmente.

---

### M5 — Factura llega al cliente (hoy `sendInvoiceEmail` es notificación interna)

Hoy `InvoiceEmail`/`sendInvoiceEmail` notifica al equipo interno cuando algo se marca "Pagado" — no es lo mismo que "enviarle la factura al cliente". Diseño: nueva función `sendInvoiceToClient(invoice: Invoice, client: Client)` que use `sendEmail` (M4a, con el PDF de la factura adjunto) dirigida al email del cliente, distinta de la notificación interna existente (que se mantiene sin tocar). Trigger: cuando el `Invoice` pasa a `status: "enviada"` (acción manual del dueño desde la UI de Facturas, no automática — evita mandarle a un cliente una factura en `borrador` sin revisar).

---

### M6 — Deploy a producción de la config UI de PixelBot

No es parte del flujo comercial — es la excepción del freeze del 2026-07-11 (`WhatsApp > Configuración del bot`), hoy solo en DEV. Se incluye en Fase 2 porque está en los Hitos de v1.0, pero es independiente de M1-M5: **checklist de deploy normal** (playbook de PixelTEC OS + verificación post-deploy + `nginx reload` si se recrea el contenedor), sin diseño nuevo. **✅ CONFIRMADO (Gate F2-1): deploy a producción autorizado en esta fase.**

---

## Qué NO se toca en ningún módulo

- El schema de `proposals` (M1 no escribe nada nuevo ahí).
- `computePaymentTransition` y la lógica de recurrencia — ya correcta, con tests.
- El generador de PDF (`contract-pdf-render.ts`) — se reutiliza tal cual, solo cambia dónde termina el buffer resultante (descarga directa hoy; + adjunto de email / + subida a R2 en M4).
- Cualquier módulo fuera de este flujo (Growth, portal, blog, whatsapp-inbox core) — freeze v1.0 sigue vigente para todo lo demás.

## Cambios de schema requeridos (resumen, para el plan TDD)

- `invoices`: nueva columna `billing_item_id` (FK a `billing_items.id`, `onDelete: "set null"`) — confirmado por M3b.
- `contracts`: ninguna columna nueva — `signedAt` ya existe, solo falta quien la use.
- Ninguna tabla nueva.

## Gate F2-1 — decisiones confirmadas por Miguel (2026-07-11)

1. M2: **(b) asistida de un clic.**
2. M3a: **el cobro nace al firmar** (nueva `signContract()`).
3. M3b: **cada cobro genera automáticamente una Factura formal** (nueva columna `billing_item_id`).
4. M4b: **R2 con URL firmada de vigencia corta** (24-48h).
5. M6: **deploy a producción autorizado** en esta fase.

Sigue el plan de implementación TDD (Tarea 2.2).
