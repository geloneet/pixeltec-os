# PixelTEC Growth Suite — Arquitectura Completa y Plan de Producto

> **Documento:** Diseño de producto, arquitectura técnica y roadmap.
> **Rol:** Product Manager Senior + Arquitecto de Software Enterprise + CTO SaaS.
> **Versión:** 2.0 — incorpora los 10 hallazgos críticos de producto.
> **Estado:** Pre-implementación. Este documento precede al plan de tareas técnicas.

---

## Los 10 Hallazgos Críticos

Antes de entrar en arquitectura, estos hallazgos rigen TODAS las decisiones técnicas y de producto. Cualquier tarea que contradiga uno de estos hallazgos está mal planteada.

**Hallazgo 1 — Template-first, IA-second.**
La IA no puede garantizar consistencia visual entre publicaciones. La consistencia viene del sistema de plantillas. La IA genera el CONTENIDO (copy, imagen, CTA), nunca el DISEÑO (layout, tipografía, colores).

**Hallazgo 2 — Social Publishing no es MVP.**
Meta App Review tarda 30-60 días. El MVP termina en exportación PNG. Publisher llega en v2. Iniciar App Review en Sprint 1, construir el resto mientras se espera aprobación.

**Hallazgo 3 — El editor visual de plantillas NO es MVP.**
Un editor tipo Canva son 3-6 meses de desarrollo. Las plantillas del MVP son JSON prediseñados. El editor visual es v2.

**Hallazgo 4 — Firestore no es un repositorio de assets.**
Canvas JSON, imágenes generadas, y assets binarios van en Firebase Storage. Firestore solo almacena metadatos y referencias.

**Hallazgo 5 — El crédito es la unidad de negocio.**
Cada operación de IA consume créditos. El sistema de créditos se diseña en Sprint 0. Sin él, una campaña puede costar $2 en APIs sin control.

**Hallazgo 6 — No vendas "Generador de Posts".**
Ese mercado está saturado (Canva, Predis, Ocoya, Simplified, Vista Social, Buffer AI, Hootsuite AI, Metricool AI). Lo que se vende es un **Motor de Campañas IA para Empresas de Servicios**. Verticales específicas: dentistas, clínicas, abogados, coaches, agencias. El diferenciador no es la IA — es que la IA ENTIENDE EL NEGOCIO de servicios.

**Hallazgo 7 — El activo más valioso NO son las imágenes.**
Las imágenes son commodity. El activo estratégico es el **Brand Brain**: la memoria de marca que incluye servicios, clientes ideales, objeciones, propuestas de valor, diferenciadores y casos de éxito. El Brand Brain es el moat del producto — es lo que hace que cada generación sea consistente con el negocio, no solo con la estética.

**Hallazgo 8 — Las campañas son el producto, no los posts.**
Las empresas no quieren "generar un post". Quieren "conseguir clientes". El flujo correcto es: Objetivo → Campaña → Contenido. No al revés. Esto aumenta el valor percibido 10x porque el usuario piensa en resultados, no en herramientas.

**Hallazgo 9 — El cliente principal son las agencias, no las empresas finales.**
Una agencia genera contenido para 10-20 clientes, paga más, y necesita el sistema multi-marca desde el día 1. El modelo de datos debe ser Organizations → Brands (plural) desde el Sprint 0. No "una empresa, una marca".

**Hallazgo 10 — El módulo necesita su propia sección de navegación.**
No va en "Configuración" ni en "Conocimiento". Requiere una sección **CRECIMIENTO** en el nav de PixelTEC OS que agrupe Brand Brain, Content Studio, Campañas y Analytics como un subsistema coherente.

---

## 1. Evaluación Crítica de la Idea

### Posicionamiento correcto

No construyas "otro generador de contenido IA". Construye el **sistema de marketing para empresas de servicios que ninguna herramienta existente tiene**: uno que entiende que un dentista vende implantes, que su cliente ideal tiene 35-55 años, que la objeción principal es el precio, y que el diferenciador es el financiamiento. Todo eso está en el Brand Brain. Eso produce contenido que ninguna herramienta genérica puede reproducir.

**El pitch correcto:**
> "PixelTEC Growth Suite — Crea campañas completas de marketing para tu empresa de servicios. La IA conoce tu negocio, tu marca y tus clientes. En 5 minutos generas un mes de contenido para Instagram, Facebook y LinkedIn."

### Lo que sí está resuelto correctamente

- Template-first para consistencia visual ✅
- Firebase como plataforma (evita fragmentación de stack) ✅
- Módulo dentro de PixelTEC OS, no proyecto separado ✅
- Preparado para SaaS comercializable ✅

### Cuatro riesgos que necesitan mitigación activa

**Riesgo 1 — Expectativa de "magia IA":** El usuario espera que la IA entienda su marca sin configuración. La onboarding del Brand Brain debe ser el primer paso obligatorio. Sin Brand Brain, no hay generación.

**Riesgo 2 — Tiempo hasta valor:** Si el usuario tarda más de 10 minutos en ver su primer post generado, abandona. El onboarding debe ser un wizard guiado, no un formulario de 40 campos.

**Riesgo 3 — Calidad de copy en español:** GPT-4o es excelente en español pero puede sonar genérico. El system prompt debe inyectar ejemplos reales de la marca (del Brand Brain) para forzar el estilo correcto.

**Riesgo 4 — Dependencia de proveedores IA:** Si Fal.ai sube precios o Ideogram cambia su API, el sistema debe poder cambiar de proveedor sin reescribir lógica de negocio. La capa de abstracción `AIProvider` es obligatoria.

---

## 2. Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Firestore document size limit (1MB) | Alta | Crítico | Canvas JSON va en Storage. Nunca en documentos de posts. |
| Latencia de generación IA (10-30s imagen) | Alta | Alto | Jobs async en Cloud Functions + SSE para progreso en UI |
| Inconsistencia visual entre generaciones | Alta | Alto | Template controla layout. IA solo genera contenido de zonas. |
| Social API rate limits | Media | Alto | Queue con retry. Sin llamadas directas desde cliente. |
| Costo de IA sin control | Alta | Crítico | Sistema de créditos desde Sprint 0. Hard limit por org. |
| Canvas JSON incompatibilidad de versiones | Media | Alto | Versionar schema de canvas. Migrations automáticas. |
| Lock-in con un proveedor IA | Media | Medio | Capa abstracta `AITextProvider` / `AIImageProvider`. |
| Firebase Storage egress costs | Media | Medio | Cloudflare CDN frente a Storage. Comprimir imágenes a ≤2MB. |
| Concurrent writes al contador de créditos | Media | Alto | `FieldValue.increment()` para atomicidad. |
| Access tokens de redes sociales expuestos | Baja | Crítico | Tokens encriptados en Firestore. Solo Cloud Functions desencriptan. |

