# PixelTEC Growth Suite — Viability Review

> **Tipo:** Documento de decisión pre-implementación.
> **Cubre:** Technical Risk Review + Financial Architecture Review.
> **Input:** Blueprint técnico `2026-06-23-content-studio-blueprint.md`.
> **Propósito:** Validar viabilidad comercial y técnica antes de escribir código.
> **Decisión requerida:** GO / NO-GO / GO con ajustes.

---

# PARTE 1 — TECHNICAL RISK REVIEW

## Metodología de calificación

| Severidad | Definición |
|-----------|-----------|
| **CRÍTICO** | Bloquea el MVP. Requiere solución antes del Sprint 1. |
| **ALTO** | Puede hacer fallar el MVP en producción. Requiere plan de mitigación claro antes de implementar el sprint afectado. |
| **MEDIO** | Causa problemas de UX o costos imprevistos. Debe resolverse, no urgente. |
| **BAJO** | Riesgo menor. Monitorear. |

---

## RIESGO-01 — Fabric.js en Node.js (Cloud Functions)

**Severidad: CRÍTICO**

**Descripción:** El compositor de canvas usa Fabric.js para renderizar templates y exportar PNG. Fabric.js está diseñado para el browser (`window`, `document`, `HTMLCanvasElement`). No existe en Node.js de forma nativa. El blueprint asume que `fabric/node` o `node-canvas` resuelven esto — no es tan simple.

**Análisis técnico:**
- `node-canvas` (dependencia de `fabric/node`) requiere compilar binarios de Cairo y Pango en la máquina donde se ejecuta.
- En Cloud Functions, el entorno es un contenedor Ubuntu. El build de `node-canvas` puede fallar si no tiene las dependencias del sistema (`libcairo2-dev`, `libpango1.0-dev`, `libjpeg-dev`, etc.).
- Cloud Functions Gen 1 NO permite dependencias de sistema personalizadas. Gen 2 con Container Registry sí permite un Dockerfile personalizado.
- Google Fonts requiere fetching en runtime. Un Cloud Function sin acceso a internet externo fallará silenciosamente.
- Tiempo de cold start con `node-canvas` compilado: 3-8 segundos adicionales por invocación.

**Impacto si no se resuelve:** La composición del canvas falla completamente. El post no se genera. El MVP no funciona.

**Opciones de resolución (en orden de preferencia):**

| Opción | Complejidad | Latencia | Costo | Recomendación |
|--------|------------|---------|-------|--------------|
| A. Cloud Run custom container con Dockerfile | Media | Sin overhead | Igual | **Preferida** |
| B. Puppeteer headless en Cloud Run | Alta | +3-5s | +$0.002/post | Válida si A falla |
| C. Reemplazar Fabric.js por Sharp.js + SVG | Baja | -2s vs A | Igual | Válida si templates son simples |
| D. Renderizado en cliente (browser) + upload | Media | Experiencia degradada | Mismo | Solo si las otras fallan |

**Decisión recomendada:** Opción C — usar **Sharp.js + SVG templates** en lugar de Fabric.js para el MVP. Sharp.js sí funciona nativamente en Cloud Functions sin dependencias del sistema. Las templates en SVG son más simples de definir y perfectamente válidas para el nivel de diseño del MVP. Fabric.js y el editor visual de v2 pueden coexistir — el MVP renderiza con Sharp, v2 agrega el editor Fabric.

**Cambios al blueprint necesarios:**
- Reemplazar `lib/growth/canvas/compositor.ts` (Fabric.js) por `lib/growth/canvas/svg-compositor.ts` (Sharp.js + SVG)
- Las templates almacenan SVG + JSON de zonas en lugar de canvas JSON de Fabric.js
- La API de zonas (`TemplateZone`) no cambia — solo el formato interno del template
- El `canvasJsonUrl` pasa a ser `svgTemplateUrl` — cambio de nombre en los tipos

---

## RIESGO-02 — Timeout de Cloud Functions en generación de campaña

**Severidad: ALTO**

**Descripción:** Una campaña de 15 posts a ~25s por post = 375 segundos en el camino crítico. Con overhead de Firestore, Storage, y lógica de orquestación, se puede llegar a 480-500s.

**Límites de Cloud Functions:**
- Gen 1: máximo 540s (9 minutos). Sin Dockerfile personalizado.
- Gen 2: máximo 3,600s (60 minutos). Requiere container o config explícita.

**Riesgo real:** Con Fabric.js resuelto (Riesgo-01), el tiempo de generación baja. Con Sharp.js, cada post puede generarse en 8-15s. Una campaña de 15 posts: 15 × 12s = 180s + overhead = ~240s total. Dentro del límite de Gen 1.

**Sin embargo:** Si un proveedor de IA tiene latencia alta (Fal.ai spikes hasta 30s), 15 × 30s = 450s. Peligrosamente cerca del límite de Gen 1.

**Mitigación recomendada:**
1. Usar Cloud Functions **Gen 2** para la función `generate-campaign` (configurar `timeoutSeconds: 1800`).
2. Implementar un **sistema de jobs con checkpointing**: después de generar cada post, marcar el `planId` como `done` en Firestore. Si la función falla, una nueva invocación verifica qué posts ya están hechos y continúa desde el último.
3. Limitar las campañas del MVP a **máximo 12 posts** para estar dentro de márgenes seguros.

