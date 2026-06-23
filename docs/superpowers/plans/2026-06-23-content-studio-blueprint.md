# PixelTEC Growth Suite — Blueprint Técnico

> **Tipo:** Documento de arquitectura técnica.
> **Fuente:** `2026-06-23-content-studio.md` (visión de producto congelada).
> **Estado:** Pre-implementación. Este documento precede a cualquier línea de código.
> **Restricción:** No genera código. No crea archivos. Solo define la arquitectura.

---

## AMENDMENTS — Correcciones post-revisión (2026-06-23)

Las siguientes correcciones aplican sobre todo el documento y tienen precedencia sobre el texto original donde haya conflicto.

### A1 — Firestore: colecciones top-level con campo `uid` (no jerarquía `organizations/`)

**Antes:** `organizations/{orgId}/brands/{brandId}` — jerarquía multi-tenant nueva.  
**Después:** Colecciones top-level con campo `uid: string` (Firebase Auth UID del propietario), siguiendo el patrón de `blogPosts`, `proposals`, `contracts` ya existente en el proyecto.

```
growthBrands/{brandId}      ← uid: string
growthPosts/{postId}        ← uid: string
growthCampaigns/{id}        ← uid: string
growthCredits/{uid}         ← documento único por usuario
growthAssets/{assetId}      ← uid: string
growthJobs/{jobId}          ← uid: string
growthTemplates/{id}        ← uid: string | "global"
```

No existe el documento `Organization` en el MVP. `uid` del usuario = tenant. Para agregar multi-usuario en v2: añadir campo `orgId` y migrar Security Rules — sin restructurar colecciones.

Security Rule simplificada (igual que el resto del proyecto):
```
allow read, write: if resource.data.uid == request.auth.uid;
```

### A2 — Acceso a datos: Server Actions + SWR (no client SDK directo para mutaciones)

**Antes:** Hooks con `onSnapshot` / client SDK para writes.  
**Después:** Writes vía Server Actions en `src/lib/growth/actions/` (patrón blog). Reads vía SWR hooks. Único caso de `onSnapshot`: listener al documento del `GenerationJob` activo (para progreso en tiempo real).

### A3 — Entidad `Organization` eliminada del MVP

No se crea el documento ni los tipos de `Organization`. El `uid` es el identificador suficiente. El campo `orgId` en los tipos se reemplaza por `uid`.

### A4 — Layout del módulo: no hay layout secundario propio

Growth Suite usa `(admin)/layout.tsx` directamente. No se crea `crecimiento/layout.tsx` con sidebar propio. El layout del hub (`crecimiento/page.tsx`) puede agregar un header interno, pero no hay layout de segundo nivel.

### A5 — Fabric.js reemplazado por Sharp.js + SVG en MVP

Para la composición de canvas en Cloud Functions (Node.js sin browser), se usa Sharp.js + templates SVG. El campo `canvasJsonUrl` se reemplaza por `svgTemplateUrl` en los tipos `Template` y `ContentPost`. La API de zonas (`TemplateZone`) no cambia. El editor visual Fabric.js de v2 puede leer el mismo JSON de zonas.

### A6 — Créditos de variantes corregidos

`post_variant: 5` eliminado. Reemplazado por:
- `post_variant_text_only: 2` — solo regenerar texto
- `post_variant_image_only: 6` — solo regenerar imagen  
- `post_variant_both: 8` — texto + imagen (igual que post_complete)

### A7 — Componentes UI: reutilizar primitivos existentes

Todos los componentes de Growth Suite consumen `Button`, `Skeleton`, `Sheet`, `Dialog`, `Input` de `@/components/ui/`. Mismo className pattern del VPS dashboard: `rounded-2xl border border-zinc-800/50 bg-zinc-900/40 backdrop-blur-xl`.

---

## 1. Arquitectura Física

### Principio de organización

El módulo Growth Suite vive completamente dentro de PixelTEC OS. No es un subproyecto separado. Sigue exactamente los mismos patrones del CRM existente: rutas dentro de `(admin)`, componentes en `src/components/`, lógica de datos en `src/lib/`, tipos en `src/types/`.

La diferencia es que todo lo que pertenece a Growth Suite vive bajo un namespace propio (`growth/`) dentro de cada carpeta, para no contaminar los módulos existentes y para que pueda extraerse como producto independiente en el futuro sin reestructurar.

### Árbol de carpetas completo

```
src/
│
├── app/
│   └── (admin)/
│       └── crecimiento/                          ← raíz del módulo
│           ├── layout.tsx                         ← layout con sidebar secundario del módulo
│           ├── page.tsx                           ← hub / dashboard principal
│           │
│           ├── brand-brain/
│           │   ├── page.tsx                       ← lista de Brand Brains de la org
│           │   ├── nuevo/
│           │   │   └── page.tsx                   ← wizard de nueva marca (5 pasos)
│           │   └── [brandId]/
│           │       ├── page.tsx                   ← vista detalle del Brand Brain
│           │       └── editar/
│           │           └── page.tsx               ← edición de Brand Brain existente
│           │
│           ├── contenido/
│           │   ├── page.tsx                       ← Content Studio hub (posts recientes)
│           │   ├── nuevo/
│           │   │   └── page.tsx                   ← generador rápido de post individual
│           │   └── [postId]/
│           │       └── page.tsx                   ← vista / edición de post individual
│           │
│           ├── campanas/
│           │   ├── page.tsx                       ← lista de campañas
│           │   ├── nueva/
│           │   │   └── page.tsx                   ← Campaign Creator (objective → strategy → generate)
│           │   └── [campaignId]/
│           │       ├── page.tsx                   ← vista de campaña con grid de posts
│           │       └── post/
│           │           └── [postId]/
│           │               └── page.tsx           ← vista de post dentro de campaña
│           │
│           ├── calendario/
│           │   └── page.tsx                       ← Content Calendar (semana / mes)
│           │
│           ├── assets/
│           │   └── page.tsx                       ← Asset Manager (biblioteca)
│           │
│           └── cuentas/
│               └── page.tsx                       ← cuentas sociales conectadas (v2)
│
├── components/
│   └── growth/                                    ← todos los componentes del módulo
│       │
│       ├── brand-brain/
│       │   ├── BrandBrainCard.tsx                 ← card de marca en la lista
│       │   ├── BrandBrainScore.tsx                ← indicador de completitud 0-100%
│       │   ├── BrandBrainEmptyState.tsx           ← estado vacío con CTA al wizard
│       │   └── wizard/
│       │       ├── BrandBrainWizard.tsx           ← componente contenedor del wizard
│       │       ├── WizardProgress.tsx             ← barra de progreso de pasos
│       │       ├── steps/
│       │       │   ├── Step1Business.tsx          ← industria, nombre, ubicación
│       │       │   ├── Step2Services.tsx          ← servicios con pain/benefit
│       │       │   ├── Step3ICP.tsx               ← cliente ideal y objeciones
│       │       │   ├── Step4Voice.tsx             ← tono, personalidad, ejemplos
│       │       │   └── Step5Visual.tsx            ← logo, colores, tipografía
│       │       └── ServiceEditor.tsx              ← editor inline de un servicio
│       │
│       ├── content-studio/
│       │   ├── PostGenerator.tsx                  ← UI principal del generador
│       │   ├── IdeaInput.tsx                      ← textarea de la idea del usuario
│       │   ├── TemplateGrid.tsx                   ← grid de selección de plantillas
│       │   ├── TemplateCard.tsx                   ← card de plantilla con preview
│       │   ├── PostPreview.tsx                    ← preview del post en canvas
│       │   ├── VariantSlider.tsx                  ← navegación entre variantes (◀ ● ▶)
│       │   ├── GenerationProgress.tsx             ← "Generando copy... ✓ Generando imagen..."
│       │   ├── PostTextEditor.tsx                 ← edición inline de texto post-generación
│       │   └── PostActions.tsx                    ← Aprobar / Regenerar / Descargar
│       │
│       ├── campaigns/
│       │   ├── CampaignCreatorForm.tsx            ← formulario objetivo + marca + plataformas
│       │   ├── CampaignStrategyPreview.tsx        ← previsualización de estrategia IA
│       │   ├── CampaignGenerationProgress.tsx     ← progreso batch "Post 4 de 10..."
│       │   ├── CampaignCard.tsx                   ← card en la lista de campañas
│       │   ├── CampaignPostGrid.tsx               ← grid de posts dentro de campaña
│       │   ├── CampaignPostCard.tsx               ← card de post individual con acciones
│       │   └── CampaignExportButton.tsx           ← descargar todos los aprobados en ZIP
│       │
│       ├── calendar/
│       │   ├── ContentCalendar.tsx                ← contenedor principal
│       │   ├── CalendarWeekView.tsx               ← vista semanal (7 columnas)
│       │   ├── CalendarMonthView.tsx              ← vista mensual (grid)
│       │   ├── CalendarPostDot.tsx                ← indicador de post en celda de día
│       │   ├── CalendarPostModal.tsx              ← modal al hacer click en un post
│       │   └── CalendarToolbar.tsx                ← navegación de fecha + toggle semana/mes
│       │
│       ├── assets/
│       │   ├── AssetGrid.tsx                      ← grid de assets con filtros
│       │   ├── AssetCard.tsx                      ← card de asset individual
│       │   ├── AssetUpload.tsx                    ← zona de drag & drop para subir
│       │   └── AssetFilters.tsx                   ← filtros por tipo, marca, fecha
│       │
│       └── shared/
│           ├── CreditBalance.tsx                  ← badge de créditos disponibles (header)
│           ├── CreditWarning.tsx                  ← alerta cuando quedan < 20% créditos
│           ├── PostStatusBadge.tsx                ← badge de estado del post
│           ├── BrandSelector.tsx                  ← dropdown de selección de marca activa
│           ├── PlatformBadge.tsx                  ← IG / FB / LI / X icon + nombre
│           └── GrowthEmptyState.tsx               ← estado vacío genérico del módulo
│
├── lib/
│   └── growth/
│       │
│       ├── ai/
│       │   ├── orchestrator.ts                    ← coordinador del flujo completo idea→asset
│       │   ├── prompt-builder.ts                  ← construcción de prompts desde BrandBrain
│       │   ├── campaign-strategist.ts             ← GPT-4o genera CampaignStrategy
│       │   └── providers/
│       │       ├── types.ts                       ← interfaces AITextProvider, AIImageProvider
│       │       ├── openai-text.ts                 ← implementación GPT-4o para copy
│       │       ├── flux-image.ts                  ← implementación Flux Pro via Fal.ai
│       │       └── ideogram-image.ts              ← implementación Ideogram v2
│       │
│       ├── firestore/
│       │   ├── organizations.ts                   ← CRUD de Organization + inicialización
│       │   ├── brands.ts                          ← CRUD de BrandBrain
│       │   ├── campaigns.ts                       ← CRUD de Campaign
│       │   ├── posts.ts                           ← CRUD de ContentPost
│       │   ├── templates.ts                       ← lectura de plantillas (global + org)
│       │   ├── credits.ts                         ← lectura de balance y ledger
│       │   └── assets.ts                          ← CRUD de Asset metadata
│       │
│       ├── storage/
│       │   ├── paths.ts                           ← generador de paths de Storage por orgId
│       │   ├── brands.ts                          ← upload/delete de logos
│       │   ├── posts.ts                           ← upload de imágenes generadas y canvas JSON
│       │   ├── templates.ts                       ← lectura de canvas JSON de plantillas
│       │   └── assets.ts                          ← upload/download de assets de usuario
│       │
│       ├── credits/
│       │   ├── costs.ts                           ← constante CREDIT_COSTS (solo lectura)
│       │   └── validator.ts                       ← check de balance en cliente (UI only)
│       │
│       ├── canvas/
│       │   ├── compositor.ts                      ← Fabric.js: aplica contenido IA al canvas
│       │   ├── brand-variables.ts                 ← reemplaza {{brand.*}} en canvas JSON
│       │   └── exporter.ts                        ← renderiza canvas a PNG/JPEG
│       │
│       └── utils/
│           ├── brand-score.ts                     ← calcula completionScore del BrandBrain
│           └── format-helpers.ts                  ← helpers de formato (dimensiones, etc.)
│
├── hooks/
│   └── growth/
│       ├── use-organization.ts                    ← org del usuario actual (con init automático)
│       ├── use-brand-brain.ts                     ← lista de marcas + CRUD
│       ├── use-active-brand.ts                    ← marca seleccionada actualmente
│       ├── use-campaigns.ts                       ← lista de campañas + CRUD
│       ├── use-campaign.ts                        ← campaña individual + sus posts
│       ├── use-posts.ts                           ← lista de posts con filtros
│       ├── use-post.ts                            ← post individual + variantes
│       ├── use-templates.ts                       ← plantillas globales + de org
│       ├── use-credits.ts                         ← balance + ledger
│       ├── use-generation-job.ts                  ← SSE listener para jobs async
│       └── use-calendar-posts.ts                  ← posts por rango de fechas (para calendario)
│
└── types/
    └── growth/
        ├── organization.ts                        ← Organization
        ├── brand-brain.ts                         ← BrandBrain, BrandService, ICP, ObjectionResponse
        ├── template.ts                            ← Template, TemplateZone, TemplateFormat
        ├── post.ts                                ← ContentPost, PublishedPlatform
        ├── campaign.ts                            ← Campaign, CampaignStrategy, CampaignPostPlan
        ├── credits.ts                             ← CreditLedger, CreditSummary, CreditOperation
        ├── asset.ts                               ← Asset
        ├── ai.ts                                  ← AITextProvider, AIImageProvider, GenerationJob
        └── index.ts                               ← re-exports de todos los tipos del módulo


firebase-functions/                                ← proyecto separado de Cloud Functions
└── src/
    └── growth/
        ├── generate-post.ts                       ← Cloud Function: genera un post completo
        ├── generate-campaign.ts                   ← Cloud Function: genera campaña en lote
        ├── publish-post.ts                        ← Cloud Function: publica a red social (v2)
        ├── credit-deduct.ts                       ← Cloud Function: deduce créditos (transacción)
        ├── monthly-credit-reset.ts                ← Cloud Function cron: recarga créditos mensuales
        └── job-processor.ts                       ← Firestore trigger: procesa generation_jobs
```