---

## 3. Riesgos de Negocio

**Competencia saturada a evitar:** Canva, Predis.ai, Ocoya, Simplified, Vista Social, Buffer AI, Hootsuite AI, Metricool AI. Todos son generalistas para cualquier negocio.

**Ventaja defensible:** Ninguno tiene Brand Brain vertical para servicios. Ninguno genera campañas desde un objetivo de negocio. Ninguno entiende la diferencia entre el copy de un dentista y el de un coach.

**Riesgo de precio en LATAM:** El precio debe ser accesible (≤$49/mes para Starter). El precio alto destruye la adopción en el mercado inicial.

**Riesgo de onboarding largo:** Si el Brand Brain tarda 30 minutos en configurarse, la conversión de trial es baja. El wizard debe ser ≤10 minutos con opciones de autocompletado por industria.

**Riesgo de retención:** El valor del producto crece con el tiempo (el Brand Brain se vuelve más rico). Hay que comunicar este flywheel desde el primer día: "Cuanto más lo uses, mejor te conoce."

---

## 4. Arquitectura Recomendada

### Principio central: Brand Brain → Campaign Engine → Content Assets

```
[Brand Brain]
  ↓ (conocimiento del negocio: servicios, ICP, objeciones, diferenciadores)
[Campaign Engine]
  ↓ (objetivo → estrategia → estructura de campaña)
[AI Content Engine]
  ↓ (copy + prompt de imagen por formato)
[Template System]
  ↓ (layout controlado, zonas editables)
[Image Provider]
  ↓ (imagen respetando prompt y zona)
[Compositor]
  ↓ (template + texto + imagen = post final)
[Publisher / Export]
```

### Stack técnico

```
Frontend:       Next.js 14 App Router (mismo stack que PixelTEC OS)
Canvas:         Fabric.js v6 (renderizado de plantillas en browser)
AI Text:        OpenAI GPT-4o (copy, headline, CTA, hashtags, estrategia de campaña)
AI Image:       Flux Pro via Fal.ai (imágenes profesionales)
AI Image Alt:   Ideogram v2 (posts con texto prominente en imagen)
Queue:          Firebase Cloud Functions (jobs async de IA)
Storage:        Firebase Storage (assets, imágenes generadas, logos, canvas JSON)
DB:             Firestore (metadatos, Brand Brain, campañas, calendario)
Scheduler:      Firebase Cloud Functions + Cloud Scheduler (publicación programada)
Social:         Meta Graph API (v1.1), LinkedIn API (v1.2), X API (v2 — después de revenue)
Payments:       Stripe (créditos adicionales + planes)
```

### Diagrama de módulos

```
growth-suite/
├── brand-brain/            ← Memoria de marca (el activo central)
│   ├── identity/           ← Logo, colores, tipografía
│   ├── voice/              ← Tono, personalidad, idioma
│   ├── business/           ← Servicios, ICP, industria, ubicación
│   ├── positioning/        ← Propuestas de valor, diferenciadores
│   ├── objections/         ← Objeciones comunes y respuestas
│   └── content-rules/      ← Qué publicar, qué evitar, ejemplos
│
├── content-studio/         ← Generador de posts individuales
│   ├── template-library/   ← Repositorio de plantillas
│   ├── ai-engine/          ← Generación de copy e imagen
│   └── compositor/         ← Ensamblado final + export
│
├── campaigns/              ← Motor de campañas (el producto principal)
│   ├── campaign-creator/   ← Objetivo → estructura → generación en lote
│   └── campaign-view/      ← Vista y gestión de campaña
│
├── content-calendar/       ← Vista calendario + scheduler
│
├── social-publisher/       ← Publicación directa (v2)
│
├── asset-manager/          ← Biblioteca de recursos
│
└── analytics/              ← (Fase 3 — arquitectura preparada)
```

---

## 5. Arquitectura que NO Recomiendo

### ❌ Una organización = una marca

El cliente principal son agencias que manejan 5-20 marcas. Si el modelo es `orgId → una sola marca`, la migración posterior es dolorosa. Desde el Sprint 0: `Organization → Brands[]`.

### ❌ "Brand Center" como formulario de colores

Diseñar Brand Brain como solo "logo + colores + tipografía" pierde el 80% del valor. Los colores los puede tener Canva. Lo que Canva no puede tener es el conocimiento de los servicios, objeciones y diferenciadores del negocio. Eso es el moat.

### ❌ El flujo Posts → Campaña (hacia arriba)

No. Las empresas piensan en objetivos, no en posts. El flujo de la UI debe ser siempre: Objetivo → Campaña → Posts. Si empiezas con "qué post quieres generar", estás vendiendo una herramienta genérica.

### ❌ Patrón crm_data/{uid} para Growth Suite

Funciona para el CRM single-tenant. No escala para un módulo donde una agencia tiene 10 marcas y genera 200 posts al mes.

### ❌ Llamadas a IA directas desde el cliente

Expone API keys. Sin control de costos. Sin manejo de timeout de 30s. Sin retry. Todo via Cloud Functions.

### ❌ Guardar canvas JSON o imágenes en Firestore

Firestore: solo metadatos. Firebase Storage: todo lo binario y estructuras grandes.

### ❌ Editor visual de plantillas en MVP

3-6 meses de desarrollo. Bloqueante. MVP usa plantillas JSON prediseñadas. Editor visual en v2.

### ❌ X/Twitter en MVP

$100/mes de API para algo usable no se justifica hasta tener revenue propio.

---

## 6. Modelo de Datos