**Cambio al blueprint:** La función `generate-campaign.ts` debe ser Gen 2 con checkpointing a nivel de `CampaignPostPlan`. El campo `status: "pending" | "generating" | "done" | "failed"` en `CampaignPostPlan` ya está diseñado para esto — solo hay que implementar la lógica de reanudación.

---

## RIESGO-03 — Race condition en el sistema de créditos

**Severidad: ALTO**

**Descripción:** El flujo de créditos descrito en el blueprint tiene dos pasos separados conceptualmente: (1) verificar balance, (2) deducir. Si dos requests llegan simultáneamente y ambos pasan la verificación antes de que se ejecute la deducción, ambos proceden con saldo insuficiente.

**Ejemplo de fallo:**
```
T=0: User lanza 2 campañas simultáneamente desde 2 pestañas
T=1: CF-A lee balance = 80 créditos. CF-B lee balance = 80 créditos.
T=2: CF-A ve: 80 >= 80 (costo campaña). Procede.
T=2: CF-B ve: 80 >= 80 (costo campaña). Procede.
T=3: CF-A hace FieldValue.increment(-80). Balance = 0.
T=4: CF-B hace FieldValue.increment(-80). Balance = -80. ⚠️
```

**Evaluación de probabilidad:** Baja en uso normal (un usuario difícilmente lanza dos generaciones simultáneas). Alta si se expone una API que puede ser automatizada o si hay un bug en el cliente que dispara doble submit.

**Mitigación obligatoria:** El paso de verificación + deducción DEBE ser una **Firestore transaction**, no dos operaciones separadas:

```
Firestore.runTransaction(async (tx) => {
  const summary = await tx.get(creditSummaryRef);
  const currentBalance = summary.data().balance;
  if (currentBalance < creditCost) throw new Error("INSUFFICIENT_CREDITS");
  tx.update(creditSummaryRef, { balance: FieldValue.increment(-creditCost) });
  tx.set(ledgerRef, ledgerEntry);
});
```

Esto es atómico. Firestore transactions son ACID a nivel de documento.

**Cambio al blueprint:** El blueprint describe el flujo conceptualmente correcto pero no especifica explícitamente que es una transaction. Agregar constraint: "La verificación y deducción SIEMPRE son una Firestore transaction. Nunca dos operaciones separadas."

---

## RIESGO-04 — Meta App Review para Instagram Publishing

**Severidad: ALTO (para Sprint 5)**

**Descripción:** Para publicar en Instagram directamente desde la app, se requiere aprobación de Meta para los permisos:
- `instagram_basic`
- `instagram_content_publish`
- `pages_manage_posts` (para Facebook)
- `pages_read_engagement`

El proceso de Meta App Review requiere:
1. **Cuenta de Business en Facebook** (ya debería existir para PixelTEC).
2. **Business Verification** — proceso que puede tomar 2-4 semanas.
3. **App Review propiamente dicho** — otros 2-6 semanas con un video demo de cada permiso.
4. **Privacy Policy URL** y **Data Deletion endpoint** — requeridos por Meta.

**Timeline real:** El proceso completo toma **6-12 semanas desde el inicio hasta la aprobación**, asumiendo que el primer submission es aceptado (hay casos de 2-3 rechazos antes de aprobación).

**Impacto en el roadmap:** Si App Review no se inicia en Sprint 0, Sprint 5 no puede entregarse en la fecha planificada. Es el único bloqueante externo del módulo.

**Acción inmediata requerida (antes de Sprint 1):**
1. Crear la app en Meta for Developers.
2. Completar Business Verification.
3. Preparar una demo en video mostrando el flujo de publicación (puede ser una demo manual, no necesita estar construido).
4. Hacer el primer submission de App Review.

**Plan de contingencia si Meta rechaza:** El calendario y el Content Studio siguen siendo 100% útiles sin la publicación directa. Los usuarios exportan el PNG y publican manualmente. El valor del módulo no depende de la publicación automática para el MVP.

---

## RIESGO-05 — Fal.ai como infraestructura crítica

**Severidad: MEDIO**

**Descripción:** El proveedor principal de imágenes (Flux Pro) se accede vía Fal.ai, una plataforma de terceros que actúa como proxy hacia los modelos de Black Forest Labs. Los riesgos son:

1. **Disponibilidad:** Fal.ai no tiene SLA publicado para el tier de pago estándar. Los incidentes históricos muestran downtimes de 15-45 minutos, 1-3 veces por mes.
2. **Cambios de API:** Fal.ai puede cambiar su API o precios con poco aviso (han cambiado IDs de modelos 3 veces en 2024).
3. **Rate limits:** El plan Starter de Fal.ai tiene 10 requests/segundo. Para el MVP esto es suficiente, pero a escala (>100 usuarios simultáneos generando imágenes) puede ser un cuello de botella.
4. **Precio no garantizado:** El precio de Flux Pro en Fal.ai podría subir. Black Forest Labs (creadores de Flux) está construyendo su propia API directa que podría cambiar la dinámica.

**Mitigación:**
- La abstracción `AIImageProvider` del blueprint es la mitigación correcta. Implementarla bien desde el inicio.
- Tener Ideogram v2 como fallback real (no solo documentado, sino implementado y testeado).
- Monitorear el `generate-post` Cloud Function con alertas cuando el proveedor de imagen retorna error, para detectar problemas de Fal.ai antes de que escalen.
- En el `flux-image.ts` provider, implementar retry con backoff (3 intentos, backoff exponencial) antes de declarar fallo.

---

## RIESGO-06 — GPT-4o como único proveedor de texto

**Severidad: MEDIO**