---

## 2. Navegación

### Rutas exactas

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/crecimiento` | `page.tsx` | Hub: próximas publicaciones, campañas activas, borradores |
| `/crecimiento/brand-brain` | `page.tsx` | Lista de Brand Brains de la organización |
| `/crecimiento/brand-brain/nuevo` | `page.tsx` | Wizard 5 pasos (no permite salir sin completar) |
| `/crecimiento/brand-brain/[brandId]` | `page.tsx` | Vista detalle (read-only + botón Editar) |
| `/crecimiento/brand-brain/[brandId]/editar` | `page.tsx` | Edición de Brand Brain existente |
| `/crecimiento/contenido` | `page.tsx` | Posts recientes + botón "Nuevo post" |
| `/crecimiento/contenido/nuevo` | `page.tsx` | Generador: idea → plantilla → generar → variantes |
| `/crecimiento/contenido/[postId]` | `page.tsx` | Vista/edición de post individual |
| `/crecimiento/campanas` | `page.tsx` | Lista de campañas con estado y progreso |
| `/crecimiento/campanas/nueva` | `page.tsx` | Campaign Creator: objetivo → estrategia → generar |
| `/crecimiento/campanas/[campaignId]` | `page.tsx` | Vista: estrategia + grid de posts con filtros |
| `/crecimiento/campanas/[campaignId]/post/[postId]` | `page.tsx` | Post individual dentro de campaña |
| `/crecimiento/calendario` | `page.tsx` | Calendario semanal/mensual con drag & drop |
| `/crecimiento/assets` | `page.tsx` | Biblioteca de assets filtrada por tipo/marca |
| `/crecimiento/cuentas` | `page.tsx` | OAuth connections de redes sociales (v2) |

### Jerarquía de layouts

```
(admin)/layout.tsx
│  Shell principal: sidebar izquierdo con nav completo de PixelTEC OS
│  Header con: logo + notificaciones + perfil
│
└── crecimiento/layout.tsx
       Agrega: header del módulo con CreditBalance + BrandSelector
       Agrega: breadcrumb contextual
       No tiene sidebar secundario propio (la nav vive en el sidebar principal)
       La sección CRECIMIENTO del sidebar principal agrupa los links del módulo
```

### Breadcrumbs

```
Crecimiento
Crecimiento > Brand Brain
Crecimiento > Brand Brain > [Nombre de marca]
Crecimiento > Brand Brain > Nueva Marca
Crecimiento > Content Studio
Crecimiento > Content Studio > Nuevo Post
Crecimiento > Campañas
Crecimiento > Campañas > [Nombre de campaña]
Crecimiento > Campañas > Nueva Campaña
Crecimiento > Calendario
Crecimiento > Assets
```

### Navegación lateral (sección CRECIMIENTO en Shell)

```typescript
// Añadir a src/components/nav/command-palette-items.ts o equivalente:

const GROWTH_NAV_ITEMS = [
  {
    label: "Brand Brain",
    href: "/crecimiento/brand-brain",
    icon: "Brain",               // Lucide: Brain
    badge: null,                  // futuro: número de marcas configuradas
  },
  {
    label: "Content Studio",
    href: "/crecimiento/contenido",
    icon: "Sparkles",
    badge: null,
  },
  {
    label: "Campañas",
    href: "/crecimiento/campanas",
    icon: "Megaphone",
    badge: null,                  // futuro: campañas activas
  },
  {
    label: "Calendario",
    href: "/crecimiento/calendario",
    icon: "CalendarDays",
    badge: null,
  },
  {
    label: "Analytics",
    href: "/crecimiento/analytics",
    icon: "BarChart3",
    badge: "pronto",              // visible pero disabled hasta Fase 3
    disabled: true,
  },
];
```

### Guards de navegación

- **Brand Brain inexistente:** Si la organización no tiene ningún Brand Brain, `/crecimiento/contenido/nuevo` redirige a `/crecimiento/brand-brain/nuevo` con un banner explicativo.
- **Créditos agotados:** Si `credits.balance === 0`, el botón "Generar" está disabled con tooltip "Sin créditos. Recarga para continuar."
- **Brand Brain incompleto:** Puede generarse contenido con completionScore ≥ 60. Debajo de 60, el botón "Generar" muestra un warning pero no está bloqueado (UX: no bloquear, pero advertir).

---

## 3. Modelo de Datos

### 3.1 Organization

```typescript
interface Organization {
  id: string;                  // === Firebase Auth UID en Fase 1 (MVP)
  name: string;                // nombre de la agencia u organización
  ownerId: string;             // UID del creador — siempre tiene acceso
  memberIds: string[];         // UIDs de todos los miembros incluido owner
  plan: OrganizationPlan;
  createdAt: Timestamp;
}

type OrganizationPlan = "free" | "starter" | "pro" | "agency";

// Documento separado para evitar escrituras concurrentes en el doc principal:
interface OrganizationSettings {
  // Subcollection: organizations/{orgId}/settings/preferences
  defaultBrandId?: string;     // marca activa por defecto
  defaultLanguage: "es" | "en" | "pt";
  timezone: string;            // "America/Mexico_City"
  notificationsEnabled: boolean;
}
```

**Relaciones:** Una Organization tiene múltiples BrandBrains, Campaigns, ContentPosts, Assets.

**Tamaño esperado del documento Organization:** < 2KB. Nunca embeber datos de otras entidades aquí.

**Índices necesarios:** Ninguno adicional — el documento se lee por ID directo.

**Estrategia de crecimiento:** El modelo soporta multi-usuario (memberIds[]) desde el MVP aunque la UI de invitaciones se construye en Sprint 7. Sin migración de datos requerida para activar multi-usuario.

---

### 3.2 BrandBrain

```typescript
interface BrandBrain {
  id: string;
  orgId: string;
  name: string;                // "Clínica Dental Sur", "PixelTEC"

  identity: BrandIdentity;
  voice: BrandVoice;
  business: BrandBusiness;
  positioning: BrandPositioning;
  objections: ObjectionResponse[];  // max 10 — limitar en UI
  contentRules: ContentRules;

  // Calculado en cliente — NO persistir en Firestore
  // completionScore se recalcula cada vez que se lee el doc
  isComplete: boolean;         // true si completionScore >= 80
  completionScore: number;     // 0-100, calculado en lib/growth/utils/brand-score.ts

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface BrandIdentity {
  logoUrl?: string;            // Firebase Storage URL
  logoStoragePath?: string;    // path en Storage para poder borrar el archivo
  colors: {
    primary: string;           // hex "#1A2B3C" — obligatorio
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    heading: string;           // "Poppins" — nombre de Google Font
    body: string;              // "Inter"
  };
}

interface BrandVoice {
  personality: string[];       // ["profesional", "empático"] — max 5 tags
  avoid: string[];             // ["emojis excesivos"] — max 10 tags
  language: "es" | "en" | "pt";
  formality: "formal" | "semi_formal" | "casual";
  examplePosts: string[];      // 3-5 posts de ejemplo que el cliente aprueba
  forbiddenTopics: string[];   // ["precios de competidores", "política"]
}

interface BrandBusiness {
  industry: string;            // "Salud Dental" — de lista predefinida o libre
  subIndustry?: string;        // "Ortodoncia"
  location: string;            // "Guadalajara, México"
  yearsInBusiness?: number;
  teamSize?: string;           // "1-5 personas"
  services: BrandService[];    // min 1, max 10
  certifications: string[];    // ["ISO 9001"] — max 5
}

interface BrandService {
  id: string;                  // nanoid generado en cliente
  name: string;                // "Implantes dentales"
  description: string;         // ≤ 150 chars
  price?: string;              // "Desde $15,000 MXN"
  duration?: string;           // "1-3 sesiones"
  targetPain: string;          // dolor que resuelve — ≤ 100 chars
  benefit: string;             // beneficio principal — ≤ 100 chars
  isHighlight: boolean;        // ¿es el servicio estrella? max 1
}

interface BrandPositioning {
  valueProps: string[];        // max 5 — "Implantes con garantía de 10 años"
  differentiators: string[];   // max 5 — "Único laboratorio propio"
  competitorContext?: string;  // ≤ 200 chars — "A diferencia de X..."
  targetAudience: ICP;
  pricePosition: "economy" | "mid_range" | "premium" | "luxury";
}

interface ICP {
  ageRange?: string;           // "35-55 años"
  gender?: string;             // "Indistinto"
  income?: string;             // "Clase media-alta"
  location?: string;           // "Ciudad, zona norte"
  painPoints: string[];        // max 5
  goals: string[];             // max 5
  triggers: string[];          // max 5 — "Boda próxima", "Nuevo trabajo"
}

interface ObjectionResponse {
  id: string;
  objection: string;           // "Es muy caro" — ≤ 80 chars
  response: string;            // "Tenemos planes sin intereses" — ≤ 150 chars
  contentHook?: string;        // "Post: ¿Crees que X es caro? Lee esto" — ≤ 120 chars
}

interface ContentRules {
  preferredFormats: TemplateFormat[];    // formatos que usa esta marca
  postingFrequency?: string;             // "3 veces por semana"
  hashtagStrategy?: string;             // "10 hashtags mix local/general"
  callToActions: string[];              // ["Llama ahora", "Agenda gratis"] — max 5
  contentPillars: string[];            // ["Educativo", "Testimonios", "Servicios"] — max 5
}
```

**Tamaño esperado:** 8-15KB por Brand Brain completo. Bien dentro del límite de 1MB de Firestore.

**Índices necesarios:**
```
brands: [orgId ASC, createdAt DESC]
brands: [orgId ASC, isComplete ASC]
```

**Estrategia de crecimiento:** Una organización en plan Agency puede tener 20+ Brand Brains sin problema. El límite real es el plan (UI bloquea creación si se supera el límite del plan).

---

### 3.3 Template

```typescript
interface Template {
  id: string;
  orgId: string | "global";    // "global" = sistema. Solo admins pueden crear globales.
  name: string;
  description?: string;        // ≤ 200 chars