```typescript
// ── Organización (tenant) ──────────────────────────────────────────
interface Organization {
  id: string;
  name: string;
  ownerId: string;           // Firebase Auth UID
  memberIds: string[];       // UIDs de miembros adicionales
  plan: "free" | "starter" | "pro" | "agency";
  credits: number;
  createdAt: Timestamp;
}

// ── Brand Brain ────────────────────────────────────────────────────
// El activo central del producto. Alimenta TODA la generación IA.
interface BrandBrain {
  id: string;
  orgId: string;
  name: string;               // "Clínica Dental Sur", "Ortodoncia Premium"

  // Identidad visual
  identity: {
    logoUrl: string;          // Firebase Storage URL
    colors: {
      primary: string;        // hex "#1A2B3C"
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography: {
      heading: string;        // "Poppins"
      body: string;           // "Inter"
    };
  };

  // Voz de marca
  voice: {
    personality: string[];    // ["profesional", "empático", "técnico"]
    avoid: string[];          // ["emojis excesivos", "jerga médica confusa"]
    language: "es" | "en" | "pt";
    formality: "formal" | "semiFormal" | "casual";
    examplePosts: string[];   // 3-5 ejemplos de posts que la marca aprueba
    forbiddenTopics: string[];// temas que nunca se publican
  };

  // Conocimiento del negocio
  business: {
    industry: string;         // "Salud Dental", "Consultoría TI", "Fitness"
    subIndustry?: string;     // "Ortodoncia", "Implantes"
    location: string;         // "Guadalajara, México"
    yearsInBusiness?: number;
    services: BrandService[];
    team?: string;            // "Equipo de 5 especialistas"
    certifications: string[]; // "ISO 9001", "SEP certificado"
  };

  // Posicionamiento estratégico
  positioning: {
    valueProps: string[];     // "Implantes con garantía de 10 años"
    differentiators: string[];// "Único laboratorio propio en la ciudad"
    competitorContext?: string;// "A diferencia de X, nosotros..."
    targetAudience: ICP;
    pricePosition: "economy" | "midRange" | "premium" | "luxury";
  };

  // Manejo de objeciones
  objections: ObjectionResponse[];

  // Reglas de contenido
  contentRules: {
    preferredFormats: string[];// ["instagram_post", "instagram_story"]
    postingFrequency?: string; // "3 veces por semana"
    hashtagStrategy?: string;  // "10 hashtags, mix de generales y locales"
    callToActions: string[];   // ["Llama ahora", "Agenda tu cita gratis"]
  };

  isComplete: boolean;        // false si el onboarding no está completo
  completionScore: number;    // 0-100, para mostrar progreso al usuario
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

interface BrandService {
  name: string;             // "Implantes dentales"
  description: string;      // "Implantes de titanio con garantía de por vida"
  price?: string;           // "Desde $15,000 MXN"
  duration?: string;        // "1-3 sesiones"
  targetPain: string;       // "Dientes faltantes que generan inseguridad"
  benefit: string;          // "Recupera tu sonrisa y confianza en 3 meses"
}

interface ICP {
  // Ideal Customer Profile
  ageRange?: string;        // "35-55 años"
  gender?: string;          // "Cualquier género"
  income?: string;          // "Clase media-alta"
  location?: string;        // "Ciudad, zona norte"
  painPoints: string[];     // ["Precio alto", "Miedo al dentista", "Tiempo"]
  goals: string[];          // ["Sonrisa perfecta", "Salud dental long-term"]
  triggers: string[];       // ["Boda próxima", "Nuevo trabajo", "Foto viral"]
}

interface ObjectionResponse {
  objection: string;        // "Es muy caro"
  response: string;         // "Tenemos planes de pago sin intereses"
  contentHook?: string;     // "Post: '¿Crees que los implantes son caros? Lee esto'"
}

// ── Plantilla maestra ──────────────────────────────────────────────
interface Template {
  id: string;
  orgId: string | "global";  // "global" = plantillas del sistema
  name: string;
  format: TemplateFormat;
  dimensions: { width: number; height: number };
  canvasJsonUrl: string;     // Firebase Storage URL (no en Firestore)
  zones: TemplateZone[];
  thumbnailUrl: string;
  category: "servicio" | "testimonio" | "educativo" | "promocion" | "historia" | "anuncio";
  industries: string[];      // ["Salud", "General"] — vacío = todos
  isActive: boolean;
  version: number;           // para migration de canvas JSON
  createdAt: Timestamp;
}

type TemplateFormat =
  | "instagram_post"
  | "instagram_story"
  | "instagram_carousel_slide"
  | "facebook_post"
  | "linkedin_post"
  | "twitter_post"
  | "banner_web"
  | "email_header";

interface TemplateZone {
  id: string;               // "headline", "body", "image_main", "cta", "logo", "price"
  type: "text" | "image" | "logo" | "background_color" | "accent_color";
  locked: boolean;          // si true, la IA no puede modificarlo
  aiRole: "headline" | "body" | "cta" | "hashtags" | "image_prompt" | "price" | null;
  maxLength?: number;
  style?: object;           // Fabric.js style overrides opcionales
}

// ── Post individual ────────────────────────────────────────────────
interface ContentPost {
  id: string;
  orgId: string;
  brandId: string;
  templateId: string;
  campaignId?: string;      // null = post suelto de Content Studio

  status: "generating" | "draft" | "approved" | "scheduled" | "published" | "failed";
  format: TemplateFormat;

  content: {
    headline: string;
    body: string;
    cta: string;
    hashtags: string[];
    imagePrompt: string;    // prompt usado para generar la imagen
    imageUrl: string;       // Firebase Storage URL (imagen generada)
    canvasJsonUrl: string;  // Firebase Storage URL (canvas final)
    finalImageUrl: string;  // Firebase Storage URL (PNG/JPEG exportado)
  };

  aiMetadata: {
    textModel: string;      // "gpt-4o"
    imageModel: string;     // "flux-pro" | "ideogram-v2"
    creditsUsed: number;
    prompt: string;         // idea original del usuario
    brandSnapshot: object;  // snapshot del BrandBrain al momento de generar
    generatedAt: Timestamp;
  };

  scheduling: {
    scheduledAt?: Timestamp;
    publishedAt?: Timestamp;
    platforms: PublishedPlatform[];
  };

  variantOf?: string;       // postId del post original del que es variante
  variantIndex?: number;    // 1, 2, 3

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface PublishedPlatform {
  name: "instagram" | "facebook" | "linkedin" | "twitter";
  socialAccountId: string;
  status: "pending" | "published" | "failed";
  publishedUrl?: string;
  error?: string;
  attemptedAt: Timestamp;
}

// ── Campaña ────────────────────────────────────────────────────────
// Las campañas son el producto principal. No los posts.
interface Campaign {
  id: string;
  orgId: string;
  brandId: string;
  name: string;

  // El usuario piensa en objetivos, no en posts
  objective: string;        // "Conseguir pacientes para implantes dentales"
  targetAction: string;     // "Agendar consulta gratuita"

  // La IA genera la estructura de la campaña
  strategy?: CampaignStrategy;

  status: "planning" | "generating" | "review" | "active" | "completed" | "archived";

  // Posts generados para la campaña
  postIds: string[];        // referencias — no embebidos
  totalPosts: number;
  approvedPosts: number;

  startDate?: Timestamp;
  endDate?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CampaignStrategy {
  // Generado por GPT-4o antes de crear los posts
  headline: string;                // "Automatiza tus citas con WhatsApp"
  angle: string;                   // "Miedo a perder pacientes + solución fácil"
  targetedPain: string;            // Pain del ICP que ataca esta campaña
  formats: CampaignPostPlan[];
  estimatedCredits: number;
  generatedAt: Timestamp;
}

interface CampaignPostPlan {
  format: TemplateFormat;
  templateId: string;
  count: number;
  purpose: string;          // "Awareness", "Consideración", "Conversión"
  keyMessage: string;       // mensaje clave de este grupo de posts
}

// ── Cuenta social ──────────────────────────────────────────────────
interface SocialAccount {
  id: string;
  orgId: string;
  platform: "instagram" | "facebook" | "linkedin" | "twitter";
  accountId: string;
  accountName: string;
  accessToken: string;      // ENCRIPTADO — solo Cloud Functions desencriptan
  refreshToken?: string;
  tokenExpiresAt?: Timestamp;
  scopes: string[];
  isActive: boolean;
  connectedAt: Timestamp;
}

// ── Asset ──────────────────────────────────────────────────────────
interface Asset {
  id: string;
  orgId: string;
  brandId?: string;
  type: "logo" | "photo" | "video" | "generated_post" | "template_thumbnail" | "canvas";
  url: string;              // Firebase Storage URL
  name: string;
  tags: string[];
  size: number;             // bytes
  dimensions?: { width: number; height: number };
  mimeType: string;
  linkedPostId?: string;
  createdAt: Timestamp;
}

// ── Créditos ───────────────────────────────────────────────────────
interface CreditLedger {
  id: string;
  orgId: string;
  type: "charge" | "refund" | "purchase" | "monthly_grant";
  amount: number;           // negativo = consumo, positivo = ingreso
  operation: CreditOperation;
  referenceId?: string;     // postId, campaignId, etc.
  balance: number;          // balance DESPUÉS de esta operación
  description: string;      // "Generación post Instagram — Clínica Dental Sur"
  createdAt: Timestamp;
}

type CreditOperation =
  | "text_generation"
  | "image_generation"
  | "post_variant"
  | "campaign_strategy"
  | "campaign_post"
  | "manual_refund";

// ── Job de generación (async) ──────────────────────────────────────
interface GenerationJob {
  id: string;
  orgId: string;
  type: "post" | "campaign" | "variant";
  status: "pending" | "processing" | "completed" | "failed";
  referenceId: string;      // postId o campaignId
  progress?: number;        // 0-100 para campañas
  currentStep?: string;     // "Generando copy..." | "Generando imagen 3/10..."
  error?: string;
  creditsUsed: number;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

---

## 7. Colecciones Firestore

### Estructura completa

```
firestore/
│
├── organizations/
│   └── {orgId}/
│       ├── [DOC]                  ← Organization
│       │
│       ├── brands/
│       │   └── {brandId}          ← BrandBrain
│       │
│       ├── templates/
│       │   └── {templateId}       ← Template (sin canvasJson — está en Storage)
│       │
│       ├── campaigns/
│       │   └── {campaignId}       ← Campaign
│       │
│       ├── posts/
│       │   └── {postId}           ← ContentPost
│       │
│       ├── social_accounts/
│       │   └── {accountId}        ← SocialAccount (token encriptado)
│       │
│       ├── assets/
│       │   └── {assetId}          ← Asset (solo metadatos)
│       │
│       └── credits/
│           ├── summary            ← { balance: number, totalPurchased: number, totalUsed: number }
│           └── ledger/
│               └── {entryId}      ← CreditLedger
│
├── global_templates/
│   └── {templateId}               ← Plantillas del sistema (read-only para users)
│
└── generation_jobs/
    └── {jobId}                    ← GenerationJob (procesado por Cloud Functions)