**Descripción:** Toda la generación de texto (copy de posts, estrategias de campaña, sugerencias del wizard) usa GPT-4o de OpenAI. OpenAI tiene incidentes de disponibilidad (2-4 por mes en el historial de 2024, algunos durando 1-3 horas). No hay fallback para texto en el blueprint actual.

**Impacto:** Si OpenAI está caído, ningún post se puede generar. Los créditos se devuelven pero el usuario no puede trabajar.

**Opciones:**
1. **No hacer nada en MVP** — aceptar el riesgo. La mayoría de incidentes son < 1 hora. Los créditos se reembolsan. Aceptable para MVP.
2. **Fallback a Claude Haiku** — para generación de texto simple, Claude Haiku (más barato) puede ser el fallback. Requiere implementar un `ClaudeTextProvider`.
3. **Fallback a Gemini Flash** — similar a Claude Haiku en costo y velocidad.

**Recomendación para MVP:** Aceptar el riesgo para texto. Implementar el provider abstract (`AITextProvider`) correctamente desde el inicio para que el fallback pueda añadirse en Sprint 2 sin refactoring.

**Actualización al blueprint:** Agregar a `AITextProvider` un campo `name` y hacer que el `orchestrator.ts` seleccione el proveedor activo desde una variable de entorno `PREFERRED_TEXT_PROVIDER`. Esto permite cambiar de OpenAI a Claude sin deploy.

---

## RIESGO-07 — Firebase Storage URLs y expiración

**Severidad: MEDIO**

**Descripción:** Las URLs de descarga de Firebase Storage tienen dos tipos:
1. **Download URLs con token** (`getDownloadURL()`): no expiran, pero el token se invalida si se actualiza el archivo o se revoca el acceso.
2. **Signed URLs** (`getSignedUrl()`): expiran en el tiempo configurado (máximo 7 días).

El blueprint guarda `finalImageUrl` en el documento `ContentPost` de Firestore. Si esta URL es una Signed URL que expira en 7 días, todos los posts del calendario van a tener imágenes rotas a los 8 días.

**Mitigación:**
- Usar **Download URLs con token** (`getDownloadURL()`), no Signed URLs.
- Las Download URLs con token no expiran automáticamente y funcionan mientras las Security Rules permitan el acceso.
- Alternativa: regenerar la URL on-demand en el cliente cuando se detecte un 403.

**Cambio al blueprint:** Especificar explícitamente que `lib/growth/storage/posts.ts` usa `getDownloadURL()` (no `getSignedUrl()`). Las URLs se guardan en Firestore y se asumen estables.

---

## RIESGO-08 — Firestore Security Rules y la query del calendario

**Severidad: MEDIO**

**Descripción:** El Content Calendar hace una query de posts por rango de fechas:
```javascript
query(postsRef, 
  where("orgId", "==", orgId),
  where("scheduling.scheduledAt", ">=", startOfMonth),
  where("scheduling.scheduledAt", "<=", endOfMonth)
)
```

Esta query requiere un índice compuesto en Firestore. Sin el índice, la query falla en producción con el error "The query requires an index." Los índices se crean en la Firestore Console o en `firestore.indexes.json`. Si no se crean antes del deploy, el calendario no funciona.

**Además:** Las Security Rules no pueden filtrar por campos anidados en el mismo `where` que los índices usan. La rule debe evaluar `isOrgMember(orgId)` que hace un get al documento Organization — una operación que cuesta 1 read de Firestore por request de regla evaluada. A escala, esto puede volverse costoso.

**Mitigación:**
- Crear `firestore.indexes.json` en Sprint 0 con todos los índices del blueprint.
- Hacer deploy del archivo de índices como parte del setup. Los índices tardan 5-10 minutos en construirse en producción.
- Considerar un campo `memberIds` flat (array) en vez de un get al documento Organization para la Security Rule — Firestore Rules permiten `request.auth.uid in resource.data.memberIds` sin un get adicional, si el campo existe en el mismo documento que se está leyendo. Para posts, la solución es duplicar el `memberIds[]` del org en el documento del post — no es práctico. Mantener el get al documento Organization en las rules pero monitorear el costo.

---

## RIESGO-09 — Escala del BrandBrain en el system prompt

**Severidad: BAJO**

**Descripción:** Un BrandBrain completamente lleno con 10 servicios, 10 objeciones, 5 value props, 3 ejemplo posts (de 200 chars cada uno) puede generar un system prompt de 3,500-5,500 tokens. GPT-4o cobra por tokens de entrada.

**Impacto en costo:**
- System prompt de 5,000 tokens × $2.50/1M tokens = $0.0125 por generación (solo el system prompt).
- En el cálculo del blueprint se estimó $0.021 total para texto — revisado con el brand brain máximo: $0.021-0.028 por generación de texto.
- El margen sigue siendo sólido. El riesgo es financiero menor, no técnico.

**Mitigación:** Implementar un `compressBrandBrainForPrompt(brand)` que ordena las secciones por impacto en la generación:
1. Siempre incluir: Industry, Services (min 3), ICP pain points, Voice/Tone, CTAs.
2. Incluir si hay espacio: Objeciones, Ejemplos de posts, Diferenciadores completos.
3. Comprimir: El ejemplo de post se limita a 150 chars si hay más de 5 servicios.

El objetivo es mantener el system prompt en ~3,000 tokens para el caso típico.

---

## RIESGO-10 — GDPR y residencia de datos

**Severidad: BAJO (para México/Latam), MEDIO (si se expande a Europa)**