  format: TemplateFormat;
  dimensions: { width: number; height: number };  // px. Ej: 1080x1080

  // Almacenados en Storage — NO en este documento
  canvasJsonUrl: string;       // Storage URL del Fabric.js JSON completo
  thumbnailUrl: string;        // Storage URL preview 400x400

  // Zonas editables extraídas del canvas (para que la IA sepa qué llenar)
  zones: TemplateZone[];

  // Variables de marca que el compositor reemplazará en el canvas
  // Sintaxis de placeholders: {{brand.colors.primary}}
  brandVariables: TemplateBrandVariable[];

  category: TemplateCategory;
  industries: string[];        // [] = válido para todas. ["Salud"] = solo Salud.
  tags: string[];              // para búsqueda: ["moderno", "minimalista"]
  isActive: boolean;

  // Versionado del schema — crítico para no romper canvas existentes
  schemaVersion: number;       // empieza en 1, incrementar en cambios breaking

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type TemplateFormat =
  | "instagram_post"           // 1080×1080
  | "instagram_story"          // 1080×1920
  | "instagram_carousel_slide" // 1080×1080 (parte de carrusel)
  | "facebook_post"            // 1200×630
  | "linkedin_post"            // 1200×627
  | "twitter_post"             // 1600×900
  | "banner_web"               // 1200×400
  | "email_header";            // 600×200

type TemplateCategory =
  | "servicio"
  | "testimonio"
  | "educativo"
  | "promocion"
  | "historia"
  | "anuncio"
  | "fecha_especial"
  | "behind_scenes";

interface TemplateZone {
  id: string;          // identificador semántico: "headline", "body", "image_main", "cta", "logo"
  type: ZoneType;
  locked: boolean;     // si true, el compositor no toca esta zona
  aiRole: AIZoneRole;  // qué le pide la IA que genere para esta zona
  maxLength?: number;  // para zonas de tipo "text"
  required: boolean;   // si false, la zona puede quedar vacía
}

type ZoneType = "text" | "image" | "logo" | "background" | "accent" | "price" | "icon";

type AIZoneRole =
  | "headline"         // titular principal (≤60 chars)
  | "body"             // cuerpo del mensaje (≤150 chars)
  | "cta"              // call to action (≤30 chars)
  | "hashtags"         // string de hashtags
  | "price_label"      // etiqueta de precio (desde el servicio)
  | "image_prompt"     // la IA genera el prompt de imagen para esta zona
  | "brand_logo"       // logo de la marca (se toma de BrandBrain.identity.logoUrl)
  | "brand_color"      // color que se toma de BrandBrain.identity.colors.*
  | null;              // zona bloqueada sin rol IA

interface TemplateBrandVariable {
  placeholder: string;    // "{{brand.colors.primary}}"
  path: string;           // ruta al campo en BrandBrain: "identity.colors.primary"
  fallback: string;       // valor si no existe en el Brand Brain: "#000000"
}
```

**Tamaño esperado del documento Template:** < 5KB (sin el canvas JSON, que vive en Storage). El canvas JSON puede ser 50-200KB — siempre en Storage, nunca en Firestore.

**Índices necesarios:**
```
global_templates: [format ASC, category ASC, isActive ASC]
global_templates: [industries ASC, format ASC, isActive ASC]
organizations/{orgId}/templates: [format ASC, category ASC]
```

---

### 3.4 ContentPost

```typescript
interface ContentPost {
  id: string;
  orgId: string;
  brandId: string;
  templateId: string;
  campaignId?: string;          // null si es post suelto de Content Studio

  status: PostStatus;
  format: TemplateFormat;

  // Contenido generado (texto)
  content: PostContent;

  // URLs de archivos en Storage (todos opcionales hasta que la generación complete)
  assets: PostAssets;

  // Metadatos de la generación IA
  generation: GenerationMetadata;

  // Programación para publicación
  scheduling: PostScheduling;

  // Relación con variantes
  variantGroupId?: string;      // todas las variantes del mismo post comparten este ID
  variantIndex?: number;        // 1, 2, 3 — la variante original es 1

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type PostStatus =
  | "generating"    // Cloud Function trabajando
  | "draft"         // generado, esperando revisión del usuario
  | "approved"      // aprobado por el usuario
  | "scheduled"     // aprobado + tiene scheduledAt
  | "published"     // publicado en al menos una red
  | "failed"        // generación falló
  | "rejected";     // el usuario lo rechazó explícitamente

interface PostContent {
  idea: string;              // idea original del usuario (preserved)
  headline: string;          // generado por GPT-4o
  body: string;              // generado por GPT-4o
  cta: string;               // generado por GPT-4o
  hashtags: string[];        // generado por GPT-4o
  imagePrompt: string;       // prompt de imagen generado por GPT-4o (para debug + regeneración)

  // Versiones editadas por el usuario (si editó después de generar)
  editedHeadline?: string;
  editedBody?: string;
  editedCta?: string;
}

interface PostAssets {
  rawImageUrl?: string;      // Storage: imagen generada por Flux/Ideogram antes de compositar
  canvasJsonUrl?: string;    // Storage: Fabric.js JSON con el post compuesto
  finalImageUrl?: string;    // Storage: PNG/JPEG exportado final
  thumbnailUrl?: string;     // Storage: preview 300x300
}

interface GenerationMetadata {
  textModel: string;         // "gpt-4o"
  imageModel: string;        // "flux-pro" | "ideogram-v2"
  creditsUsed: number;
  generationJobId?: string;  // referencia al job en generation_jobs/
  brandSnapshot: {           // snapshot del BrandBrain al momento de generar
    // Guardamos un snapshot ligero — solo los campos usados en el prompt
    // para poder auditar y reproducir sin depender del estado actual del Brand Brain
    name: string;
    industry: string;
    voicePersonality: string[];
    services: Array<{ name: string; benefit: string; targetPain: string }>;
    valueProps: string[];
    differentiators: string[];
    callToActions: string[];
    colors: { primary: string; secondary: string };
  };
  generatedAt: Timestamp;
}

interface PostScheduling {
  scheduledAt?: Timestamp;
  publishedAt?: Timestamp;
  platforms: ScheduledPlatform[];
}

interface ScheduledPlatform {
  name: "instagram" | "facebook" | "linkedin" | "twitter";
  socialAccountId: string;
  status: "pending" | "published" | "failed" | "cancelled";
  publishedUrl?: string;
  error?: string;
  attemptedAt?: Timestamp;
}
```

**Tamaño esperado:** 3-8KB por post (sin imágenes — esas van en Storage). El `brandSnapshot` es lo más grande (~2KB).

**Índices necesarios:**
```
posts: [orgId ASC, brandId ASC, status ASC, createdAt DESC]
posts: [orgId ASC, campaignId ASC, status ASC, createdAt DESC]
posts: [orgId ASC, scheduling.scheduledAt ASC]          ← para calendario
posts: [orgId ASC, variantGroupId ASC, variantIndex ASC] ← para agrupar variantes
posts: [orgId ASC, status ASC, updatedAt DESC]           ← para borradores
```

---

### 3.5 Campaign

```typescript
interface Campaign {
  id: string;
  orgId: string;
  brandId: string;
  name: string;                // generado o editado por el usuario

  // El usuario piensa en objetivos
  objective: string;           // "Conseguir pacientes para implantes dentales"
  targetAction: string;        // "Agendar consulta gratuita"
  targetPlatforms: Array<"instagram" | "facebook" | "linkedin" | "twitter">;

  status: CampaignStatus;

  // La IA genera esta estrategia antes de crear los posts
  strategy?: CampaignStrategy;

  // Contadores (para mostrar progreso sin queries adicionales)
  counters: {
    totalPosts: number;
    generatedPosts: number;
    approvedPosts: number;
    publishedPosts: number;
  };