```

### Reglas críticas de Firestore

1. **Canvas JSON de plantillas → Firebase Storage** (`/{orgId}/templates/{templateId}/canvas.json`). Solo la URL se guarda en Firestore.
2. **Images generadas → Firebase Storage** (`/{orgId}/posts/{postId}/image.jpg`). Firestore solo guarda la URL.
3. **`credits/summary` → nunca escribir desde el cliente**. Solo Cloud Functions con `FieldValue.increment()`.
4. **Access tokens → encriptados en Firestore**. La Cloud Function tiene la clave. El cliente nunca ve el token real.
5. **No guardar array de `postIds` en Campaign sin límite**. Con 200 posts/campaña, el documento revienta. Usar query `where("campaignId", "==", id)` en su lugar. El campo `postIds` solo para las primeras 50 referencias.

### Índices compuestos necesarios

```
posts:      [orgId ASC, brandId ASC, status ASC, createdAt DESC]
posts:      [orgId ASC, campaignId ASC, createdAt DESC]
posts:      [orgId ASC, scheduledAt ASC]          ← para el calendario
campaigns:  [orgId ASC, status ASC, createdAt DESC]
assets:     [orgId ASC, brandId ASC, type ASC, createdAt DESC]
credits/ledger: [orgId ASC, createdAt DESC]
generation_jobs: [orgId ASC, status ASC, createdAt DESC]
```

---

## 8. Integraciones Externas

### AI — Texto

| Proveedor | Uso | Costo/1K tokens | Decisión |
|-----------|-----|----------------|---------|
| **GPT-4o** | Copy, headline, CTA, estrategia de campaña | $0.005 | ✅ PRINCIPAL |
| GPT-4o-mini | Borradores rápidos, hashtags | $0.0001 | ✅ BORRADORES |
| Claude Sonnet 4.6 | Alternativa si OpenAI falla | $0.003 | FALLBACK |

System prompt de GPT-4o incluye el BrandBrain completo + ejemplos de la marca + instrucción de idioma/tono. Sin esto, el copy es genérico.

### AI — Imagen

| Proveedor | Fortaleza | Costo/imagen | API | Decisión |
|-----------|-----------|-------------|-----|---------|
| **Flux Pro** (Fal.ai) | Fotografía profesional, estilo editorial | $0.05-0.08 | ✅ Excelente | ✅ PRINCIPAL |
| **Ideogram v2** | Texto en imagen, tipografía en diseños | $0.08 | ✅ Buena | ✅ TEXTO EN IMAGEN |
| Recraft v3 | Vectores, ilustraciones, íconos | $0.04 | ✅ Buena | FASE 2 |
| GPT Image (gpt-image-1) | Versatil, buen seguimiento de instrucciones | $0.04-0.12 | ✅ | ALTERNATIVA |
| Midjourney | Mejor calidad estética | — | ❌ Sin API | NUNCA |

**Capa de abstracción:**
```typescript
interface AIImageProvider {
  name: string;
  generate(prompt: string, options: ImageGenerationOptions): Promise<{ url: string; creditsUsed: number }>;
}
// Implementaciones: FluxProvider, IdeogramProvider, GPTImageProvider
// Selección automática según: format, tiene_texto_en_imagen, industria
```

### Social Media APIs

| Red | API | App Review | Límites | Prioridad |
|-----|-----|------------|---------|----------|
| **Instagram** | Meta Graph API v21+ | 30-60 días | 25 posts/día | v1.1 |
| **Facebook** | Meta Graph API v21+ | (mismo proceso) | 200 posts/día | v1.1 |
| **LinkedIn** | Marketing Dev Platform | 2-4 semanas | 150 req/día | v1.2 |
| **X/Twitter** | X API v2 Basic | Inmediato | $100/mes | v2.0 |

**Acción inmediata:** Iniciar proceso de App Review de Meta en **Sprint 1**. Mientras se espera aprobación (60 días), se construyen los Sprints 2-4.

---

## 9. Diseño del Dashboard

### Pantalla principal `/crecimiento`

```
┌──────────────────────────────────────────────────────────────────┐
│ PixelTEC Growth Suite                    [🧠 Brand Brain]  [⚡240] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Nueva campaña    │  │ Post rápido      │  │ Assets        │  │
│  │ ──────────────── │  │ ──────────────── │  │ ─────────── │  │
│  │ Objetivo →       │  │ Idea → PNG       │  │ 42 archivos  │  │
│  │ 10 posts en lote │  │ en 2 minutos     │  │ [Ver todo]   │  │
│  │ [Crear]          │  │ [Generar]        │  └───────────────┘  │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  CALENDARIO — Esta semana                                        │
│  ┌────────┬───────────┬───────────┬──────────┬──────────────┐   │
│  │ Lun 23 │  Mar 24   │  Mié 25   │  Jue 26  │   Vie 27    │   │
│  │ 10am   │           │   2pm     │   9pm    │             │   │
│  │ [FB]   │           │   [LI]    │   [IG]   │             │   │
│  └────────┴───────────┴───────────┴──────────┴──────────────┘   │
│                                                                  │
│  CAMPAÑAS ACTIVAS                  BORRADORES (3)                │
│  • Automatiza citas WhatsApp       [preview] [preview] [preview] │
│    12/15 posts aprobados           [Ver todos los borradores]    │
│  • Lanzamiento nuevo servicio                                    │
│    En generación... ████░░ 60%                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Brand Brain Wizard (onboarding obligatorio)