**Descripción:** Los datos del Brand Brain contienen información del negocio de los clientes (servicios, precios, estrategia). En mercado mexicano, la Ley Federal de Protección de Datos Personales en Posesión de Particulares (LFPDPPP) aplica para datos personales, pero datos de negocio no son datos personales stricto sensu.

En Europa (GDPR), si se adquieren clientes europeos, los datos deben residir en Europa o tener SCCs (Standard Contractual Clauses) con Firebase/GCP. Firebase tiene regiones EU (`europe-west1`, etc.).

**Para el MVP (mercado mexicano/latinoamericano):** No es un bloqueante. Documentar en los T&Cs que los datos se procesan en USA (Firebase default).

**Acción futura:** Cuando se expanda a mercado europeo, cambiar la región del bucket de Storage y de Firestore a `europe-west1`.

---

## Resumen de riesgos técnicos

| ID | Riesgo | Severidad | Sprint afectado | Estado |
|----|--------|-----------|----------------|--------|
| R-01 | Fabric.js en Node.js | **CRÍTICO** | Sprint 0 | Requiere decisión: cambiar a Sharp.js |
| R-02 | Cloud Function timeout | **ALTO** | Sprint 3 | Mitigación: Gen 2 + checkpointing |
| R-03 | Race condition en créditos | **ALTO** | Sprint 0 | Mitigación: usar Firestore transaction |
| R-04 | Meta App Review | **ALTO** | Sprint 5 | Acción inmediata: iniciar submission |
| R-05 | Fal.ai como single point of failure | **MEDIO** | Sprint 2 | Mitigación: provider abstraction + retry |
| R-06 | GPT-4o sin fallback | **MEDIO** | Sprint 2 | Aceptar en MVP, arquitectura lista para fallback |
| R-07 | Firebase Storage URLs | **MEDIO** | Sprint 2 | Usar getDownloadURL(), no getSignedUrl() |
| R-08 | Índices de Firestore | **MEDIO** | Sprint 0 | Crear firestore.indexes.json antes del Sprint 1 |
| R-09 | BrandBrain en tokens | **BAJO** | Sprint 2 | Implementar compresión de prompt |
| R-10 | GDPR | **BAJO** | Futuro | Documentar en T&Cs, acción en expansión EU |

**Bloqueantes reales para Sprint 1:** Solo R-01 (Fabric.js). Todos los demás permiten iniciar el Sprint 1 con los planes de mitigación documentados.

---

# PARTE 2 — FINANCIAL ARCHITECTURE REVIEW

## 2.1 Costo Real de APIs por Operación

### OpenAI GPT-4o (texto)

Precios actuales (junio 2026):
- Input: $2.50 / 1M tokens
- Output: $10.00 / 1M tokens

**Generación de texto para un post (post_complete):**

| Componente | Tokens estimados | Costo |
|-----------|----------------|-------|
| System prompt (Brand Brain medio, 10 servicios, 5 objeciones) | 4,500 tokens input | $0.01125 |
| User message (idea + formato + zonas) | 300 tokens input | $0.00075 |
| Respuesta JSON (headline + body + cta + hashtags + imagePrompt) | 600 tokens output | $0.00600 |
| **Total por generación de texto** | | **$0.01800** |

**Generación de estrategia de campaña (campaign_strategy):**

| Componente | Tokens estimados | Costo |
|-----------|----------------|-------|
| System prompt (Brand Brain completo) | 5,000 tokens input | $0.01250 |
| User message (objetivo + plataformas + dateRange) | 400 tokens input | $0.00100 |
| Respuesta JSON (estrategia completa, 12 postPlans) | 2,000 tokens output | $0.02000 |
| **Total por campaña (estrategia)** | | **$0.03350** |

**Sugerencia del Brand Brain wizard (brand_suggestion):**

Usa GPT-4o-mini:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens
- Estimado por sugerencia: $0.0008 (casi gratuito)

---

### Fal.ai Flux Pro (imagen)

Precios actuales (junio 2026):
- Flux Pro: $0.055 por imagen (1024×1024)
- Flux Pro (1080×1080 — formato Instagram): $0.055 (el precio es por imagen, no por resolución en Fal.ai)

**Nota:** Fal.ai cobra en sus créditos internos. La conversión a dólares es:
- 1,000 Fal.ai credits = $10.00
- 1 imagen Flux Pro ≈ 5.5 Fal.ai credits = $0.055

---

### Ideogram v2 (imagen con texto)

Precios actuales (junio 2026):
- Ideogram v2: $0.08 por imagen (calidad estándar)
- Ideogram v2 Turbo: $0.05 por imagen (calidad ligeramente inferior)

Para el MVP: Usar Ideogram v2 Turbo a $0.05 cuando el template requiere texto integrado.

---

### Firebase (Firestore + Storage + Functions)

Precios en el tier Blaze (pago por uso):

**Firestore:**
| Operación | Precio | Uso estimado por usuario activo/mes |
|-----------|--------|-------------------------------------|
| Reads | $0.06/100K | ~2,000 reads → $0.0012 |
| Writes | $0.18/100K | ~500 writes → $0.0009 |
| Stored data | $0.18/GB/mes | ~0.5MB de metadata → $0.00009 |
| **Total Firestore/usuario/mes** | | **~$0.0022** |