  dateRange?: {
    startDate: Timestamp;
    endDate: Timestamp;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

type CampaignStatus =
  | "planning"            // recién creada, sin estrategia
  | "strategy_ready"      // GPT-4o generó la estrategia, usuario aún no aprueba
  | "generating"          // posts siendo generados en lote
  | "review"              // todos los posts generados, esperando aprobación
  | "active"              // algunos posts aprobados y/o publicados
  | "completed"           // todos los posts publicados
  | "archived";           // archivada manualmente

interface CampaignStrategy {
  // Generada por GPT-4o en lib/growth/ai/campaign-strategist.ts
  campaignName: string;          // nombre sugerido: "Implantes para siempre"
  angle: string;                 // "Miedo a perder oportunidad + solución accesible"
  targetedPain: string;          // pain del ICP que ataca esta campaña
  keyMessage: string;            // mensaje central de toda la campaña (≤150 chars)
  postPlans: CampaignPostPlan[];
  estimatedCredits: number;      // suma de créditos de todos los posts planificados
  generatedAt: Timestamp;
}

interface CampaignPostPlan {
  planId: string;                // id temporal para tracking durante generación
  format: TemplateFormat;
  templateId: string;            // plantilla seleccionada por la IA (o el sistema)
  purpose: CampaignPostPurpose;
  keyMessage: string;            // mensaje específico de este post
  postId?: string;               // se asigna cuando el post es creado
  status: "pending" | "generating" | "done" | "failed";
}

type CampaignPostPurpose =
  | "awareness"           // post de conocimiento de marca
  | "consideration"       // post educativo / de propuesta de valor
  | "conversion"          // post de conversión directa con CTA fuerte
  | "social_proof"        // testimonio o caso de éxito
  | "retention";          // para clientes existentes
```

**IMPORTANTE — Posts de campaña NO se guardan en el documento Campaign.**
Los posts viven en `organizations/{orgId}/posts/` con `campaignId` como campo de referencia. El campo `counters` en Campaign se actualiza con `FieldValue.increment()` cuando un post cambia de estado. Esto evita el problema del documento de campaña que crece sin límite.

**Índices necesarios:**
```
campaigns: [orgId ASC, status ASC, createdAt DESC]
campaigns: [orgId ASC, brandId ASC, status ASC]
```

---

### 3.6 GenerationJob

```typescript
// Colección top-level: generation_jobs/{jobId}
// No vive bajo organizations/ porque las Cloud Functions la escriben sin contexto de org en el trigger

interface GenerationJob {
  id: string;
  orgId: string;               // para Security Rules y queries
  type: "post" | "campaign" | "variant";
  referenceId: string;         // postId o campaignId

  status: JobStatus;
  progress: number;            // 0-100 (relevante para campañas)
  currentStep: string;         // "Generando copy..." | "Generando imagen 3/10..."
  totalSteps: number;          // para campañas: número de posts a generar

  creditsToUse: number;        // créditos reservados al inicio
  creditsUsed: number;         // créditos efectivamente consumidos

  error?: string;
  errorCode?: string;          // "INSUFFICIENT_CREDITS" | "AI_PROVIDER_ERROR" | etc.

  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
```

**Estrategia de cleanup:** Los jobs completados se borran automáticamente a los 7 días con una Cloud Function de limpieza (TTL manual). No usar Firebase TTL nativo para evitar costos de operaciones de borrado en picos.

---

## 4. Firestore — Qué Va Dónde

### ✅ Lo que vive en Firestore (metadatos y datos estructurados pequeños)

```
Organization                   → documento < 2KB
BrandBrain                     → documento < 15KB
Template (metadatos + zones)   → documento < 5KB (sin canvasJson)
ContentPost (metadatos)        → documento < 8KB (sin imágenes)
Campaign                       → documento < 5KB (sin posts embebidos)
CampaignStrategy               → embebido en Campaign (< 3KB adicionales)
SocialAccount                  → documento < 2KB (token encriptado ~500 bytes)
Asset (metadatos)              → documento < 1KB
CreditSummary                  → documento fijo, siempre < 200 bytes
CreditLedger entry             → documento < 500 bytes
GenerationJob                  → documento < 1KB
```

### ❌ Lo que NO va en Firestore

| Dato | Por qué no | Dónde va |
|------|-----------|---------|
| Canvas JSON de plantilla (Fabric.js) | 50-200KB, supera límite seguro por doc | Firebase Storage |
| Canvas JSON de post compuesto | 50-200KB | Firebase Storage |
| Imágenes generadas (raw + final) | binarios, Storage es su lugar | Firebase Storage |
| Thumbnails de posts | binarios | Firebase Storage |
| Logos de marcas | binarios | Firebase Storage |
| ZIP de exportación de campaña | binarios temporales | Firebase Storage (TTL 24h) |
| Array ilimitado de postIds en Campaign | crece indefinidamente | Query por campaignId en posts/ |
| Historial completo de prompts | puede ser grande | Embeber solo el último en GenerationMetadata |
| brandSnapshot completo del BrandBrain | No — guardar solo los campos usados en el prompt | Campo `generation.brandSnapshot` ya filtrado |

### ✅ Lo que debe cachearse

| Dato | Estrategia de cache | TTL |
|------|--------------------| ----|
| Lista de plantillas globales | SWR con `revalidateIfStale: false` + Firestore listener | Sin TTL (listener actualiza) |
| Brand Brain activo | Hook `use-active-brand` mantiene en React state | Duración de la sesión |
| Balance de créditos | SWR polling cada 30s cuando el usuario está generando | 30s |
| Templates de una campaña activa | SWR durante la sesión de creación | Duración de la sesión |

### ✅ Lo que debe calcularse (no persistirse)

| Dato | Cómo calcularlo | Dónde |
|------|----------------|-------|
| `completionScore` del BrandBrain | Función pura en `lib/growth/utils/brand-score.ts` | Cliente |
| Progreso de campaña (%) | `counters.approvedPosts / counters.totalPosts` | Cliente |
| Créditos estimados para campaña | Suma de `CampaignPostPlan.creditsRequired` | Cliente antes de generar |
| Tiempo hasta agotamiento de créditos | `balance / avgCreditsPerDay` | Cliente (analytics, futuro) |

---

## 5. Sistema de Créditos

### Estructura en Firestore

```
organizations/{orgId}/credits/summary        ← Documento único, escritura solo via CF
  balance: number                            ← balance actual
  monthlyAllowance: number                   ← créditos que se añaden el día 1 del mes
  totalPurchased: number                     ← histórico de créditos comprados
  totalUsed: number                          ← histórico de créditos consumidos
  lastMonthlyRefillAt: Timestamp
  plan: OrganizationPlan                     ← replica del plan de la org (para CF sin leer org)

organizations/{orgId}/credits/ledger/{id}    ← Una entrada por transacción
  id: string
  type: CreditTransactionType
  amount: number                             ← NEGATIVO para consumos, POSITIVO para ingresos
  balance: number                            ← balance DESPUÉS de esta transacción
  operation: CreditOperation
  referenceId?: string                       ← postId, campaignId, jobId
  description: string                        ← "Post generado — Clínica Dental Sur"
  createdAt: Timestamp
  expiresAt?: Timestamp                      ← solo para créditos de compra adicional (12 meses)

type CreditTransactionType =
  | "monthly_grant"      // recarga mensual automática
  | "purchase"           // compra de créditos adicionales
  | "charge"             // consumo por operación
  | "refund"             // devolución por error de generación
  | "manual_grant"       // asignado por admin (soporte)
  | "trial_grant";       // créditos de bienvenida al registrarse
```

### Tabla de costos por operación

| Operación | Créditos | Modelo IA | Justificación |
|-----------|---------|-----------|--------------|
| `brand_suggestion` | 1 | GPT-4o-mini | Sugerencias en el wizard del Brand Brain |
| `post_text_only` | 2 | GPT-4o | Headline + body + CTA + hashtags para un post |
| `post_image_flux` | 6 | Flux Pro (Fal.ai) | 1 imagen editorial/profesional |
| `post_image_ideogram` | 6 | Ideogram v2 | 1 imagen con texto prominente |
| `post_complete` | 8 | GPT-4o + Flux | Texto + imagen (ligero descuento sobre separados) |
| `post_variant` | 5 | GPT-4o + Flux | Variante (texto diferente + imagen diferente) |
| `campaign_strategy` | 3 | GPT-4o | Análisis de objetivo → estructura de campaña |
| `campaign_post` | 8 | GPT-4o + Flux | Post dentro de campaña (mismo costo que post completo) |
| `image_regeneration` | 5 | Flux o Ideogram | Regenerar solo la imagen de un post existente |
| `text_regeneration` | 2 | GPT-4o | Regenerar solo el texto de un post existente |

### Créditos incluidos por plan

| Plan | Créditos/mes | Posts completos equivalentes | Campañas equivalentes |
|------|------------|----------------------------|-----------------------|
| Free | 50 | ~6 posts | ~½ campaña |
| Starter | 200 | ~25 posts | ~2 campañas |
| Pro | 600 | ~75 posts | ~7 campañas |
| Agency | 2,000 | ~250 posts | ~24 campañas |

### Flujo de validación y deducción (Cloud Function — nunca en cliente)

```
Fase 1 — Reserva (antes de llamar a IA):
  1. CF recibe { orgId, operation, referenceId }
  2. Firestore transaction:
     a. Lee credits/summary.balance
     b. Si balance < CREDIT_COSTS[operation] → throw INSUFFICIENT_CREDITS
     c. FieldValue.increment(-CREDIT_COSTS[operation]) en credits/summary
     d. Escribe ledger entry con type: "charge" (reserved)
  3. Continúa con la generación

Fase 2 — Confirmación o Reversa:
  Si generación exitosa:
    → Actualiza ledger entry a confirmed=true
  Si generación falla:
    → FieldValue.increment(+CREDIT_COSTS[operation]) — devuelve créditos
    → Actualiza ledger entry a type: "refund"
```

### Recarga mensual (Cloud Scheduler cron)

```
Trigger: "0 0 1 * *" (1er día del mes, 00:00 UTC)
Cloud Function monthly-credit-reset:
  1. Query: organizations donde plan != "free"
  2. Para cada org:
     a. Lee credits/summary.monthlyAllowance
     b. Añade créditos: FieldValue.increment(+monthlyAllowance)
     c. Escribe ledger entry: { type: "monthly_grant", amount: +monthlyAllowance }
     d. Actualiza lastMonthlyRefillAt
  3. Los créditos mensuales NO se acumulan (si ya tiene 180 de 200 posibles,
     el nuevo ciclo NO los suma — se establece el balance a max(balance, monthlyAllowance))
```

### Hard limits para evitar abusos

- Máx. 50 operaciones de generación por hora por organización
- Máx. costo IA real de $50/mes por organización (la CF lo verifica antes de generar)
- Créditos de `monthly_grant` no se acumulan entre meses
- Créditos de `purchase` vencen en 12 meses (`expiresAt` en el ledger entry)

---

## 6. Brand Brain — Diseño Completo

### Secciones del wizard de configuración (5 pasos)

```
Paso 1 — Tu Negocio
  Campos: industry (selector), subIndustry (libre), name, location, yearsInBusiness
  Autocompletado: si selecciona industry "Salud Dental", la IA (GPT-4o-mini, 1 crédito)
                  sugiere servicios típicos, objeciones comunes y CTAs del sector.
  Validación: name y industry son requeridos para avanzar.

Paso 2 — Tus Servicios
  Campos: services[] con ServiceEditor
  ServiceEditor: name, description, price?, duration?, targetPain, benefit, isHighlight
  Min 1 servicio para avanzar. Max 10.
  Highlight: solo 1 servicio puede ser isHighlight = true.

Paso 3 — Tu Cliente Ideal y Objeciones
  Sub-sección A — ICP:
    ageRange, gender, income, location, painPoints[], goals[], triggers[]
    Sugerencias automáticas basadas en el industry del Paso 1.
  Sub-sección B — Objeciones:
    Lista de ObjectionResponse con objection, response, contentHook?
    Max 10. Min 0 para avanzar.

Paso 4 — Voz y Estilo de Comunicación
  personality[] (tags predefinidos + libre): "profesional", "empático", "técnico", etc.
  avoid[] (tags predefinidos + libre): "lenguaje informal", "tecnicismos", etc.
  formality: selector "Formal / Semi-formal / Casual"
  language: "Español / English / Português"
  examplePosts: textarea 1-5 ejemplos de posts que la marca considera "perfectos"
  forbiddenTopics: tags de temas prohibidos
  contentRules.callToActions: lista de CTAs preferidos
  contentRules.contentPillars: pilares de contenido (Educativo, Testimonio, etc.)

Paso 5 — Identidad Visual
  logoUrl: upload a Firebase Storage (preview inmediata)
  colors.primary: color picker + input hex
  colors.secondary, accent, background, text: igual
  typography.heading: selector de Google Fonts (30 fuentes populares)
  typography.body: ídem
```

### Cómo BrandBrain alimenta los prompts de IA

La función `buildBrandBrainSystemPrompt(brand: BrandBrain): string` en `lib/growth/ai/prompt-builder.ts` construye el system prompt completo que se envía a GPT-4o en CADA generación.

**Estructura del system prompt:**

```
Sección 1 — Contexto del negocio
  "Eres un experto en marketing para {industry}.
   Marca: {name}. Ubicación: {location}.
   [Si yearsInBusiness] Con {N} años de experiencia."

Sección 2 — Servicios (crítica para relevancia)
  Por cada servicio:
  "SERVICIO: {name}
   Descripción: {description}
   Dolor que resuelve: {targetPain}
   Beneficio principal: {benefit}
   [Si price] Precio referencial: {price}"

Sección 3 — Cliente ideal
  "CLIENTE IDEAL:
   Perfil: {ageRange}, {income}, {location}
   Dolores: {painPoints.join(', ')}
   Objetivos: {goals.join(', ')}
   Triggers de compra: {triggers.join(', ')}"

Sección 4 — Posicionamiento
  "DIFERENCIADORES:
   {differentiators.join('\n- ')}
   PROPUESTAS DE VALOR:
   {valueProps.join('\n- ')}
   [Si competitorContext] CONTEXTO COMPETITIVO: {competitorContext}"

Sección 5 — Objeciones (para evitar copy que las active)
  "OBJECIONES COMUNES Y CÓMO MANEJARLAS:
   {objections.map(o => `- "${o.objection}" → ${o.response}`).join('\n')}"

Sección 6 — Voz y restricciones
  "TONO: {personality.join(', ')} | Formalidad: {formality}
   NUNCA usar: {avoid.join(', ')}
   TEMAS PROHIBIDOS: {forbiddenTopics.join(', ')}
   CTAs APROBADOS: {callToActions.join(' | ')}"

Sección 7 — Ejemplos de referencia
  "EJEMPLOS DE PUBLICACIONES QUE ESTA MARCA APRUEBA:
   {examplePosts.slice(0, 3).join('\n---\n')}"

Sección 8 — Instrucción de idioma
  "Genera SIEMPRE en {language === 'es' ? 'español' : language}.
   El registro debe ser {formality}."
```

### Cálculo del completionScore

`lib/growth/utils/brand-score.ts` calcula 0-100 con este esquema:

```
Sección               Puntos máx   Condición
─────────────────────────────────────────────────────
Identity.logo         10           logoUrl existe
Identity.colors       10           primary + secondary definidos
Identity.typography    5           heading font definido
Business.services     20           min 1 servicio con todos los campos
Business.industry     10           industry definido
Positioning.valueProps 10          min 2 propuestas de valor
Positioning.ICP        10          painPoints tiene min 2 items
Voice.personality      5           min 2 tags de personalidad
Voice.examplePosts    10           min 1 ejemplo real de post
ContentRules.CTAs      5           min 1 CTA definido
Objections             5           min 2 objeciones con respuesta
─────────────────────────────────────────────────────
TOTAL                 100
```

### Límites de documento

- Max 10 servicios (UI bloquea agregar más)
- Max 10 objeciones
- Max 5 value props, 5 differentiators
- Max 3 example posts (se truncan a 3 al usar en el prompt — no guardar más de 5 en Firestore)
- Max 5 pain points, goals, triggers en ICP
- Max 5 personality tags, 10 avoid tags, 5 forbidden topics

Estas restricciones garantizan que el documento de BrandBrain nunca supere 15KB.

---

## 7. Template Engine

### Schema JSON de plantilla (almacenado en Firebase Storage)

El canvas JSON que vive en Storage es un objeto Fabric.js v6 extendido con metadatos propios. La extensión es el campo `pixeltecMeta` en cada objeto del canvas.

```json
{
  "templateMeta": {
    "id": "tpl_ig_post_dental_001",
    "schemaVersion": 1,
    "format": "instagram_post",
    "dimensions": { "width": 1080, "height": 1080 },
    "brandVariables": [
      {
        "placeholder": "{{brand.colors.primary}}",
        "path": "identity.colors.primary",
        "fallback": "#1A2B3C"
      },
      {
        "placeholder": "{{brand.colors.secondary}}",
        "path": "identity.colors.secondary",
        "fallback": "#F5F5F5"
      },
      {
        "placeholder": "{{brand.identity.logoUrl}}",
        "path": "identity.logoUrl",
        "fallback": ""
      }
    ]
  },
  "version": "6.0.0",
  "objects": [
    {
      "type": "rect",
      "pixeltecMeta": {
        "zoneId": "background",
        "zoneType": "background",
        "locked": true,
        "aiRole": null
      },
      "left": 0, "top": 0,
      "width": 1080, "height": 1080,
      "fill": "{{brand.colors.primary}}"
    },
    {
      "type": "image",
      "pixeltecMeta": {
        "zoneId": "image_main",
        "zoneType": "image",
        "locked": false,
        "aiRole": "image_prompt"
      },
      "left": 0, "top": 0,
      "width": 1080, "height": 600,
      "src": ""
    },
    {
      "type": "textbox",
      "pixeltecMeta": {
        "zoneId": "headline",
        "zoneType": "text",
        "locked": false,
        "aiRole": "headline",
        "maxLength": 60,
        "required": true
      },
      "left": 60, "top": 640,
      "width": 960,
      "fontFamily": "{{brand.typography.heading}}",
      "fill": "#FFFFFF",
      "fontSize": 48,
      "fontWeight": "bold",
      "text": "PLACEHOLDER_HEADLINE"
    },
    {
      "type": "textbox",
      "pixeltecMeta": {
        "zoneId": "body",
        "zoneType": "text",
        "locked": false,
        "aiRole": "body",
        "maxLength": 150,
        "required": false
      },
      "left": 60, "top": 730,
      "width": 960,
      "fontFamily": "{{brand.typography.body}}",
      "fill": "rgba(255,255,255,0.85)",
      "fontSize": 28,
      "text": "PLACEHOLDER_BODY"
    },
    {
      "type": "textbox",
      "pixeltecMeta": {
        "zoneId": "cta",
        "zoneType": "text",
        "locked": false,
        "aiRole": "cta",
        "maxLength": 30,
        "required": true
      },
      "left": 60, "top": 920,
      "width": 500,
      "fontFamily": "{{brand.typography.body}}",
      "fill": "{{brand.colors.accent}}",
      "fontSize": 24,
      "fontWeight": "600",
      "text": "PLACEHOLDER_CTA"
    },
    {
      "type": "image",
      "pixeltecMeta": {
        "zoneId": "logo",
        "zoneType": "logo",
        "locked": true,
        "aiRole": "brand_logo"
      },
      "left": 900, "top": 30,
      "width": 120, "height": 60,
      "src": "{{brand.identity.logoUrl}}"
    }
  ]
}
```

### Compositor (`lib/growth/canvas/compositor.ts`)

El compositor toma el canvas JSON del Storage y aplica:

1. **Reemplaza `brandVariables`:** Recorre todos los objetos buscando placeholders `{{brand.*}}` y los sustituye con los valores del BrandBrain.

2. **Aplica fuentes de Google:** Para cada `textbox` con `fontFamily` que sea una Google Font, carga la fuente antes de renderizar.

3. **Inserta imagen generada:** El objeto con `aiRole: "image_prompt"` recibe la URL de la imagen generada por Flux/Ideogram en su campo `src`.

4. **Inserta textos generados:** Los objetos con `aiRole: "headline" | "body" | "cta"` reciben el texto generado por GPT-4o.

5. **Inserta logo:** El objeto con `aiRole: "brand_logo"` recibe `brandBrain.identity.logoUrl`.

6. **Exporta a PNG:** Fabric.js renderiza en canvas offscreen y exporta con `canvas.toDataURL("image/png", 1.0)`.

### Compatibilidad futura con editor visual (v2)

El diseño del schema es deliberadamente compatible con un editor visual posterior:

- `pixeltecMeta` es un campo extensión — un editor Fabric.js standard lo ignora sin romperse.
- El campo `zoneId` semántico (no numérico) permite que el editor muestre nombres legibles.
- El campo `locked` ya es una propiedad nativa de Fabric.js — no requiere lógica extra en el editor.
- Los `brandVariables` en `templateMeta` permiten al editor visual mostrar un panel "Variables de marca" con los campos del Brand Brain disponibles para mapear.
- El `schemaVersion` permite migrations automáticas cuando el schema cambie en v2.

**En v2:** Un editor visual (probablemente basado en Fabric.js con React wrappers) leerá el mismo JSON, lo renderizará como canvas interactivo, y permitirá arrastrar, redimensionar y añadir zonas. El schema de Storage no cambia entre MVP y v2 — solo se añade la UI de edición.

---

## 8. AI Orchestrator

### Flujo completo de generación de un post

```
Paso 1 — Validación previa (cliente)
  use-credits.ts verifica balance >= CREDIT_COSTS.post_complete (8 créditos)
  Si insuficiente → muestra CreditWarning, NO llama a Cloud Function

Paso 2 — Inicio del job (cliente → Cloud Function)
  POST /api/growth/generate-post
  Body: { brandId, templateId, idea, format, orgId }
  → Cloud Function: generate-post.ts

Paso 3 — Reserva de créditos (Cloud Function)
  Firestore transaction: balance -= 8
  Crea GenerationJob { status: "queued" }
  Crea ContentPost { status: "generating" }
  Responde al cliente con { jobId, postId }

Paso 4 — Carga del Brand Brain (Cloud Function)
  Lee organizations/{orgId}/brands/{brandId}
  Construye systemPrompt con prompt-builder.ts

Paso 5 — Generación de texto (Cloud Function → OpenAI)
  buildTextGenerationMessages(brand, idea, format, template.zones)
  Call a GPT-4o con el systemPrompt + user message
  User message: "Genera contenido para este post de {format}.
                 Idea: '{idea}'
                 Zonas de la plantilla: {zones.map(z => z.aiRole).join(', ')}
                 Responde en JSON: { headline, body, cta, hashtags[], imagePrompt }"
  Parsea JSON de respuesta
  Actualiza GenerationJob.currentStep = "Generando imagen..."

Paso 6 — Selección de proveedor de imagen (Cloud Function)
  selectImageProvider(template.zones, format):
    Si zones contiene zona con aiRole "image_prompt" Y el template tiene texto prominente
      → usa IdeogramProvider
    En cualquier otro caso
      → usa FluxProvider

Paso 7 — Generación de imagen (Cloud Function → Fal.ai o Ideogram)
  buildImagePrompt(generatedText.imagePrompt, brand):
    Enriquece el imagePrompt base con el contexto de la marca:
    "Professional photograph for a {brand.business.industry} company.
     Style: clean, modern, editorial.
     Colors: {brand.identity.colors.primary} as accent.
     {generatedText.imagePrompt}
     High quality, no text in image, no watermarks."
  Llama al proveedor seleccionado
  Descarga la imagen y la sube a Storage: /{orgId}/posts/{postId}/raw-image.jpg
  Actualiza GenerationJob.currentStep = "Componiendo diseño..."

Paso 8 — Composición del canvas (Cloud Function)
  Descarga canvas JSON de Storage: global-templates/{templateId}/canvas.json
  compositor.ts:
    1. Reemplaza brandVariables con valores del BrandBrain
    2. Inserta textos generados en cada zona por aiRole
    3. Inserta imagen generada en zona image_main
    4. Carga fuentes de Google
    5. Exporta a PNG
  Sube canvas JSON a Storage: /{orgId}/posts/{postId}/canvas.json
  Sube PNG final a Storage: /{orgId}/posts/{postId}/final.png
  Genera thumbnail 300x300 y sube a: /{orgId}/posts/{postId}/thumbnail.jpg

Paso 9 — Actualización del post (Cloud Function → Firestore)
  Actualiza ContentPost:
    status: "draft"
    content.headline, body, cta, hashtags, imagePrompt
    assets.rawImageUrl, canvasJsonUrl, finalImageUrl, thumbnailUrl
    generation.creditsUsed, textModel, imageModel, generatedAt
  Actualiza GenerationJob: { status: "completed", creditsUsed: 8 }
  Confirma deducción de créditos en ledger

Paso 10 — Notificación al cliente (Cloud Function → Firestore → cliente)
  El cliente tiene un listener Firestore en GenerationJob (use-generation-job.ts)
  Cuando status cambia a "completed" → hook actualiza la UI automáticamente
  Alternativa con SSE: el endpoint /api/growth/job-status/[jobId] emite eventos
```

### Comparación técnica de proveedores de imagen

| Criterio | Flux Pro (Fal.ai) | Ideogram v2 | GPT Image (gpt-image-1) |
|---------|-------------------|------------|------------------------|
| **API** | REST + WebSocket | REST | REST (OpenAI) |
| **Latencia** | 4-12s | 6-15s | 10-25s |
| **Calidad fotográfica** | ★★★★★ | ★★★★ | ★★★★ |
| **Texto en imagen** | ★★★ | ★★★★★ | ★★★★ |
| **Seguimiento de prompt** | ★★★★ | ★★★★ | ★★★★★ |
| **Consistencia entre gens** | ★★★★ | ★★★ | ★★★ |
| **Costo/imagen** | $0.05-0.08 | $0.08 | $0.04-0.12 |
| **Licencia comercial** | ✅ Sí | ✅ Sí | ✅ Sí |
| **Rate limits** | Alto | Medio | Depende del tier |
| **SDK disponible** | @fal-ai/client | HTTP directo | openai npm |
| **Mejor para** | Fotografía profesional, editorial | Posts con tipografía en imagen | Versatilidad general |

**Decisión del MVP:**
- **Proveedor primario:** Flux Pro via Fal.ai — mejor calidad fotográfica para contenido de servicios profesionales.
- **Proveedor para texto en imagen:** Ideogram v2 — cuando el template tiene una zona `text_as_image` o el formato requiere texto integrado en el diseño visual.
- **Fallback:** GPT Image (gpt-image-1) — si Fal.ai tiene downtime o rate limit.

**Abstracción `AIImageProvider`:**

```typescript
// lib/growth/ai/providers/types.ts
interface AIImageProvider {
  name: string;
  generate(
    prompt: string,
    options: {
      width: number;
      height: number;
      style?: "photographic" | "illustration" | "vector";
    }
  ): Promise<{
    imageUrl: string;     // URL temporal del proveedor
    creditsUsed: number;  // para logging
  }>;
}

// Implementaciones:
// providers/flux-image.ts    ← implements AIImageProvider
// providers/ideogram-image.ts ← implements AIImageProvider
// providers/gpt-image.ts      ← implements AIImageProvider (fallback)
```

La función `selectImageProvider(zones: TemplateZone[]): AIImageProvider` en `orchestrator.ts` elige el proveedor correcto según las zonas del template.

---

## 9. Campaign Engine

### Entidades y estados

```
Campaign
  Status: planning → strategy_ready → generating → review → active → completed → archived
  
  planning        Usuario creó la campaña con objetivo, no tiene estrategia aún
  strategy_ready  GPT-4o generó CampaignStrategy, usuario puede revisar y ajustar
  generating      Cloud Function generando posts en lote (async)
  review          Todos los posts en estado "draft" — usuario revisa y aprueba
  active          Al menos 1 post en "scheduled" o "published"
  completed       Todos los posts en "published"
  archived        Archivada manualmente — posts no se borran, solo la campaña

ContentPost (dentro de campaña)
  Status: generating → draft → approved → scheduled → published | rejected
  
  Los posts "rejected" no se borran — el usuario puede pedir regeneración
```

### Flujo de creación de campaña

```
Fase 1 — Input del usuario (cliente)
  Campos: objective, targetAction, brandId, targetPlatforms[], dateRange?
  Estimación preview: "Esta campaña generará ~10-15 posts y consumirá ~80-120 créditos"
  Botón: "Diseñar campaña" → llama a generate-campaign.ts (solo estrategia)

Fase 2 — Generación de estrategia (Cloud Function, 3 créditos)
  GPT-4o recibe:
    - BrandBrain completo
    - Objective y targetAction
    - Plataformas seleccionadas
    - Rangos de fecha (si los hay)
  GPT-4o devuelve CampaignStrategy como JSON:
    { campaignName, angle, targetedPain, keyMessage, postPlans[], estimatedCredits }
  Cloud Function actualiza Campaign: { strategy, status: "strategy_ready" }
  
Fase 3 — Revisión de estrategia (cliente)
  Usuario ve la estrategia propuesta:
    "Campaña: Implantes para siempre
     Ángulo: Miedo a perder + solución accesible
     Estructura: 4 Instagram Posts + 3 Stories + 2 Facebook Posts + 1 Carrusel
     Créditos estimados: 84"
  Puede ajustar: eliminar tipos de posts, cambiar cantidad, cambiar ángulo
  Botón: "Generar campaña" → llama a generate-campaign.ts (posts en lote)

Fase 4 — Generación en lote (Cloud Function)
  Por cada postPlan en strategy.postPlans:
    1. Crea ContentPost { status: "generating" }
    2. Llama al mismo orquestador que post individual
    3. Actualiza Campaign.counters.generatedPosts con FieldValue.increment(1)
    4. Actualiza GenerationJob.progress
  Los posts se generan secuencialmente (no paralelo) para evitar rate limits de IA
  Paralelismo controlado: máx 3 posts simultáneos
  Cuando todos completan: Campaign status → "review"

Fase 5 — Revisión de posts (cliente)
  Usuario ve grid de posts con preview
  Puede: Aprobar / Rechazar / Regenerar individualmente
  Regeneración individual: 8 créditos adicionales por post
  Botón "Exportar aprobados": genera ZIP en Storage con todos los PNG aprobados

Fase 6 — Programación (cliente)
  Usuario asigna fechas a posts aprobados (drag al calendario o asignación manual)
  Al asignar fecha + plataforma → PostScheduling.scheduledAt y status → "scheduled"
```

### Regeneración parcial de posts

Cuando el usuario rechaza un post y pide regeneración:

```
1. ContentPost.status → "rejected" (se preserva el contenido anterior)
2. Se crea un NUEVO ContentPost con el mismo campaignId y plantilla
3. El nuevo post entra al mismo flujo de generación individual
4. Campaign.counters.totalPosts += 1 (hay un post más ahora)
5. El post rechazado queda visible como "rejected" para referencia histórica
   (no se borra — el usuario puede recuperar el texto si lo desea)
```

---

## 10. Asset Library

### Estructura de carpetas en Firebase Storage

```
Firebase Storage bucket root/
│
├── global-templates/
│   └── {templateId}/
│       ├── canvas.json              ← Fabric.js JSON de la plantilla
│       └── thumbnail.jpg            ← Preview 800x800 de la plantilla
│
├── {orgId}/
│   ├── brands/
│   │   └── {brandId}/
│   │       ├── logo.{ext}           ← Logo original subido por el usuario
│   │       └── logo-thumb.jpg       ← Versión 200x200 para uso en UI
│   │
│   ├── posts/
│   │   └── {postId}/
│   │       ├── raw-image.jpg        ← Imagen generada por Flux/Ideogram (antes de compositar)
│   │       ├── canvas.json          ← Fabric.js JSON del post compuesto
│   │       ├── final.png            ← PNG exportado para descarga
│   │       └── thumbnail.jpg        ← Preview 300x300 para listas y calendarios
│   │
│   ├── templates/
│   │   └── {templateId}/
│   │       ├── canvas.json          ← canvas JSON de plantilla personalizada de la org
│   │       └── thumbnail.jpg
│   │
│   ├── campaigns/
│   │   └── {campaignId}/
│   │       └── exports/
│   │           └── {timestamp}-assets.zip  ← ZIP temporal de posts aprobados (TTL 24h)
│   │
│   └── uploads/
│       └── {assetId}.{ext}          ← Imágenes y archivos subidos manualmente por el usuario
```

### Metadata en Firestore (Asset collection)

```typescript
// organizations/{orgId}/assets/{assetId}
interface Asset {
  id: string;
  orgId: string;
  brandId?: string;               // null si es asset de organización general
  type: AssetType;
  url: string;                    // Firebase Storage download URL (con token)
  storagePath: string;            // path en Storage para borrar el archivo
  thumbnailUrl?: string;          // Storage URL del thumbnail
  name: string;                   // nombre descriptivo editable por el usuario
  tags: string[];                 // para búsqueda y filtrado
  size: number;                   // bytes
  dimensions?: { width: number; height: number };
  mimeType: string;
  linkedPostId?: string;          // si es el resultado de una generación
  linkedCampaignId?: string;
  isUserUploaded: boolean;        // true si el usuario lo subió manualmente
  createdAt: Timestamp;
}

type AssetType =
  | "logo"
  | "brand_photo"
  | "generated_image"    // imagen raw de Flux/Ideogram
  | "generated_post"     // PNG final exportado
  | "template_canvas"
  | "upload";            // archivo subido manualmente
```

### Versionado de assets

No implementamos versionado de assets en el MVP. Un post rechazado conserva sus assets. Si se regenera el post, se crean NUEVOS archivos en Storage. Los assets del post rechazado permanecen (para recuperación manual) y se limpian en el proceso de limpieza semanal de posts rechazados > 30 días.

**Proceso de limpieza (Cloud Function semanal):**
1. Query: posts con `status: "rejected"` y `updatedAt < 30 días`
2. Para cada post: borrar archivos en Storage (`raw-image.jpg`, `canvas.json`, `final.png`, `thumbnail.jpg`)
3. Actualizar Asset metadata: marcar como borrado (no eliminar el documento por historial)
4. NO borrar el documento ContentPost (historial de la campaña)

---

## 11. Seguridad

### Modelo de multi-tenancy

El tenant es la `Organization`. Todo dato pertenece a una organización y está aislado bajo `organizations/{orgId}/`. Las Security Rules de Firestore garantizan que ningún usuario puede leer datos de otra organización.

**Fase 1 (MVP):** `orgId === userId`. Un usuario = una organización. La Security Rule simplificada es válida para el MVP.

**Fase 2 (SaaS):** `orgId` es un ID independiente. La Security Rule usa `memberIds[]`. La migración de datos es trivial (se crea el documento Organization con `id: userId` y `memberIds: [userId]`).

### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Helpers ────────────────────────────────────────────────
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOrgMember(orgId) {
      // Fase 2: verifica membership en el documento Organization
      // Fase 1 (MVP simplificado): orgId === uid
      return isAuthenticated() &&
        request.auth.uid in
          get(/databases/$(database)/documents/organizations/$(orgId)).data.memberIds;
    }

    function isOrgOwner(orgId) {
      return isAuthenticated() &&
        request.auth.uid ==
          get(/databases/$(database)/documents/organizations/$(orgId)).data.ownerId;
    }

    function isCloudFunction() {
      // Las Cloud Functions usan service account con admin SDK — bypasean las rules
      // Esta función es solo documentación; en la práctica, el admin SDK bypasea rules
      return false;
    }

    // ── Organizations ──────────────────────────────────────────
    match /organizations/{orgId} {
      allow read: if isOrgMember(orgId);
      allow create: if isAuthenticated() &&
                    request.auth.uid == request.resource.data.ownerId &&
                    request.resource.data.memberIds.size() == 1 &&
                    request.resource.data.memberIds[0] == request.auth.uid;
      allow update: if isOrgOwner(orgId);
      allow delete: if false;  // Las organizaciones nunca se borran desde cliente

      // ── BrandBrains ─────────────────────────────────────────
      match /brands/{brandId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOrgMember(orgId) &&
                      request.resource.data.orgId == orgId;
        allow update: if isOrgMember(orgId) &&
                      resource.data.orgId == orgId;
        allow delete: if isOrgOwner(orgId);
      }

      // ── Posts ────────────────────────────────────────────────
      match /posts/{postId} {
        allow read: if isOrgMember(orgId);
        allow create: if false;  // Solo Cloud Functions crean posts
        allow update: if isOrgMember(orgId) &&
                      // Los campos sensibles no se pueden cambiar desde cliente:
                      !("generation" in request.resource.data.diff(resource.data).affectedKeys()) &&
                      !("assets" in request.resource.data.diff(resource.data).affectedKeys());
        allow delete: if false;  // Los posts no se borran desde cliente
      }

      // ── Campaigns ────────────────────────────────────────────
      match /campaigns/{campaignId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOrgMember(orgId) &&
                      request.resource.data.orgId == orgId;
        allow update: if isOrgMember(orgId) &&
                      // status y counters solo los actualiza la Cloud Function
                      !("status" in request.resource.data.diff(resource.data).affectedKeys()) &&
                      !("counters" in request.resource.data.diff(resource.data).affectedKeys());
        allow delete: if false;
      }

      // ── Assets ───────────────────────────────────────────────
      match /assets/{assetId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOrgMember(orgId);
        allow update: if isOrgMember(orgId);
        allow delete: if isOrgMember(orgId);
      }

      // ── Credits ──────────────────────────────────────────────
      match /credits/summary {
        allow read: if isOrgMember(orgId);
        allow write: if false;  // SOLO Cloud Functions
      }

      match /credits/ledger/{entryId} {
        allow read: if isOrgMember(orgId);
        allow write: if false;  // SOLO Cloud Functions
      }

      // ── Social Accounts ──────────────────────────────────────
      match /social_accounts/{accountId} {
        allow read: if isOrgMember(orgId);
        allow create: if false;  // Solo Cloud Functions tras OAuth
        allow update: if false;  // Solo Cloud Functions en renovación de token
        allow delete: if isOrgOwner(orgId);  // Desconectar cuenta
      }

      // ── Templates personalizados de la org ───────────────────
      match /templates/{templateId} {
        allow read: if isOrgMember(orgId);
        allow write: if isOrgOwner(orgId);  // Solo el owner puede crear/editar plantillas propias
      }
    }

    // ── Plantillas globales (solo lectura para todos) ─────────
    match /global_templates/{templateId} {
      allow read: if isAuthenticated();
      allow write: if false;  // Solo el admin SDK puede escribir plantillas globales
    }

    // ── Generation Jobs ───────────────────────────────────────
    match /generation_jobs/{jobId} {
      allow read: if isAuthenticated() &&
                  isOrgMember(resource.data.orgId);
      allow write: if false;  // Solo Cloud Functions
    }
  }
}
```

### Firebase Storage Security Rules

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // Helper: verifica membership usando Firestore
    function isOrgMember(orgId) {
      return request.auth != null &&
        request.auth.uid in
          firestore.get(/databases/(default)/documents/organizations/$(orgId)).data.memberIds;
    }

    // Plantillas globales: lectura para autenticados, sin escritura desde cliente
    match /global-templates/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // Assets de la organización
    match /{orgId}/{allPaths=**} {
      allow read: if isOrgMember(orgId);

      // Escritura solo para uploads del usuario (no para assets generados por IA)
      allow write: if isOrgMember(orgId) &&
                   // Solo se permite escribir en la carpeta uploads/ y brands/
                   (request.resource.name.matches('.*/' + orgId + '/uploads/.*') ||
                    request.resource.name.matches('.*/' + orgId + '/brands/.*')) &&
                   // Tipos de archivo permitidos para upload
                   request.resource.contentType.matches('image/.*') &&
                   // Tamaño máximo 10MB para uploads del usuario
                   request.resource.size <= 10 * 1024 * 1024;

      allow delete: if isOrgMember(orgId) &&
                    // Solo se puede borrar desde uploads/ — lo generado lo borra la CF
                    request.resource.name.matches('.*/' + orgId + '/uploads/.*');
    }
  }
}
```

### Seguridad de access tokens de redes sociales

- Los tokens se encriptan con AES-256-GCM antes de guardar en Firestore.
- La clave de encriptación vive en Google Cloud Secret Manager.
- Solo las Cloud Functions tienen permiso de Secret Manager IAM para leer la clave.
- El cliente NUNCA recibe el token desencriptado — solo ve `{ platform, accountName, isActive, connectedAt }`.
- La Cloud Function que publica desencripta en memoria, usa el token, y descarta.

### Seguridad de API keys de IA

- `OPENAI_API_KEY`, `FAL_AI_KEY`, `IDEOGRAM_API_KEY` solo como environment variables de Cloud Functions.
- Nunca como `NEXT_PUBLIC_*`.
- Las Cloud Functions son los únicos consumidores de estas keys.
- Rate limiting propio para evitar abusos si alguna Cloud Function es invocada maliciosamente.

---

## 12. Roadmap Técnico por Sprint

### Sprint 0 — Infraestructura Base (1 semana)

**Objetivo:** Toda la infraestructura preparada. Sin UI. Sin generación. Los tipos compilan. El sistema de créditos está testeado.

**Archivos afectados:**
```
Crear:
  src/types/growth/index.ts
  src/types/growth/organization.ts
  src/types/growth/brand-brain.ts
  src/types/growth/template.ts
  src/types/growth/post.ts
  src/types/growth/campaign.ts
  src/types/growth/credits.ts
  src/types/growth/asset.ts
  src/types/growth/ai.ts
  src/lib/growth/credits/costs.ts         ← CREDIT_COSTS constant
  src/lib/growth/utils/brand-score.ts     ← completionScore calculator
  src/lib/growth/firestore/organizations.ts
  src/lib/growth/firestore/credits.ts
  firebase-functions/src/growth/credit-deduct.ts
  firebase-functions/src/growth/monthly-credit-reset.ts

Modificar:
  src/lib/routes/admin-routes.ts          ← añadir 'crecimiento'
  src/middleware.ts                       ← (si PROTECTED_PATHS se deriva de admin-routes)
```

**Dependencias:** Ninguna. Este sprint no depende de ningún otro.

**Riesgos:**
- **Tipos inconsistentes con la arquitectura real:** Mitigar revisando tipos contra el blueprint antes de cada siguiente sprint.
- **Cloud Function de créditos mal implementada:** La lógica transaccional es crítica. Debe tener tests.

**Criterios de aceptación:**
- `npx tsc --noEmit` sin errores en el workspace de Next.js.
- El Cloud Function `credit-deduct` tiene tests unitarios que cubren: saldo insuficiente, deducción exitosa, reversión en error.
- El documento Organization se crea automáticamente con 50 créditos de trial al primer login a `/crecimiento`.
- `brand-score.ts` devuelve 0 para BrandBrain vacío y 100 para uno completo (test unitario).

---

### Sprint 1 — Brand Brain (2 semanas)

**Objetivo:** El usuario puede crear, editar y completar su Brand Brain. Sin generación de contenido todavía.

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/layout.tsx
  src/app/(admin)/crecimiento/page.tsx              ← stub inicial (placeholder)
  src/app/(admin)/crecimiento/brand-brain/page.tsx
  src/app/(admin)/crecimiento/brand-brain/nuevo/page.tsx
  src/app/(admin)/crecimiento/brand-brain/[brandId]/page.tsx
  src/app/(admin)/crecimiento/brand-brain/[brandId]/editar/page.tsx

  src/components/growth/brand-brain/BrandBrainCard.tsx
  src/components/growth/brand-brain/BrandBrainScore.tsx
  src/components/growth/brand-brain/BrandBrainEmptyState.tsx
  src/components/growth/brand-brain/wizard/BrandBrainWizard.tsx
  src/components/growth/brand-brain/wizard/WizardProgress.tsx
  src/components/growth/brand-brain/wizard/steps/Step1Business.tsx
  src/components/growth/brand-brain/wizard/steps/Step2Services.tsx
  src/components/growth/brand-brain/wizard/steps/Step3ICP.tsx
  src/components/growth/brand-brain/wizard/steps/Step4Voice.tsx
  src/components/growth/brand-brain/wizard/steps/Step5Visual.tsx
  src/components/growth/brand-brain/wizard/ServiceEditor.tsx
  src/components/growth/shared/BrandSelector.tsx
  src/components/growth/shared/CreditBalance.tsx

  src/lib/growth/firestore/brands.ts
  src/lib/growth/storage/brands.ts       ← upload/delete logos

  src/hooks/growth/use-organization.ts
  src/hooks/growth/use-brand-brain.ts
  src/hooks/growth/use-active-brand.ts
  src/hooks/growth/use-credits.ts

Modificar:
  src/components/nav/...                  ← añadir sección CRECIMIENTO al nav
```

**Dependencias:** Sprint 0 (tipos y organizaciones).

**Riesgos:**
- **Wizard UX complejo:** El usuario puede abandonar el wizard a mitad. Guardar progreso parcial en cada step (auto-save al avanzar).
- **Upload de logo:** Firebase Storage rules para `/{orgId}/brands/` deben estar correctas.

**Criterios de aceptación:**
- El usuario puede crear un Brand Brain nuevo con el wizard de 5 pasos.
- El Score de completitud se calcula y muestra correctamente.
- Editar un Brand Brain existente conserva todos los campos.
- El logo se sube a Storage y la URL se guarda en Firestore.
- La sección CRECIMIENTO aparece en el sidebar con Brand Brain como primer item.
- Sin un Brand Brain con score ≥ 60, el resto del módulo muestra el guard.

---

### Sprint 2 — Content Studio + AI Engine (2.5 semanas)

**Objetivo:** El primer post generado. El "aha moment". Un usuario puede escribir una idea y obtener 3 variantes de post en PNG.

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/contenido/page.tsx
  src/app/(admin)/crecimiento/contenido/nuevo/page.tsx
  src/app/(admin)/crecimiento/contenido/[postId]/page.tsx