El usuario no puede generar contenido sin completar el Brand Brain. El wizard tiene 5 pasos con autocompletado por industria:

```
Paso 1/5 — ¿Cuál es tu negocio?
  Industria [Salud ▼] → Sub-industria [Dental ▼]
  Nombre de la marca: [Clínica Dental Sur]
  Ciudad: [Guadalajara, México]
  [Continuar]

Paso 2/5 — Tus servicios principales
  Servicio 1: [Implantes dentales]
  Para quién: [Adultos con dientes faltantes]
  Beneficio clave: [Recupera tu sonrisa en 3 meses]
  [+ Agregar servicio]  [Continuar]

Paso 3/5 — Tu cliente ideal
  Rango de edad: [35-55 años]
  Principal preocupación: [El precio es muy alto]
  Respuesta: [Tenemos planes sin intereses desde $500/mes]
  [Continuar]

Paso 4/5 — Tu voz y estilo
  Tono: [Profesional ×] [Empático ×] [+Agregar]
  Nunca decir: [Barato] [Doloroso] [+Agregar]
  [Continuar]

Paso 5/5 — Tu identidad visual
  Logo: [Subir archivo]
  Color principal: [🎨 #1A2B3C]
  Tipografía: [Poppins ▼]
  [Finalizar Brand Brain]
```

Score de completitud: 0-100% visible siempre. El sistema puede generar con 60%+, pero recomienda completar el 100%.

### `/crecimiento/nueva-campana` — Campaign Creator

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Nueva Campaña                               [Guardar borrador] │
├──────────────────────────┬──────────────────────────────────────┤
│ 1. Objetivo              │ Estrategia generada por IA           │
│ ─────────────            │ ─────────────────────────────        │
│ ¿Qué quieres lograr?     │                                      │
│ "Conseguir pacientes     │ Campaña: "Implantes para siempre"    │
│  para implantes"         │                                      │
│                          │ Ángulo: Miedo a perder + solución    │
│ 2. Marca                 │ Target: 35-55 años, Guadalajara      │
│ [Clínica Dental Sur ▼]   │                                      │
│                          │ Estructura:                          │
│ 3. Duración              │ • 4 Instagram Posts (Awareness)      │
│ [2 semanas ▼]            │ • 3 Instagram Stories (Social proof) │
│                          │ • 2 Facebook Posts (Conversión)      │
│ 4. Plataformas           │ • 1 Carrusel (Educativo)             │
│ [IG ✓] [FB ✓] [LI]      │                                      │
│                          │ Créditos estimados: 58               │
│ [✨ Diseñar campaña]     │ [✅ Generar campaña]                 │
└──────────────────────────┴──────────────────────────────────────┘
```

---

## 10. Navegación dentro de PixelTEC OS

### Estructura de navegación propuesta

```
TRABAJO
  🌅  Hoy
  ✅  Tareas
  👥  Clientes
  📁  Proyectos
  📔  Bitácora

FINANZAS
  💰  Cobros
  📄  Documentos

CRECIMIENTO                ← NUEVA SECCIÓN
  🧠  Brand Brain          ← El activo central. Primera entrada.
  📢  Content Studio       ← Generador de posts individuales
  📅  Campañas             ← Motor de campañas (el producto principal)
  📊  Analytics            ← (Fase 3 — aparece cuando hay datos)

PRODUCCIÓN
  🔑  Conocimiento
  🖥  Infraestructura
  📝  Blog

SISTEMA
  ⚙   Configuración
  👤  Perfil