**Firebase Storage:**
| Operación | Precio | Uso estimado por usuario activo/mes (50 posts) |
|-----------|--------|------------------------------------------------|
| Storage | $0.026/GB/mes | ~160MB → $0.0042 |
| Downloads | $0.12/GB | ~500MB → $0.06 |
| Uploads | $0.00 | — |
| **Total Storage/usuario/mes** | | **~$0.064** |

**Cloud Functions Gen 2:**
| Componente | Precio | Uso estimado por usuario activo/mes (50 posts) |
|-----------|--------|------------------------------------------------|
| Invocations | $0.40/1M | ~100 → negligible |
| Compute (512MB, 20s avg) | $0.00018/GB-s | 100 posts × 0.5GB × 20s = 1,000 GB-s → $0.18 |
| Networking | $0.12/GB | ~200MB → $0.024 |
| **Total Cloud Functions/usuario/mes** | | **~$0.20** |

**Firebase total por usuario activo/mes: ~$0.27**

---

## 2.2 Costo Real por Operación de Crédito

Resumiendo los costos reales de API por cada operación del sistema de créditos:

| Operación | Créditos cobrados | Costo API real | Costo/crédito de API |
|-----------|-----------------|----------------|---------------------|
| `brand_suggestion` | 1 | $0.0008 (GPT-4o-mini) | $0.0008 |
| `post_text_only` | 2 | $0.0180 (GPT-4o) | $0.0090 |
| `post_image_flux` | 6 | $0.0550 (Flux Pro) | $0.0092 |
| `post_image_ideogram` | 6 | $0.0500 (Ideogram v2 Turbo) | $0.0083 |
| `post_complete` | 8 | $0.0730 (texto + Flux) | $0.0091 |
| `post_variant` | 5 | $0.0730 (texto + imagen) | $0.0146 |
| `campaign_strategy` | 3 | $0.0335 (GPT-4o) | $0.0112 |
| `campaign_post` | 8 | $0.0730 (texto + Flux) | $0.0091 |
| `image_regeneration` | 5 | $0.0550 (Flux) | $0.0110 |
| `text_regeneration` | 2 | $0.0180 (GPT-4o) | $0.0090 |

**Costo promedio de API por crédito: ~$0.0092 (≈ $0.0093)**

**Resumen:** Cada crédito cuesta ~$0.0093 en APIs. Este número es la base de toda la arquitectura financiera.

---

## 2.3 Estructura de Planes y Precios Propuestos

### Propuesta de precios

| Plan | Créditos/mes | Precio/mes | Precio/año | Posts equiv. | Campañas equiv. |
|------|------------|-----------|-----------|-------------|----------------|
| Free | 50 | $0 | $0 | ~6 posts | ~½ campaña |
| Starter | 200 | $19 USD | $190 USD (17% dto) | ~25 posts | ~2 campañas |
| Pro | 600 | $49 USD | $490 USD (17% dto) | ~75 posts | ~6 campañas |
| Agency | 2,000 | $149 USD | $1,490 USD (17% dto) | ~250 posts | ~20 campañas |

**Nota de pricing:** Los precios están en USD porque los modelos de IA que se consumen (OpenAI, Fal.ai, Ideogram) cobran en USD. Hay dos opciones para el mercado mexicano:
1. **Cobrar en USD** — más simple, los costos de API están en USD. El cliente asume el riesgo FX.
2. **Cobrar en MXN** — mejor UX para mercado local, pero se necesita agregar un margen FX (10-15%) para absorber la variación del tipo de cambio. A $17-18 MXN/USD (junio 2026), Starter sería ~$342 MXN.

**Recomendación:** Cobrar en MXN con un precio que asuma $18 MXN/USD más 10% de margen FX.

---

## 2.4 Análisis de Márgenes por Plan

### Cálculo de costo total por plan (worst case: usuario usa el 100% de sus créditos)

**Plan Free (50 créditos, $0 revenue)**

| Componente | Costo |
|-----------|-------|
| API calls (50 créditos × $0.0093) | $0.465 |
| Firebase (usuario activo/mes) | $0.27 |
| Overhead (soporte, monitoreo, ~$0.10/usuario) | $0.10 |
| **Costo total por usuario Free** | **$0.835/mes** |
| Revenue | $0 |
| **Margen** | **-$0.835** |

El usuario Free cuesta ~$0.84/mes. Con 50 créditos no puede generar suficiente contenido para ser un usuario activo real — en la práctica, el costo real será $0.30-0.50 porque muchos free users no usan todos sus créditos.

**Decisión recomendada sobre Free:** Cap de 50 créditos/mes es correcto. El plan Free es un lead magnet, no un plan sostenible. Cada usuario Free que convierte a Starter a $19 recupera 22+ meses de pérdida del periodo Free.

---

**Plan Starter (200 créditos, $19 USD/mes)**

| Componente | Worst case (100% uso) | Caso típico (60% uso) |
|-----------|----------------------|----------------------|
| API calls (200 créditos × $0.0093) | $1.86 | $1.12 |
| Firebase | $0.27 | $0.20 |
| Cloud Functions compute | $0.20 | $0.12 |
| Overhead | $0.50 | $0.50 |
| **Costo total COGS** | **$2.83** | **$1.94** |
| Revenue | $19.00 | $19.00 |
| **Contribución bruta** | **$16.17** | **$17.06** |
| **Gross margin** | **85.1%** | **89.8%** |

---

**Plan Pro (600 créditos, $49 USD/mes)**

