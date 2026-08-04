# PixelBot — Paquetes comerciales v0.1 + identidad de marca por cliente

**Fecha:** 2026-08-04
**Referencia previa:** `docs/superpowers/plans/2026-08-03-pixelbot-landing.md` — este documento **no reemplaza** ese plan, lo actualiza. La landing base (workflow, capacidades, consola, comparativa, compliance, formulario) sigue vigente tal como se diseñó el 2026-08-03; este incremento cambia únicamente la doctrina de precios y agrega la identidad de marca por cliente.

## Qué cambió respecto al plan de 2026-08-03

El plan de 2026-08-03 estableció la regla "sin precios públicos, cotización caso por caso" y prohibió explícitamente `$`, `%`, `MXN`/`USD` en `pixelbot-content.ts` (test bloqueante). Miguel aprobó reemplazar esa doctrina por **cuatro paquetes con precio publicado** (Esencial/Crecimiento/Negocio/A Medida) y una feature de identidad: **el cliente elige cómo se llama y se presenta su bot** (ej. "Dentista Bot", "Mr. Smile Bot").

Verificación en código real (no en NeuroPIXEL, que estaba desactualizado en `architecture.md`) antes de publicar el claim de identidad:

1. La identidad del bot es real y configurable extremo a extremo: `agent/bot_config.py` (repo `pixelbot`, VPS) define `bot_name` (1-60 car.) y `personality.public_identity` (1-80 car.) con validación; `agent/brain.py:componer_system_prompt()` los inyecta al system prompt real que recibe Claude en producción. La consola de PixelTEC OS (`BotConfigView.tsx`, sección "Identidad") ya expone ambos campos vía HTTP real a `/internal/config`. No es aspiracional.
2. Es una configuración **global por deployment**, no multi-tenant dinámico: `DEFAULT_TENANT_ID = "pixeltec"` está hardcodeado; ningún endpoint acepta un tenant distinto. Cada cliente nuevo requiere activación/configuración asistida — no hay autoservicio multi-tenant en una instancia compartida.
3. El "nombre visible del perfil de WhatsApp" (`display_name`/`business_profile`/`verified_name`) no existe en código en ningún lado — el caveat de Meta sobre aprobación y relación con la marca es obligatorio y se muestra siempre en texto visible.
4. No existía ningún componente de pricing-card reutilizable en la landing; se construyó `pixelbot-pricing.tsx` nuevo, reutilizando los patrones visuales ya existentes (grid hairline de `pixelbot-capabilities.tsx`, card con borde de acento de `pixelbot-comparison.tsx`, chip pill de `pixelbot-console-showcase.tsx`) en vez de `OfferTiers.tsx` de PixelForge (tokens `--pf-*` incompatibles).
5. No se agregó JSON-LD de precios (`Offer`/`AggregateOffer`) — `structured-data.tsx` no se tocó; se mantiene `Service`/`FAQPage`/`BreadcrumbList`.

## Claims matrix actualizada

### Permitido (nuevo desde 2026-08-04)

- Los 4 precios exactos de los paquetes: `$1,490 MXN/mes + IVA` (Esencial), `$2,990 MXN/mes + IVA` (Crecimiento), `$5,990 MXN/mes + IVA` (Negocio), `Desde $8,490 MXN/mes + IVA` (A Medida).
- Contratación mínima de 12 meses, IVA, uso ordinario de IA dentro de los límites del plan.
- "Nombre e identidad del bot elegidos por el cliente" / "identidad conversacional personalizada" (verificado en código, punto 1 arriba).
- Ejemplos ilustrativos de nombre de bot (Dentista Bot, Mr. Smile Bot, Asistente Fluvial, Clínica Nova Bot), **siempre** etiquetados como ejemplos, nunca como clientes reales o testimonios.

### Condicional (sin cambio de doctrina, redactado siempre en lenguaje condicional)

- Integraciones con CRM/ERP/agenda/inventario: "puede integrarse", "cuando esa integración forma parte del alcance", "según diagnóstico", "cuando el diagnóstico lo determina". PixelBot Negocio **no** promete "cualquier CRM, ERP o agenda" — su integración incluida es "una integración estándar, sujeta a compatibilidad técnica y alcance aprobado". PixelBot A Medida usa "puede incluir, según diagnóstico" para todo el bloque de capacidades ampliadas.
- El nombre visible del perfil de WhatsApp: siempre con el caveat "sujeto a las políticas y aprobación de Meta".

### Prohibido (sigue vigente, ver `FORBIDDEN` en `pixelbot-landing.test.ts`)