```

### Justificación de la estructura

- **CRECIMIENTO** como sección separada hace que el módulo sea una herramienta estratégica, no un feature escondido en configuración.
- **Brand Brain** va primero porque es el prerequisito de todo lo demás.
- **Campañas** va después de Content Studio pero antes de Analytics — es el flujo natural de uso.
- **Analytics** aparece en el nav cuando la organización tiene posts publicados. Antes, el nav item no existe.

### Rutas

```
/crecimiento                          ← Hub / dashboard
/crecimiento/marca                    ← Brand Brain (lista de marcas)
/crecimiento/marca/nueva              ← Wizard de nueva marca
/crecimiento/marca/[brandId]          ← Vista/edición de Brand Brain
/crecimiento/contenido                ← Content Studio (generador)
/crecimiento/contenido/nuevo          ← Generador rápido de post
/crecimiento/campanas                 ← Lista de campañas
/crecimiento/campanas/nueva           ← Campaign Creator
/crecimiento/campanas/[id]            ← Vista de campaña con grid de posts
/crecimiento/calendario               ← Content Calendar
/crecimiento/assets                   ← Asset Manager
/crecimiento/cuentas                  ← Cuentas sociales conectadas
/crecimiento/analytics                ← Analytics (Fase 3)
```

---

## 11. Roadmap por Sprints

### Sprint 0 — Arquitectura Base (1 semana)

**Objetivo:** Codebase preparado. Sin UI visible todavía.

- Tipos TypeScript de todas las entidades (BrandBrain, Campaign, ContentPost, etc.)
- Sistema de créditos: colección Firestore + Cloud Function de validación atómica
- Abstracciones `AITextProvider` y `AIImageProvider` con implementaciones para GPT-4o y Flux
- Firebase Storage paths por orgId: `/{orgId}/brands/`, `/{orgId}/posts/`, `/{orgId}/templates/`
- Variables de entorno: `OPENAI_API_KEY`, `FAL_AI_KEY`, `IDEOGRAM_API_KEY`
- Estructura de colecciones en Firestore (dev y prod)
- Iniciar App Review de Meta (proceso paralelo, tarda 30-60 días)

**Deliverable:** Infraestructura lista. Ninguna UI. Tipos compilando. Tests de unidad para el sistema de créditos.

### Sprint 1 — Brand Brain (2 semanas)

**Objetivo:** El usuario puede configurar completamente la memoria de marca.

- Sección CRECIMIENTO en el nav de PixelTEC OS
- Ruta `/crecimiento/marca` — lista de marcas de la organización
- Wizard de Brand Brain en 5 pasos (identidad, servicios, ICP, voz, visual)
- Autocompletado de campos por industria (suggestions de GPT-4o-mini)
- Score de completitud 0-100%
- Upload de logo a Firebase Storage
- Selector de colores (color picker)
- CRUD completo de BrandBrain en Firestore
- Al menos 1 BrandBrain antes de poder generar contenido

**Deliverable:** Un usuario puede crear y editar su Brand Brain completo.

### Sprint 2 — Content Studio + AI Engine (2.5 semanas)

**Objetivo:** El primer post generado. El "aha moment" del producto.

- Ruta `/crecimiento/contenido/nuevo` — generador de post individual
- Template Library: 8 plantillas prediseñadas (4 Instagram Post, 2 Story, 2 Facebook)
- AI Text Engine: headline + body + CTA + hashtags desde Brand Brain + idea del usuario
- AI Image Engine: integración Flux Pro (Fal.ai) + Ideogram v2
- Compositor: Fabric.js renderiza template + texto generado + imagen = post
- Generación de 3 variantes automáticas
- Export a PNG (botón Descargar)
- Loading states descriptivos: "Generando headline... ✓ Generando imagen... (6s)"
- Consumo y registro de créditos

**Deliverable:** Usuario escribe idea → selecciona plantilla → obtiene 3 variantes de post en PNG.

### Sprint 3 — Campaign Engine (2 semanas)

**Objetivo:** El usuario piensa en objetivos, no en posts.

- Ruta `/crecimiento/campanas/nueva` — Campaign Creator
- GPT-4o genera la estrategia de campaña desde el objetivo
- Vista de estrategia propuesta con formatos y key messages
- Generación en lote de 10-15 posts (async con Cloud Functions)
- Progreso en tiempo real via SSE: "Generando post 4/10..."
- Vista de campaña con grid de posts y filtros por estado
- Aprobación/rechazo de posts individuales
- Descarga de todos los posts aprobados en ZIP

**Deliverable:** Usuario escribe objetivo → IA diseña campaña → genera 10-15 posts → usuario descarga todo.

### Sprint 4 — Content Calendar (1.5 semanas)

**Objetivo:** El usuario organiza cuándo publica.

- Ruta `/crecimiento/calendario` — vista semanal/mensual
- Posts arrastrables (drag & drop) entre días
- Programación de fecha y hora por post
- Vista de densidad de publicación (cuántos posts/día)
- Borradores pendientes de aprobación destacados
- Filtros por marca y plataforma

**Deliverable:** El usuario tiene un calendario de contenido visual y puede programar fechas.

### Sprint 5 — Social Publisher v1 (3 semanas)

**Objetivo:** Publicación directa a Facebook e Instagram.

- OAuth flow completo con Meta Graph API
- Almacenamiento seguro de tokens (encriptados en Firestore, desencriptados en Cloud Function)
- Cloud Function: publicación directa con Meta API
- Cloud Scheduler: publicar a la fecha/hora programada
- Estados de publicación en tiempo real
- Manejo de errores y reintentos automáticos (hasta 3 intentos)
- UI de cuentas conectadas en `/crecimiento/cuentas`

**Nota:** Solo posible 30-60 días después de iniciar App Review (Sprint 0). Si la aprobación no llega, este sprint se retrasa. El resto del producto no está bloqueado.

**Deliverable:** El usuario puede publicar a Instagram y Facebook directamente desde PixelTEC OS.

### Sprint 6 — LinkedIn + Refinamiento (2 semanas)

- OAuth con LinkedIn (perfil personal en primera versión)
- Refinamiento de UX basado en feedback real de Sprints 1-5
- Plantillas adicionales basadas en las más usadas
- Mejoras al Brand Brain según feedback

### Sprint 7 — Multi-tenancy real + Billing (2.5 semanas)

- Separación Organization → Members (roles: owner, editor, viewer)
- Invitación de miembros por email
- Billing con Stripe: planes Starter/Pro/Agency
- Página de precios y comparación de planes
- Compra de créditos adicionales
- Dashboard de uso de créditos

**Deliverable:** El módulo está listo para venderse como SaaS.

---

## 12. MVP Realista

### Alcance: Sprints 1-3

El MVP es un **Campaign Engine para Instagram y Facebook con Brand Brain integrado** que:

1. Configura el Brand Brain de la empresa (wizard guiado, ≤10 minutos)
2. Acepta un objetivo de negocio
3. Genera la estrategia de campaña
4. Produce 10-15 posts (headline + body + CTA + imagen)
5. Permite editar y aprobar posts individuales
6. Exporta todos los posts aprobados en PNG

**Lo que el MVP NO tiene:**
- Publicación directa a redes sociales
- Content Calendar
- LinkedIn, X/Twitter
- Multi-usuario
- Billing automático (uso interno gratis)
- Analytics
- Editor de plantillas

### KPIs del MVP

- Tiempo hasta primera campaña generada: < 15 minutos desde setup inicial
- Tasa de aprobación de posts: > 60% sin edición del usuario (proxy de calidad)
- NPS después de primera campaña: > 7/10
- Créditos consumidos por campaña: ≤ 60 (controlable)

---

## 13. Fase SaaS

### Modelo de pricing actualizado (pensando en agencias)

```
Plan Starter    — $29/mes (para 1 empresa final)
  • 200 créditos/mes (~3 campañas pequeñas)
  • 1 marca / Brand Brain
  • 8 plantillas del sistema
  • Export PNG
  • Sin publicación directa