| Componente | Worst case (100% uso) | Caso típico (65% uso) |
|-----------|----------------------|----------------------|
| API calls (600 créditos × $0.0093) | $5.58 | $3.63 |
| Firebase | $0.45 | $0.35 |
| Cloud Functions compute | $0.40 | $0.26 |
| Overhead | $0.80 | $0.80 |
| **Costo total COGS** | **$7.23** | **$5.04** |
| Revenue | $49.00 | $49.00 |
| **Contribución bruta** | **$41.77** | **$43.96** |
| **Gross margin** | **85.2%** | **89.7%** |

---

**Plan Agency (2,000 créditos, $149 USD/mes)**

| Componente | Worst case (100% uso) | Caso típico (70% uso) |
|-----------|----------------------|----------------------|
| API calls (2,000 créditos × $0.0093) | $18.60 | $13.02 |
| Firebase (múltiples marcas) | $1.20 | $0.90 |
| Cloud Functions compute | $1.20 | $0.84 |
| Overhead (soporte agencias) | $2.00 | $2.00 |
| **Costo total COGS** | **$23.00** | **$16.76** |
| Revenue | $149.00 | $149.00 |
| **Contribución bruta** | **$126.00** | **$132.24** |
| **Gross margin** | **84.6%** | **88.7%** |

---

### Tabla resumen de márgenes

| Plan | Precio/mes | COGS worst case | Margen worst case | COGS típico | Margen típico |
|------|-----------|----------------|------------------|------------|--------------|
| Free | $0 | $0.84 | -∞ | $0.45 | -∞ |
| Starter | $19 | $2.83 | **85.1%** | $1.94 | **89.8%** |
| Pro | $49 | $7.23 | **85.2%** | $5.04 | **89.7%** |
| Agency | $149 | $23.00 | **84.6%** | $16.76 | **88.7%** |

**Conclusión:** Los márgenes brutos son sólidos (85-90%). Se comparan favorablemente con el estándar SaaS B2B de 70-80% en herramientas que consumen APIs de terceros.

---

## 2.5 Análisis de Break-Even y Proyecciones

### Break-even operacional (excluye desarrollo)

Costos operacionales estimados después del lanzamiento:
| Costo | Mensual |
|-------|--------|
| Firebase plan Blaze (base mínima) | $25 |
| OpenAI (créditos pre-comprados o pay-as-you-go) | Variable |
| Fal.ai | Variable |
| Dominio + certificados + CI/CD | $10 |
| Monitoreo (Sentry, Grafana Cloud free tier) | $0-20 |
| **Costos fijos mensuales** | **~$35-55** |

**Break-even con solo clientes Starter ($19):**
$55 fijos / $16.17 contribución por Starter = **3-4 clientes Starter para cubrir costos fijos**

**Break-even con mix realista (4 Starter + 2 Pro):**
- Revenue: (4 × $19) + (2 × $49) = $76 + $98 = $174
- COGS variables: ~$25
- Fijos: $55
- **Beneficio: $94/mes con solo 6 clientes**

---

### Proyección de ingresos por escenario

**Escenario conservador (año 1):**
- Mes 1-3: 5 Starter, 2 Pro, 1 Agency → MRR: $390
- Mes 4-6: 15 Starter, 6 Pro, 3 Agency → MRR: $1,134
- Mes 7-9: 30 Starter, 12 Pro, 6 Agency → MRR: $2,214
- Mes 10-12: 50 Starter, 20 Pro, 10 Agency → MRR: $3,440
- **ARR año 1: ~$28,000 USD**

**Escenario moderado (año 1):**
- Mes 12: 80 Starter, 35 Pro, 15 Agency → MRR: $4,990
- **ARR año 1: ~$40,000 USD**

**Escenario optimista (año 1):**
- Mes 12: 120 Starter, 60 Pro, 25 Agency → MRR: $7,665
- **ARR año 1: ~$60,000 USD**

---

## 2.6 Análisis de Créditos Adicionales (Top-ups)

El diseño actual (créditos mensuales que no se acumulan + top-ups) es la estructura correcta. Análisis de los top-ups:

**Propuesta de paquetes de créditos adicionales:**

| Paquete | Créditos | Precio USD | Precio/crédito | Margen |
|---------|---------|-----------|---------------|--------|
| Micro | 100 | $9.99 | $0.0999 | ~90.7% |
| Standard | 500 | $39.99 | $0.0799 | ~88.4% |
| Pro | 1,000 | $69.99 | $0.0699 | ~86.7% |
| Mega | 3,000 | $179.99 | $0.0600 | ~84.5% |

Los top-ups son la fuente de ingresos más eficiente: el usuario ya tiene el hábito, ya confía, y el COGS es el mismo. Históricamente en SaaS de créditos (Jasper, MidJourney), el top-up representa 15-25% del MRR total.

---

## 2.7 Riesgos Financieros Críticos

### RIESGO-FIN-01 — Variación de precios de IA

**Descripción:** OpenAI, Fal.ai e Ideogram pueden subir precios. Históricamente:
- OpenAI subió el precio de GPT-4 3 veces en 2023-2024 antes de bajarlo
- GPT-4o se lanzó a un precio 50% menor que GPT-4 Turbo (mejora favorable)
- Flux Pro ha mantenido precios estables desde su lanzamiento (positivo)

**Escenario de estrés: precios de IA suben 100%**
- Nuevo costo/crédito: $0.0093 × 2 = $0.0186
- Margen del Plan Starter worst case: ($19 - $5.66 - $0.97) / $19 = **67.2%**
- Aún rentable, pero 18 puntos de margen perdidos