  src/components/growth/content-studio/PostGenerator.tsx
  src/components/growth/content-studio/IdeaInput.tsx
  src/components/growth/content-studio/TemplateGrid.tsx
  src/components/growth/content-studio/TemplateCard.tsx
  src/components/growth/content-studio/PostPreview.tsx
  src/components/growth/content-studio/VariantSlider.tsx
  src/components/growth/content-studio/GenerationProgress.tsx
  src/components/growth/content-studio/PostTextEditor.tsx
  src/components/growth/content-studio/PostActions.tsx
  src/components/growth/shared/PostStatusBadge.tsx

  src/lib/growth/ai/providers/types.ts
  src/lib/growth/ai/providers/openai-text.ts
  src/lib/growth/ai/providers/flux-image.ts
  src/lib/growth/ai/providers/ideogram-image.ts
  src/lib/growth/ai/orchestrator.ts
  src/lib/growth/ai/prompt-builder.ts
  src/lib/growth/canvas/compositor.ts
  src/lib/growth/canvas/brand-variables.ts
  src/lib/growth/canvas/exporter.ts
  src/lib/growth/firestore/posts.ts
  src/lib/growth/firestore/templates.ts
  src/lib/growth/storage/posts.ts
  src/lib/growth/storage/templates.ts

  src/hooks/growth/use-posts.ts
  src/hooks/growth/use-post.ts
  src/hooks/growth/use-templates.ts
  src/hooks/growth/use-generation-job.ts