Plan Pro        — $79/mes (para agencias pequeñas)
  • 600 créditos/mes (~10 campañas)
  • 5 marcas / Brand Brains
  • Todas las plantillas
  • Publicación Facebook + Instagram
  • Content Calendar
  • 2 usuarios

Plan Agency     — $199/mes (para agencias medianas)
  • 2,000 créditos/mes (~33 campañas)
  • Marcas ilimitadas
  • LinkedIn incluido
  • Campañas en lote
  • 10 usuarios
  • White-label (logo propio) — fase posterior

Add-on Créditos — $19 por 300 créditos adicionales
```

### Estrategia de lanzamiento

1. **Fase interna (Sprints 1-3):** Usar para clientes de PixelTEC, iterar basado en uso real
2. **Beta privada (Sprint 4-5):** 5-10 agencias digitales de LATAM, $0, feedback intensivo
3. **Launch comercial (Sprint 6-7):** Stripe billing, landing page, campaña propia con el mismo producto
4. **Expansión:** Dominio propio `growth.pixeltec.mx`, onboarding autónomo, soporte 24h

### Diferenciador de venta para agencias

> "Cada cliente de tu agencia tiene su propio Brand Brain. Nunca más mezcles el tono del dentista con el del abogado. Genera campañas completas en 5 minutos por cliente, en su voz, con su marca, listos para publicar."

---

## 14. Costos Estimados de IA

### Por operación

| Operación | Modelo | Costo Real USD |
|-----------|--------|---------------|
| Estrategia de campaña | GPT-4o (~3K tokens) | $0.03 |
| Copy de post (headline+body+CTA+hashtags) | GPT-4o (~1.5K tokens) | $0.015 |
| Imagen con Flux Pro | Fal.ai | $0.05-0.08 |
| Imagen con Ideogram | Ideogram v2 | $0.08 |
| Variante de copy | GPT-4o-mini | $0.001 |

### Por post completo

```
Copy:     $0.015
Imagen:   $0.065 (promedio)
─────────────────
Por post: ~$0.08
```

### Por campaña de 10 posts

```
Estrategia:   $0.03
Copy x10:     $0.15
Imágenes x10: $0.65
─────────────────────
Por campaña:  ~$0.83
```

### Margen operativo con créditos

```
Ratio: 1 crédito = $0.05 de costo real
Precio al usuario: 1 crédito tiene un valor percibido de $0.10

Operación         Créditos  Costo Real  Precio implícito  Margen
─────────────────────────────────────────────────────────────────
Estrategia            3       $0.03         $0.30          10x
Post completo         8       $0.08         $0.80          10x
Campaña 10 posts     80       $0.83         $8.00          9.6x

Plan Starter (200 créditos, $29/mes):
  → Costo IA real estimado: ~$2.50/mes
  → Margen bruto: ~$26.50/mes (91%)

Plan Agency (2,000 créditos, $199/mes):
  → Costo IA real estimado: ~$25/mes
  → Margen bruto: ~$174/mes (87%)
```

---

## 15. Sistema de Créditos

### Costos en créditos por operación

```typescript
const CREDIT_COSTS = {
  campaign_strategy:  3,   // GPT-4o genera la estrategia de campaña
  post_text:          2,   // copy completo de un post
  post_image:         6,   // imagen con Flux Pro o Ideogram
  post_variant:       5,   // variante completa (texto + imagen)
  campaign_post:      8,   // post en campaña (strategy ya pagada aparte)
  brand_suggest:      1,   // sugerencias de GPT-4o-mini en Brand Brain wizard
} as const;
```

### Flujo de validación (Cloud Function — nunca en cliente)

```
1. Cliente solicita generación → payload: { orgId, brandId, operation, ... }
2. Cloud Function: lee credits/summary con transacción
3. Si balance < costo → 402 Payment Required { remaining, needed }
4. Si balance >= costo → FieldValue.increment(-costo) → inicia generación
5. Si generación exitosa → escribe en credits/ledger { amount: -costo, balance: nuevo }
6. Si generación falla → FieldValue.increment(+costo) → devuelve créditos
```

### Hard limits adicionales

- Máx. 30 generaciones/hora por organización (evita abusos en picos)
- Máx. costo IA real de $30/mes por organización en plan Starter (bloqueo antes de facturación sorpresiva)
- Créditos de plan mensual no acumulan entre meses (evitan deuda técnica)
- Créditos de compra adicional vencen a 12 meses

---

## 16. Seguridad

### Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // Helpers
    function isOrgMember(orgId) {
      return request.auth != null &&
        request.auth.uid in get(/databases/$(db)/documents/organizations/$(orgId)).data.memberIds;
    }
    function isOrgOwner(orgId) {
      return request.auth != null &&
        request.auth.uid == get(/databases/$(db)/documents/organizations/$(orgId)).data.ownerId;
    }

    // Organización
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow update: if isOrgOwner(orgId);
      allow create: if request.auth != null;

      // Todo bajo la organización requiere ser miembro
      match /{collection}/{docId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgMember(orgId);
      }

      // Créditos: solo lectura para miembros. Escritura solo desde Cloud Functions.
      match /credits/summary {
        allow read: if isOrgMember(orgId);
        allow write: if false; // Cloud Functions only
      }
      match /credits/ledger/{entry} {
        allow read: if isOrgMember(orgId);
        allow write: if false; // Cloud Functions only
      }
    }

    // Plantillas globales: solo lectura
    match /global_templates/{templateId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Jobs de generación: solo la Cloud Function escribe
    match /generation_jobs/{jobId} {
      allow read: if request.auth != null
        && resource.data.orgId in request.auth.token.orgs; // custom claim
      allow write: if false;
    }
  }
}
```

### Access tokens de redes sociales

- Los tokens se encriptan con AES-256-GCM antes de escribir en Firestore
- La clave de encriptación vive en Google Cloud Secret Manager
- Solo las Cloud Functions tienen acceso a Secret Manager
- Rotación de tokens: las Cloud Functions verifican expiración y renuevan automáticamente

### Seguridad de API keys de IA

- Nunca en variables de entorno del cliente (`NEXT_PUBLIC_*`)
- Solo en variables de entorno de Cloud Functions
- Rotación cada 90 días
- Alertas si el gasto diario supera umbral

---

## 17. Multi-Tenancy

### Fase 1 (MVP) — `orgId = userId`

Cada usuario autenticado ES su organización. El campo `orgId` es igual al `userId` de Firebase Auth. El código está listo para multi-tenant pero la UI no expone gestión de miembros todavía.