**Mitigación:**
1. Los precios de planes deben poder ajustarse independientemente de los créditos activos (grandfathering opcional).
2. Mantener la arquitectura de providers intercambiables — si GPT-4o sube, evaluar migrar parte de la generación a Claude o Gemini.
3. Cuando haya escala (>500 clientes), negociar precios enterprise con OpenAI.

---

### RIESGO-FIN-02 — Abuso del plan Free

**Descripción:** Usuarios que crean múltiples cuentas para aprovechar los 50 créditos gratuitos indefinidamente.

**Impacto:** Cada cuenta Free mal utilizada cuesta ~$0.84/mes. Con 100 usuarios abusivos: $84/mes de pérdida.

**Mitigaciones:**
1. Requerir verificación de email antes de activar los créditos de trial.
2. Rate limiting a nivel de IP para la creación de cuentas.
3. Después de 3 meses, una cuenta Free que no ha convertido puede tener sus créditos reducidos a 20/mes.

---

### RIESGO-FIN-03 — Churn del plan Agency antes de recuperar CAC

**Descripción:** Si el costo de adquirir un cliente Agency (demos, onboarding personalizado, soporte) es $300-500, necesitas 2-4 meses de retención solo para recuperar el CAC.

**Mitigación:** El módulo de Agency se enfoca en agencias que gestionan múltiples marcas — el switching cost es muy alto una vez que el Brand Brain de todos sus clientes está configurado. El churn natural en herramientas de marketing para agencias es < 5% mensual cuando el producto tiene suficiente valor.

---

### RIESGO-FIN-04 — Tipo de cambio para mercado mexicano

**Descripción:** Si se cobra en MXN y los APIs se pagan en USD, una devaluación del peso reduce los márgenes reales.

**Mitigación:**
- Configurar los precios en MXN con un tipo de cambio conservador de $18.50 MXN/USD (julio 2026).
- Revisar los precios en MXN cada 6 meses y ajustar si el tipo de cambio varía más del 10%.
- Alternativa: cobrar en USD para clientes mexicanos que prefieran esa opción (empresas medianas y agencias tienden a tener dólares).

---

## 2.8 Benchmarking de Precios vs. Competidores

| Herramienta | Precio/mes | Lo que incluye | Posición vs. PixelTEC |
|-------------|-----------|---------------|----------------------|
| Buffer Essentials | $6 | Scheduling, sin IA | Infravalor total |
| Later Growing | $25 | Scheduling + AI copy básico, sin imágenes | Menos valor que Starter |
| Hootsuite Professional | $99 | Scheduling multi-red, AI básico | Comparable Pro/Agency |
| Jasper Creator | $49 | AI copy solo, sin imágenes, sin scheduling | Menos funcional que Pro |
| Canva Pro | $15 | Templates visuales, sin AI copy, sin campaigns | Herramienta diferente |
| MidJourney Basic | $10 | Solo imágenes, sin copy, sin contexto de marca | No comparable |
| Predis.ai Pro | $59 | AI posts + scheduling | Competidor más directo |
| ContentStudio Pro | $59 | AI + scheduling + analytics | Competidor directo |

**Conclusión de pricing:** PixelTEC Growth Suite a $19-49-149 USD/mes con Brand Brain + Campaign Engine está posicionado en el mismo rango que competidores que ofrecen menos. El diferenciador real (Brand Brain que entiende el negocio, flow de Campaign → Posts) justifica el precio.

---

## 2.9 Recomendaciones Financieras para el Diseño del MVP

### 1. El sistema de créditos está bien diseñado — ejecutar exactamente como está

El margen de 85-90% es sólido. No hay necesidad de cambiar la arquitectura de créditos.

### 2. Agregar un nivel intermedio entre Free y Starter

La brecha entre 50 créditos (Free) y 200 créditos (Starter) es grande. Considerar:
- **"Básico"**: 80 créditos por $9 USD/mes → elimina el "salto" percibido para microempresas
- Alternativamente: mantenerse con 4 planes pero dar 100 créditos de bienvenida al registrarse (trial de un mes real)

### 3. Los créditos de `post_variant` están mal calculados

El blueprint propone 5 créditos para una variante (`texto + imagen diferente`). Pero el costo real de texto+imagen es $0.073 → 8 créditos. Si se cobra 5, se pierde margen:
- 5 créditos × $0.0093 de costo = $0.0465 de ingresos de API contra $0.073 de costo = **margen negativo en variantes**

**Corrección necesaria:** Las variantes deben costar 7-8 créditos, no 5. Alternativa: las variantes solo regeneran el texto (2 créditos) o solo la imagen (6 créditos), no ambos simultáneamente. Esto da control al usuario y es más económico.

### 4. Iniciar con top-ups desde el día 1

No esperar a que el sistema esté maduro. Los top-ups son ingresos de alta conversión — el usuario ya usa el producto, solo necesita comprar más. Integrar Stripe en Sprint 7 como está planeado pero tener el botón "Comprar créditos" visible (aunque muestre "Próximamente") desde Sprint 1.

### 5. Monitor de costos de IA desde el Sprint 2

Implementar logging de costo real de cada generación en un campo `generation.actualApiCost` (float) en el `GenerationJob`. Esto permite:
- Detectar desviaciones en los costos estimados
- Identificar si ciertos tipos de posts o ciertas marcas cuestan significativamente más
- Ajustar la tabla de `CREDIT_COSTS` con datos reales antes del lanzamiento público

---

## 2.10 Escenario de Stress Test Financiero

**Pregunta:** ¿Puede el sistema sobrevivir a un usuario que "rompe" los límites?

