# WO-2026-00104 — Cotizaciones: MVP comercial de PixelTEC CRM

**Fecha:** 2026-08-26 · **Departamento:** Ingeniería · **Rama:** `feature/cotizaciones` (worktree `wt-dashboard-cleanup`)
**Origen:** reporte de implementación de Miguel, 35 secciones. Se implementa **P0 completo** (§33, 20 puntos).
**Regla que gobernó el trabajo:** §1 y §34 — *evolucionar lo existente, no reescribir*.

---

## 1. Los 20 puntos P0

| # | Punto | Dónde | Estado |
|---|---|---|---|
| 1 | Conceptos con cantidad, precio unitario e importe calculado | `quote-form.tsx` | ✅ el importe nunca se captura |
| 2 | Totales robustos | `money.ts` | ✅ centavos enteros, ya existía; ampliado |
| 3 | Moneda MXN/USD | `terms.ts` | ✅ sin conversión (§4) |
| 4 | Vigencia +15 días | `terms.ts` · `quote-form.tsx` | ✅ editable; «Válida hasta: …» |
| 5 | Folio automático | `folio.ts` | ✅ ya existía |
| 6–7 | Problema · Solución | migración `0046` | ✅ |
| 8–9 | Alcance · Fuera de alcance | id. | ✅ tres exclusiones precargadas |
| 10 | Tiempo estimado | id. | ✅ |
| 11 | Forma de pago | `terms.ts` | ✅ 50/50 · 40/30/30 · mensual · personalizada |
| 12 | Guardar borrador | `quote-form.tsx` | ✅ el CTA ya no dice «Crear» |
| 13 | Cinco estados | `terms.ts` | ✅ «vencida» derivada, no guardada |
| 14 | Vista de detalle | `quote-detail.tsx` | ✅ |
| 15 | PDF profesional | `render-quote.mjs` | ✅ las 10 secciones del §17 |
| 16 | Marcar enviada | `actions.ts` | ✅ por correo o por WhatsApp |
| 17 | Seguimiento +3 días | `terms.ts` · `actions.ts` | ✅ sin jobs ni cron (§20) |
| 18 | Aceptar / rechazar con motivo | `actions.ts` · `quote-detail.tsx` | ✅ |
| 19 | Crear cobro | `billing-bridge.ts` | ✅ **sin tocar Finanzas** — §2 abajo |
| 20 | Listado funcional | `CotizacionesTab.tsx` | ✅ tabla del §24 |

**§2 identidad:** la interfaz dice ahora **PIXELTEC CRM** en la marca del sidebar, la barra superior y el
título de la pestaña. **No se renombró** repo, paquete, rutas, tablas ni variables de entorno.

## 2. Crear cobro sin descongelar Finanzas (§22)

El criterio 7 de WO-2026-00088 exige `diff en src/app/(admin)/cobros/** y lógica financiera = 0 archivos`.
Además, hoy `billing_items` **solo** se puebla desde un contrato (`createBillingItemsForContract`).

La salida: `src/lib/quotes/billing-bridge.ts`, **archivo nuevo**, inserta la fila. Cobros la muestra porque
lee la tabla, no porque se haya tocado. Evidencia literal:

```
git status --short -- 'src/app/(admin)/cobros' src/lib/documents/billing.ts
(vacío)
```

No crea proyectos, ni tareas, ni contratos, ni toca PIXELDASH (§22, §31).

**Queda pendiente y no lo hice:** `src/app/(admin)/cobros/page.tsx` sigue con el `title: "Cobros — PixelTEC
OS"`. Cambiarlo exige entrar en la zona congelada. **Miguel decide.**

## 3. Una sola fuente de verdad (§30)

`money.ts` (importes, IVA, total) y `terms.ts` (estados, fechas, reparto de pagos) son los **únicos** sitios
donde se calcula. El formulario, el detalle, el listado, la página pública y el correo leen de ahí. El worker
del PDF recibe **texto ya formateado** y no recalcula nada: por construcción no puede discrepar del panel.

Dos decisiones que conviene conocer:

- **El IVA sale del subtotal ya redondeado**, no de sumar el IVA de cada línea. Es como lo hace una factura
  mexicana, y hay un test con el caso donde ambos métodos difieren.
- **La última parcialidad es el residuo**, no un porcentaje redondeado. Así 40/30/30 sobre cualquier importe
  suma exactamente el total; hay un test que lo comprueba sobre cinco totales elegidos para romperlo.

**Desviación consciente del §28:** el modelo pedía guardar `amount` por concepto y `subtotal/taxAmount/total`
en la cotización. **No se guardan: se calculan.** Guardar un importe derivado y calcularlo a la vez crea dos
fuentes de verdad, que es justo lo que prohíbe el §30. Si algún día hace falta congelar los importes de una
cotización enviada, será una decisión explícita con su migración.

## 4. Compatibilidad (§28)

Migración `0046`: **solo añade columnas con DEFAULT**. Aplicada dos veces seguidas sin error, **solo en la BD
dev `:5437`**. La cotización creada con `0045` se sigue abriendo entera:
`COT-2026-0001 | MXN | pago=50_50 | items=3`.

## 5. Evidencia

- `npx vitest run src/lib/quotes` → **70 pass / 0 fail** (money, folio, share, email-html, terms).
- Suite completa: **3107 pasan / 15 fallan**. Los 15 son **preexistentes y ajenos** (`NewDefinitionForm`,
  `NewPixelforgeForm`), verificado antes con `git stash`.
- `npx tsc --noEmit` → sin errores propios (queda el de `.next/types` preexistente).
- `npx eslint` sobre los paths tocados → **No issues found**.
- **Zona congelada**: `git status` sobre `cobros/**`, `billing.ts`, `whatsapp`, `pixelbot`, `middleware.ts` y
  `auth` = **vacío**.

**Recorrido §32, ejecutado contra la BD dev:**

| Paso | Resultado |
|---|---|
| Cotización «Sistema de citas Smile More» con dos conceptos | `COT-2026-0013` |
| Totales | Subtotal **$30,000.00** · IVA **$4,800.00** · **TOTAL $34,800.00** — los del §32 |
| Página pública `/c/tokenmvp13` | HTTP 200 con esos mismos importes |
| PDF | Las **10** secciones del §17 presentes: PROPUESTA · EL PROBLEMA · SOLUCIÓN PROPUESTA · ALCANCE INCLUIDO · INVERSIÓN · TIEMPO ESTIMADO · FORMA DE PAGO · FUERA DE ALCANCE · NOTAS Y CONDICIONES · SIGUIENTE PASO |
| Reparto 50/50 en el PDF | Anticipo **$17,400.00** · Contra entrega **$17,400.00** |
| Aceptar → crear cobro | `billing_items`: «Anticipo COT-2026-0013 · $17400.00 MXN · pendiente · vence 2026-09-11»; cotización `aceptada`, seguimiento cancelado |

## 6. Lo que NO se hizo

- **Nada de la lista del §31.** Sin firma electrónica, portal público de aceptación, contratos, CFDI, Stripe,
  IA, proyectos, tareas ni analytics.
- **§25 duplicar** es **P1** en tu propia prioridad (§33): no se implementó.
- **Veredicto visual pendiente** (ING-001): el flujo está verificado por tests, por el recorrido contra la BD y
  por HTTP, pero **no se ha visto en un navegador con sesión** — la extensión de Chrome sigue sin conectar.
- **Ningún correo real enviado.**