```typescript
// En Sprint 0-4, la organización se crea automáticamente al primer login
// en la sección de crecimiento
async function getOrCreateOrganization(userId: string): Promise<Organization> {
  const orgRef = doc(db, "organizations", userId);
  const snap = await getDoc(orgRef);
  if (!snap.exists()) {
    await setDoc(orgRef, {
      id: userId, name: "", ownerId: userId, memberIds: [userId],
      plan: "free", credits: 50, // 50 créditos de bienvenida
      createdAt: serverTimestamp()
    });
  }
  return (await getDoc(orgRef)).data() as Organization;
}
```

### Fase 2 (SaaS) — Organizations reales

```
organizations/{orgId}/
  ownerId: string
  memberIds: string[]   ← array de UIDs
  
organizations/{orgId}/members/{userId}
  role: "owner" | "editor" | "viewer"
  joinedAt: Timestamp
  invitedBy: string
```

**Regla:** Nunca hardcodear `userId` como `orgId` en rutas hardcodeadas. Siempre resolver `orgId` desde el contexto de usuario. Esto hace la migración de Fase 1 a Fase 2 trivial.

### Aislamiento de datos entre tenants

- Firestore: las Security Rules garantizan que cada organización solo lee sus datos
- Firebase Storage: paths siempre bajo `/{orgId}/...`
- Cloud Functions: siempre verifican que el `orgId` del token coincide con el del payload
- Las plantillas globales (`global_templates/`) son de solo lectura para todos

---

## 18. Escalabilidad

### Firestore

- **`credits/summary`:** Usar `FieldValue.increment()` siempre. Nunca read-modify-write.
- **Posts de campaña:** No guardar array de postIds ilimitado. Query por `campaignId`.
- **Índices:** Crearlos antes del launch. Los queries sin índice fallan en producción.
- **Listeners en tiempo real:** Solo para generation_jobs (progreso). No para posts o campañas. Usar SWR con polling para listas.

### Firebase Cloud Functions

```
generation_jobs trigger:
  memory: '1GiB'          ← imagen response puede ser grande
  timeoutSeconds: 300     ← imagen puede tardar 30s + procesamiento
  maxInstances: 10        ← controlar concurrencia
  minInstances: 1         ← evitar cold start en horarios peak
```

### Firebase Storage + CDN

- Comprimir todas las imágenes exportadas a ≤2MB
- Cloudflare CDN frente a Firebase Storage (reduce egress 60-80%)
- Paths organizados: `/{orgId}/posts/{year}/{month}/{postId}.jpg`
- Limpieza automática: posts rechazados se borran de Storage a los 30 días

### Analytics preparada (Fase 3)

La colección para métricas no existe en el MVP. Cuando llegue Fase 3:

```
analytics_snapshots/{orgId}/posts/{postId}/{snapshotDate}
  ← Actualizado por cron job diario, no en tiempo real
  ← 90 días en Firestore, luego archivado en BigQuery
```

---

## 19. Qué Construir Primero

**Orden estricto e inamovible:**

1. **Sprint 0 — Tipos + Arquitectura base:** El contrato entre todos los módulos. Si los tipos están bien, todo lo demás se construye sin reescribir.

2. **Sprint 1 — Brand Brain:** Sin Brand Brain, la IA genera contenido genérico. Es el prerequisito de todo. También es el primer diferenciador que el usuario experimenta.

3. **Sprint 2 — Content Studio + AI Engine:** El primer post generado es el "aha moment". Validar que la calidad del copy y la imagen es suficiente para que el usuario quiera usarlo.

4. **Sprint 3 — Campaign Engine:** Cuando Content Studio está validado, escalar al caso de uso que genera más valor: campañas completas desde un objetivo. Este es el producto real.

5. **Sprint 4 — Calendar:** Organización de lo que ya se generó. Bajo riesgo técnico, alto valor percibido.

6. **Sprint 5 — Publisher:** Depende de App Review de Meta. Si está aprobado, construir. Si no, postergar y entregar valor sin publicación directa (descarga PNG sigue siendo útil).

**Acción paralela que empieza en Sprint 0:** Iniciar proceso de App Review de Meta. Esto no bloquea nada del roadmap pero define cuándo puede llegar Sprint 5.

---

## 20. Qué NO Construir Todavía

### ❌ Editor visual de plantillas (tipo Figma/Canva)
3-6 meses. El MVP usa JSON prediseñados. Priorizar cuando haya usuarios que lo pidan explícitamente.

### ❌ X/Twitter Publisher
API cuesta $100/mes Basic. No viable hasta revenue propio. LATAM tiene menor penetración de X para empresas de servicios.

### ❌ Analytics y métricas de engagement
Requiere webhooks de APIs de redes sociales + procesamiento + visualización. Nada de esto es MVP.

### ❌ LoRA / Fine-tuning por marca
Posible técnicamente (Replicate), pero costoso ($1-5 por training) y requiere dataset de imágenes. El template system da el 80% de la consistencia visual sin fine-tuning.

### ❌ Video generado por IA
Runway, Pika, Sora son costosos (10-50x imagen) y la calidad para marca todavía es inconsistente. Fase 4 como mínimo.

### ❌ Integración Canva/Figma plugin
Complejo, requiere certificación, y compite con el template system propio. Si el template system es bueno, no es necesario.

### ❌ AI que "aprende" de las publicaciones pasadas (feedback loop automático)
Requiere infraestructura de ML, fine-tuning, y datos suficientes. Mínimo 6 meses después del launch.

### ❌ Sistema de colaboración en tiempo real (multi-cursor)
El caso de uso principal es 1-3 personas por campaña. Los conflictos son raros. Last-write-wins es suficiente por ahora.

### ❌ White-label antes del Sprint 7
Requiere que el sistema de billing y multi-tenant esté sólido. Sin eso, el white-label es complejidad sin ROI.

---

## Resumen Ejecutivo

**Qué construimos:** PixelTEC Growth Suite — Motor de Campañas IA para Empresas de Servicios. No un generador de posts. Un sistema que conoce el negocio, genera estrategias de marketing, y produce campañas completas en minutos.

**Por qué gana:** El Brand Brain es el moat. Ningún competidor tiene esto. Las imágenes son commodity; el conocimiento del negocio y la consistencia de marca son el valor diferencial.

**Para quién:** Agencias digitales LATAM que manejan 5-20 clientes de servicios. Un solo cliente de agencia justifica el Plan Pro.

**MVP en 5-6 semanas:** Brand Brain + Content Studio + Campaign Engine + Calendar.

**Path a SaaS:** Sprint 7 — billing Stripe, multi-usuario, launch comercial.

**Costo de IA por campaña:** ~$0.83. Precio al cliente: ~$8.00 (en créditos). Margen bruto: 90%.

**Una decisión que cambia todo:** Construir el Brand Brain primero. No el generador de imágenes. No el calendario. El Brand Brain.