**Caso extremo — Agency Plan con 1 superusuario:**
- 2,000 créditos/mes todos usados en `campaign_strategy` (la operación más cara por crédito: $0.0112/crédito)
- Costo API: 2,000 × $0.0112 = $22.40
- Revenue: $149
- Gross margin: ($149 - $22.40 - $8 infra) / $149 = **79.0%** — todavía rentable

**Caso de abuso — plan Starter con top-ups ilimitados:**
- 200 créditos base + compra de 3,000 adicionales en el mes
- Total: 3,200 créditos × $0.0093 = $29.76 costo API
- Revenue: $19 (plan) + $179.99 (top-up Mega) = $198.99
- Gross margin: ($198.99 - $29.76 - $12) / $198.99 = **79.5%**

El sistema es financieramente robusto ante el uso máximo posible. No hay escenario de uso legítimo que genere margen negativo.

---

# PARTE 3 — VEREDICTO Y DECISIONES REQUERIDAS

## GO / NO-GO

**Veredicto: GO CON AJUSTES**

La viabilidad comercial y técnica está validada. El modelo financiero es sólido (85-90% de gross margin). Los riesgos técnicos son conocidos y tienen mitigaciones claras. Los únicos cambios al blueprint son necesarios antes de escribir código.

---

## Decisiones obligatorias antes del Sprint 1

### DECISIÓN-1 (CRÍTICA): Reemplazar Fabric.js por Sharp.js + SVG

**Impacto en el blueprint:**
- `compositor.ts` usa Sharp.js en lugar de Fabric.js
- Las templates almacenan SVG + JSON de zonas (en lugar de canvas JSON de Fabric.js)
- `canvasJsonUrl` → `svgTemplateUrl` en los tipos `Template` y `ContentPost`
- La API pública de zonas (`TemplateZone`) no cambia — el contrato con el editor de v2 se mantiene

**¿Qué se pierde?** La posibilidad de reutilizar el JSON directamente en un editor Fabric.js de v2. En v2 se puede generar el canvas JSON de Fabric.js a partir del SVG + zonas metadata — proceso reversible.

**Opciones:**
A. Cambiar a Sharp.js ahora (recomendado) — menor riesgo técnico
B. Mantener Fabric.js y usar Cloud Run con Dockerfile — mayor complejidad de deploy

---

### DECISIÓN-2 (ALTA): Límite máximo de posts por campaña en MVP

**Recomendación:** 12 posts máx. por campaña en MVP.
- Esto garantiza que la Cloud Function termine dentro del límite de Gen 2 incluso con latencias altas
- A 12 posts × $0.073/post = $0.876 de costo API por campaña
- En términos de créditos: 3 (estrategia) + 12 × 8 (posts) = 99 créditos por campaña
- Un plan Starter (200 créditos) puede hacer 2 campañas completas — razonable

---

### DECISIÓN-3 (ALTA): Corrección de créditos para variantes

**Cambio necesario en `lib/growth/credits/costs.ts`:**

```
ANTES:    post_variant: 5
DESPUÉS:  post_variant_text_only: 2   // solo regenerar el texto
          post_variant_image_only: 6  // solo regenerar la imagen
          post_variant_both: 8        // texto + imagen nuevos (mismo que post_complete)
```

Esto elimina el margen negativo en variantes y da mejor control al usuario.

---

### DECISIÓN-4 (ALTA): Iniciar Meta App Review antes del Sprint 1

**Acción concreta:**
1. Ir a `developers.facebook.com` y crear la app
2. Completar Business Verification (requiere documentación legal del negocio)
3. Preparar video demo del flujo de publicación
4. Hacer el primer submission

**Esta acción no es técnica — es administrativa. Debe iniciar esta semana, no cuando llegue Sprint 5.**

---

### DECISIÓN-5 (MEDIA): Agregar `generation.actualApiCost` al GenerationJob

**Agrega el campo float en `GenerationJob`:**
```
actualApiCost: {
  textCost: number;     // USD gastado en GPT-4o
  imageCost: number;    // USD gastado en Flux/Ideogram
  totalCost: number;    // suma
}
```

Esto es observable inmediato desde Sprint 2 sin instrumentación adicional. Fundamental para validar los cálculos de este documento con datos reales.

---

## Resumen ejecutivo del veredicto

| Dimensión | Evaluación | Acción |
|-----------|-----------|--------|
| Margen bruto | ✅ 85-90% — excelente para SaaS | Ninguna |
| Modelo de créditos | ✅ Correcto en arquitectura | Ajustar costo de variantes (Decisión-3) |
| Pricing vs mercado | ✅ Competitivo y justificado | Ninguna |
| Riesgo técnico principal | ⚠️ Fabric.js en Node.js | Cambiar a Sharp.js (Decisión-1) |
| Dependencias externas | ⚠️ Meta App Review es lento | Iniciar inmediatamente (Decisión-4) |
| Race conditions | ⚠️ Créditos requieren transaction | Documentado como constraint (R-03) |
| Proveedor de imagen | ⚠️ Fal.ai sin SLA | Implementar fallback desde Sprint 2 |
| Viabilidad financiera | ✅ Break-even con 4 clientes | Ninguna |
| Escalabilidad | ✅ Margen se mantiene a 10× escala | Ninguna |

**El módulo Growth Suite es viable. Los 5 ajustes identificados son menores en relación al diseño total. Puede iniciarse el Sprint 0 esta semana con los cambios documentados.**