Socio oficial / Meta partner / Meta Business Partner, palomita verde, mensajes ilimitados, IA ilimitada, "nunca inventa"/"nunca se equivoca"/"cero alucinaciones", "reemplaza a tu equipo", "prueba gratis"/"gratis", omnicanal, round-robin, "etiquetas y notas", "white-label", cualquier multiplicador tipo `Nx`, y (sin cambio) sin JSON-LD de `Offer`/`AggregateOffer`, sin claim de self-service multi-tenant dinámico.

## Gate documentado: multi-tenancy

La identidad configurable **hoy** es una configuración global por deployment (single-tenant), no autoservicio multi-tenant dinámico. Cada cliente nuevo requiere activación/configuración asistida por PixelTEC. Este gate se documenta en NeuroPIXEL (`04_PRODUCTOS/PixelBot/pricing-and-packaging.md` y la decisión asociada) como parte del write-back de este incremento, y se referencia también en el cuerpo del Draft PR.

## Test matrix nuevo (`pixelbot-landing.test.ts`)

Reemplazado deliberadamente:
- El test "el copy no contiene porcentajes ni precios" → dos tests: "no contiene porcentajes" (se mantiene, los precios ya no están prohibidos) + "aparecen exactamente los 4 precios autorizados y ningún otro monto con $".
- `FAQ.items` longitud exacta 12 → 16 (se agregaron 4 preguntas nuevas: identidad del bot + caveat de Meta, activación estándar incluida, cargos de Meta por separado, exceder límite/cambiar de plan).

Agregado:
1. `PACKAGES.length === 4`.
2. Los 4 precios exactos (`$1,490`, `$2,990`, `$5,990`, `Desde $8,490`) y ningún otro monto con `$`.
3. Solo "Crecimiento" tiene `badge`.
4. Los 4 planes mencionan identidad/nombre personalizado del bot.
5. La nota común (`PRICING_INTRO.note`) incluye IVA, 12 meses y Meta.
6. Ningún archivo de la landing contiene frases del `FORBIDDEN` extendido (incluye ahora "IA ilimitada" y "white-label").
7. Negocio/A Medida usan lenguaje condicional para integraciones; Negocio no promete "cualquier CRM/ERP/agenda".
8. `FAQ.items` sigue siendo la misma fuente que `FAQPageStructuredData` en `page.tsx`.
9. Existe pregunta de FAQ sobre nombre del bot + caveat de Meta.
10. `buildPixelbotMessage` serializa `plan` y `botName` cuando existen, en el orden estable volumen → plan → nombre.
11. `buildPixelbotMessage` ignora `plan`/`botName` vacíos o solo espacios; los 3 tests originales de volumen siguen intactos.
12. Canonical (`PIXELBOT_PATH`) y los 5 aliases permanecen sin cambios.
13. El `<select>` de plan y el `<input>` de nombre del bot tienen `<Label htmlFor>` accesible.
14. El formulario existente (name/email/empresa/message/consent/honeypot) no se rompe; `contactSchema` en `src/app/actions.ts` no cambió.
15. Ningún ejemplo de nombre de bot aparece etiquetado como cliente real o testimonio.

## Archivos afectados (resumen)

- `src/components/pixelbot-landing/pixelbot-content.ts` — tipos `BrandIdentityContent`/`PixelbotPackage`, `BRAND_IDENTITY`, `PACKAGES`, `PRICING_INTRO`, `PRICING` reescrita, `HERO` reescrito, `FIT.no` recortado, `FAQ.items` ampliado a 16, `buildPixelbotMessage` extendido, `SEO_META` actualizado.
- `src/components/pixelbot-landing/pixelbot-client-branding.tsx` (nuevo).
- `src/components/pixelbot-landing/pixelbot-pricing.tsx` (nuevo).
- `src/app/pixelbot/page.tsx` — inserta `PixelbotClientBranding` y `PixelbotPricing`.
- `src/components/pixelbot-landing/pixelbot-hero.tsx` — CTA primario ahora apunta a `#planes`.
- `src/components/pixelbot-landing/pixelbot-implementation.tsx` — bloque de costo genérico reemplazado por el contraste activación estándar vs. a la medida.
- `src/components/pixelbot-landing/pixelbot-lead-form.tsx` — select de plan + input de nombre del bot, ambos opcionales y accesibles.
- `src/app/sitemap.ts` — `lastModified` de `/pixelbot` actualizado a 2026-08-04.
- `src/components/pixelbot-landing/pixelbot-landing.test.ts` — reescrito según el test matrix de arriba.

## Fuera de alcance de este incremento

- `structured-data.tsx` no se tocó (sin `Offer`/`AggregateOffer`).
- `next.config.ts` no se tocó (siguen siendo exactamente 5 redirects hacia `/pixelbot`).
- Sin deploy, sin SSH al VPS, sin merge del PR.
- Autoservicio multi-tenant de identidad: **no implementado, no prometido** — gate documentado arriba y en NeuroPIXEL.