  firebase-functions/src/growth/generate-post.ts
  firebase-functions/src/growth/job-processor.ts

  firestore/global_templates/           ← 8 plantillas prediseñadas (canvas JSON + thumbnails)
    tpl_ig_post_001/ (canvas.json, thumbnail.jpg)
    tpl_ig_post_002/ ...
    (4 Instagram Post + 2 Story + 2 Facebook Post)
```

**Dependencias:** Sprint 1 (debe existir al menos 1 Brand Brain).

**Riesgos:**
- **Latencia de generación (10-30s):** La UI debe mostrar estados descriptivos, no un spinner genérico. El usuario no debe sentir que la app está colgada.
- **Fallo del proveedor de IA:** Si Fal.ai está caído, el fallback a GPT Image debe activarse automáticamente.
- **Fabric.js en Node.js (Cloud Function):** Fabric.js está pensado para el browser. En Node.js se usa `fabric/node` o `canvas` npm package. Esto debe validarse en el sprint.

**Criterios de aceptación:**
- Usuario escribe idea, selecciona plantilla → obtiene 3 variantes en < 35 segundos.
- La UI muestra "Generando copy... ✓ Generando imagen... (8s) ✓ Componiendo diseño... ✓" durante el proceso.
- Los 3 PNGs generados respetan: colores del Brand Brain, logo en la zona correspondiente.
- El usuario puede editar el texto generado directamente en el preview.
- Botón "Descargar PNG" funciona correctamente.
- Los créditos se deducen correctamente (8 créditos por post).
- Si la generación falla, los créditos se devuelven.

---

### Sprint 3 — Campaign Engine (2 semanas)

**Objetivo:** El usuario puede crear una campaña completa desde un objetivo. La IA diseña la estrategia y genera 10-15 posts en lote.

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/campanas/page.tsx
  src/app/(admin)/crecimiento/campanas/nueva/page.tsx
  src/app/(admin)/crecimiento/campanas/[campaignId]/page.tsx

  src/components/growth/campaigns/CampaignCreatorForm.tsx
  src/components/growth/campaigns/CampaignStrategyPreview.tsx
  src/components/growth/campaigns/CampaignGenerationProgress.tsx
  src/components/growth/campaigns/CampaignCard.tsx
  src/components/growth/campaigns/CampaignPostGrid.tsx
  src/components/growth/campaigns/CampaignPostCard.tsx
  src/components/growth/campaigns/CampaignExportButton.tsx

  src/lib/growth/ai/campaign-strategist.ts
  src/lib/growth/firestore/campaigns.ts

  src/hooks/growth/use-campaigns.ts
  src/hooks/growth/use-campaign.ts

  firebase-functions/src/growth/generate-campaign.ts
```

**Dependencias:** Sprint 2 (el orquestador individual debe funcionar).

**Riesgos:**
- **Generación en lote falla a mitad:** Si la CF falla en el post 7 de 12, los primeros 6 ya están generados y pagados. El sistema debe reanudar desde donde falló, no empezar desde cero.
- **Timeout de Cloud Function:** Una campaña de 15 posts puede tardar 5-10 minutos. El `timeoutSeconds` debe ser 540 (máximo en Cloud Functions Gen 2). Alternativa: dividir en múltiples jobs.

**Criterios de aceptación:**
- El usuario escribe un objetivo y ve la estrategia de campaña en < 15 segundos.
- La generación en lote muestra progreso "Post 4 de 12..." en tiempo real.
- Si la generación falla a mitad, puede reanudarse desde el último post completado.
- El usuario puede aprobar/rechazar/regenerar posts individuales dentro de la campaña.
- El botón "Exportar ZIP" genera un archivo con todos los PNGs aprobados.
- Los créditos se deducen correctamente (3 por estrategia + 8 por cada post).

---

### Sprint 4 — Content Calendar (1.5 semanas)

**Objetivo:** El usuario puede organizar cuándo publica su contenido visualmente.

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/calendario/page.tsx

  src/components/growth/calendar/ContentCalendar.tsx
  src/components/growth/calendar/CalendarWeekView.tsx
  src/components/growth/calendar/CalendarMonthView.tsx
  src/components/growth/calendar/CalendarPostDot.tsx
  src/components/growth/calendar/CalendarPostModal.tsx
  src/components/growth/calendar/CalendarToolbar.tsx

  src/hooks/growth/use-calendar-posts.ts
```

**Dependencias:** Sprint 3 (posts deben tener status y scheduledAt).

**Riesgos:**
- **Drag & drop en mobile:** La librería de DnD debe soportar touch events. Usar `@dnd-kit/core` (ya en uso en PixelTEC OS si tiene drag & drop) o `react-beautiful-dnd`.
- **Query de posts por rango de fechas:** Requiere el índice `[orgId, scheduledAt ASC]` en Firestore.

**Criterios de aceptación:**
- Vista semanal y mensual navegables con flechas `<` y `>`.
- Un post programado aparece como punto de color en su día correspondiente.
- Hacer click en el punto abre el modal del post (preview + acciones).
- Drag & drop de post entre días actualiza `scheduledAt` en Firestore.
- Filtro por marca y plataforma funciona en el calendario.

---

### Sprint 5 — Social Publisher (3 semanas, condicional a aprobación de Meta)

**Objetivo:** El usuario puede publicar directamente a Facebook e Instagram desde PixelTEC OS.

**Prerequisito:** App Review de Meta aprobado (iniciado en Sprint 0).

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/cuentas/page.tsx

  src/components/growth/shared/PlatformBadge.tsx

  firebase-functions/src/growth/publish-post.ts      ← publica con Meta Graph API
  firebase-functions/src/growth/meta-oauth.ts        ← maneja el OAuth flow de Meta

Modificar:
  src/app/api/growth/meta-callback/route.ts          ← callback de OAuth de Meta
  (nueva ruta de API para recibir el código de autorización)
```

**Riesgos:**
- **Meta App Review:** Si no está aprobado, este sprint se pospone completamente.
- **Renovación de tokens:** Los tokens de Meta duran 60 días. El sistema debe renovarlos automáticamente.
- **Formato de imagen:** Meta requiere imágenes en JPEG para Instagram. El exporter debe exportar JPEG cuando el destino es IG.

**Criterios de aceptación:**
- El usuario puede conectar su cuenta de Facebook/Instagram via OAuth.
- Un post programado se publica automáticamente en la hora configurada.
- El estado del post cambia a "published" con el URL de la publicación.
- Si falla, reintenta hasta 3 veces con backoff exponencial.
- Las cuentas desconectadas muestran alerta al usuario.

---

### Sprint 6 — Crecimiento Hub + Refinamiento (2 semanas)

**Objetivo:** El Hub en `/crecimiento` muestra información útil. Refinamiento basado en uso real de los sprints anteriores.

**Archivos afectados:**
```
Modificar:
  src/app/(admin)/crecimiento/page.tsx   ← Hub real con datos de campañas, posts próximos, créditos
  src/app/(admin)/crecimiento/assets/page.tsx  ← Asset Manager real (Sprint anterior era stub)
  + componentes que requieran ajustes de UX post-feedback
```

---

### Sprint 7 — Billing + Multi-tenant (2.5 semanas)

**Objetivo:** El módulo puede monetizarse. Stripe conectado. Gestión de miembros.

**Archivos afectados:**
```
Crear:
  src/app/(admin)/crecimiento/ajustes/page.tsx   ← configuración del plan, créditos, miembros
  firebase-functions/src/growth/stripe-webhook.ts  ← recibe eventos de pago de Stripe
  src/app/api/growth/create-checkout/route.ts      ← genera link de pago
```

---

## 13. Deuda Técnica Futura

Lo siguiente está **explícitamente excluido del MVP** y de los Sprints 1-7. Cualquier tarea que lo implemente antes está fuera del scope.

### ❌ Editor visual de plantillas (Canva-like)

- **Por qué no ahora:** 3-6 meses de desarrollo solo para el editor.
- **Cuándo:** Cuando haya usuarios activos que lo pidan con evidencia. No antes.
- **Preparación en MVP:** El schema JSON de las plantillas es 100% compatible con un editor visual futuro. El campo `pixeltecMeta` en cada objeto del canvas es el contrato con el editor.

### ❌ X/Twitter Publisher

- **Por qué no ahora:** API cuesta $100/mes (Basic tier). No justificable sin revenue propio.
- **Cuándo:** Cuando el MRR cubra el costo y el mercado lo pida.

### ❌ Analytics y métricas de engagement

- **Por qué no ahora:** Requiere webhooks de todas las redes sociales + pipeline de datos + visualización. Bloqueante para el product-market fit.
- **Cuándo:** Fase 3, después de que Social Publisher tenga 3+ meses de datos.
- **Preparación en MVP:** La colección `analytics_snapshots/` está documentada en la arquitectura pero no se crea. La estructura del dato está definida en `types/growth/analytics.ts` (este tipo sí se crea en Sprint 0 como documentación).

### ❌ LoRA / Fine-tuning por marca

- **Por qué no ahora:** Cuesta $1-5 por training por marca, requiere dataset de imágenes curado, y la latencia de inference es mayor.
- **Cuándo:** Cuando la consistencia visual del template system no sea suficiente y haya revenue que lo justifique.

### ❌ Generación de video (Runway, Pika, Sora)

- **Por qué no ahora:** 10-50x el costo de imagen estática. Calidad inconsistente para marca.
- **Cuándo:** Fase 4 como mínimo.

### ❌ LinkedIn Company Pages

- **Por qué no ahora:** Requiere LinkedIn Partner Program (proceso separado y más largo que Meta).
- **Cuándo:** v1.2 después de lanzar con Meta.
- **En v1.2 sí:** LinkedIn personal (sin Partner Program).

### ❌ Colaboración en tiempo real (multi-cursor)

- **Por qué no ahora:** El caso de uso inicial es 1-3 personas trabajando en momentos distintos.
- **Cuándo:** Si hay evidencia de conflictos frecuentes entre editores simultáneos.

### ❌ White-label del módulo

- **Por qué no ahora:** Requiere multi-tenant completo + billing maduro + subdomain routing.
- **Cuándo:** Post Sprint 7, cuando el billing sea estable.

### ❌ AI que aprende del historial de la marca (feedback loop)

- **Por qué no ahora:** Requiere infraestructura de ML, fine-tuning, y suficientes datos para ser significativo (>50 posts generados y aprobados por marca).
- **Cuándo:** Cuando haya marcas con suficiente historial. El `brandSnapshot` en cada post es la preparación.

### ❌ Integración con Canva o Figma

- **Por qué no ahora:** Compite con el template system propio. Dilución del foco.
- **Cuándo:** Solo si el mercado lo exige de forma masiva.

### ❌ Publicación en Instagram Stories con elementos interactivos

- **Por qué no ahora:** La API de Meta no soporta stories con polls, preguntas, etc. Solo imagen estática.
- **Limitación permanente de la API** a considerar en el diseño.

### ❌ Compra de créditos adicionales con Stripe

- **Por qué no en Sprint 0-6:** El sistema de créditos se diseña desde Sprint 0 pero la integración de Stripe llega en Sprint 7.
- **En el interim:** Los créditos de trial (50) + monthly_grant cubren el uso interno.

---

## Checklist de pre-implementación

Antes de escribir la primera línea de código del Sprint 1, verificar:

- [ ] Todos los tipos en `src/types/growth/` compilan sin errores.
- [ ] Las colecciones de Firestore (`organizations`, `global_templates`, `generation_jobs`) están creadas en Firestore Console (dev + prod).
- [ ] Las reglas de Firestore y Storage están desplegadas en el entorno de desarrollo.
- [ ] Los índices compuestos están creados en Firestore Console (sin índices, las queries fallan en prod).
- [ ] Las variables de entorno de Cloud Functions están configuradas (`OPENAI_API_KEY`, `FAL_AI_KEY`, `IDEOGRAM_API_KEY`).
- [ ] Al menos 2 plantillas globales están subidas a Firebase Storage y sus metadatos están en `global_templates/` en Firestore.
- [ ] El proceso de App Review de Meta ha sido iniciado (aunque tarde 60 días).
- [ ] `admin-routes.ts` incluye `'crecimiento'` en `ADMIN_ROUTES`.
- [ ] El middleware protege la ruta `/crecimiento` correctamente.
