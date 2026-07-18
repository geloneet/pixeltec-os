# PixelForge Product DNA — v1 (PF-X1)

Documento rector del lenguaje visual del **admin** de PixelForge. Gobierna tokens
scoped (`--pfx-*` bajo `[data-product="pixelforge"]`), componentes del módulo y
las fases PF-X1→X4. No aplica al render de landings (ese usa `--pf-*`, sistema
independiente derivado de la dirección creativa del cliente).

```ts
interface PixelForgeProductDNA {
  productThesis:
    "PixelForge es el taller donde una landing pasa de materia prima (contexto crudo) " +
    "a pieza sellada. Cada estación templa el material y deja una marca visible del " +
    "proceso: lo que está caliente se está trabajando; lo sellado es sólido y frío.";

  emotionalAttributes: [
    "precisión artesanal",   // taller de precisión, no fábrica ni dashboard
    "calor contenido",       // energía presente pero gobernada
    "deliberación",          // cada paso se decide, nada es automático
    "solidez progresiva",    // el material gana estructura estación a estación
    "orgullo de oficio",     // los sellos son marcas de autor, no checkmarks
  ];

  visualPrinciples: [
    "El proceso es visible: draft / forjándose / sellado / bloqueado tienen materialidad distinta (forma+color), no solo un badge.",
    "Zonas de banco, no tarjetas: el lienzo se divide en superficies ancladas separadas por vetas y rules; la tarjeta flotante genérica está prohibida como contenedor default.",
    "Una sola fuente de calor: el cobre se reserva para lo activo/forjándose; lo sellado es frío; el cyan pertenece al OS, no a PixelForge.",
    "Jerarquía por ritmo tipográfico y densidad, no por multiplicar contenedores.",
    "La luz nace del proceso: glow solo durante generación IA y foco; nunca decorativo permanente.",
  ];

  signatureMotif: "La Veta (the seam)";
  // Traducción abstracta de 'algo se está forjando': una línea de luz continua
  // que recorre el proceso. En reposo es una veta tenue; durante la generación
  // IA fluye con calor contenido (gradiente cobre desplazándose); al sellar se
  // solidifica: se vuelve trazo sólido frío con la marca del sello. PROHIBIDO
  // el cliché literal: ni yunques, ni fuego, ni chispas, ni texturas metálicas.
  // Dónde aparece (con moderación, máx. una veta protagonista por vista):
  //  1. El riel del stepper ES la veta: conecta estaciones y se solidifica con el avance.
  //  2. Borde izquierdo (border-inline-start 2px) de la superficie/zona activa.
  //  3. Estados de generación IA: la veta fluye (animación de background-position).
  //  4. Sellado: la veta del artefacto pasa de fluida a sólida + estampa mono.
  //  5. Foco de teclado: anillo con el acento cobre (nunca reduce legibilidad).

  shapeLanguage: [
    "Planchas ancladas: radio 6px (menor que el rounded-xl global) — piezas asentadas en banco, no chips flotantes.",
    "Corte de esquina (notch 45°) como firma EXCLUSIVA de superficies selladas.",
    "Separación por vetas horizontales (1px, --pfx-seam) dentro de una zona; borde completo solo en el perímetro de la zona.",
    "Estados por forma: locked = contorno punteado; invalidated = veta discontinua ámbar.",
  ];

  typographyStrategy:
    "Poppins (ya cargada, 400–900) sigue siendo la voz: títulos de proyecto/estación " +
    "en 700/800 con tracking -0.02em y tamaño mayor al idiom admin. La marca del " +
    "taller es IBM Plex Mono (nueva, 400/500, cargada SOLO en el módulo vía " +
    "next/font en el layout de PixelForge): sellos, timestamps, metadata, evidencias, " +
    "chips técnicos y números (tabular). Cuerpo largo SIEMPRE Poppins 400 — la mono " +
    "jamás compone párrafos.";

  colorStrategy:
    "Cobre sobre carbón azulado. Dark-first: canvas carbón profundo con matiz azul " +
    "frío (distinto del #030303 neutro del OS), superficies como planchas apenas más " +
    "claras; acento COBRE (calor de forja) para acción/actividad; SELLADO en acero " +
    "frío azul-verdoso; glow ámbar SOLO en actividad IA. Light: taller a luz de día — " +
    "papel cálido, tinta carbón, cobre profundizado para AA. El cyan global NO es " +
    "acento de PixelForge. Todo par texto/fondo cumple WCAG AA (4.5:1; 3:1 large).";

  motionPrinciples: [
    "Calmado y material: micro-interacciones 180–260ms ease-out; nada >400ms.",
    "EXCEPCIÓN explícita al límite de 400ms: el flujo ambiente de la veta durante " +
    "generación IA es un loop lento (~2s) — señala trabajo async con calor contenido; " +
    "un flujo a velocidad de micro-interacción sería un estrobo. El límite de 400ms " +
    "aplica a transiciones que gatean la respuesta percibida, no al flujo ambiente.",
    "La veta fluye SOLO durante generación IA (background-position, GPU-safe).",
    "Sellar = asentar: scale 0.985→1 + solidificación de la veta (una vez, no loop).",
    "Transición entre estaciones: crossfade corto del contenido; el shell no se mueve.",
    "prefers-reduced-motion: todo estático; los estados siguen distinguibles por forma y color.",
  ];

  forbiddenPatterns: [
    "Yunques, martillos, fuego, chispas, texturas metálicas fotográficas.",
    "Gradientes naranjas decorativos o glow permanente.",
    "La tarjeta genérica rounded-xl border bg-card como contenedor default.",
    "Cyan como acento de identidad de PixelForge.",
    "Selects HTML nativos.",
    "Display font en cuerpos largos; mono en párrafos.",
    "Animaciones que bloqueen input o superen 400ms.",
  ];
}
```

## Tokens (namespace `--pfx-*`, scoped a `[data-product="pixelforge"]`)

> `--pf-*` está RESERVADO al render de landings (preview). El admin usa `--pfx-*`.
> Valores en HSL triple (idiom del shell) para composición con opacidad.

| Token | Dark (default del módulo) | Light | Rol |
|---|---|---|---|
| `--pfx-canvas` | `220 18% 6%` | `36 33% 96%` | Fondo del módulo (carbón azulado / papel cálido) |
| `--pfx-surface` | `219 16% 9%` | `0 0% 100%` | Plancha base |
| `--pfx-surface-elevated` | `218 15% 12%` | `36 20% 99%` | Plancha elevada (modal, popover, banco activo) |
| `--pfx-text` | `30 15% 94%` | `222 30% 10%` | Texto principal |
| `--pfx-text-muted` | `225 8% 62%` | `222 12% 42%` | Secundario / metadata |
| `--pfx-border` | `220 12% 17%` | `35 15% 86%` | Perímetro de zona |
| `--pfx-border-strong` | `220 10% 26%` | `35 12% 72%` | Perímetro enfatizado |
| `--pfx-seam` | `24 60% 38% / apagada` → usar `24 45% 30%` | `24 55% 55%` | La veta en reposo |
| `--pfx-accent` | `22 78% 58%` (cobre) | `20 72% 42%` | Acción, actividad, foco |
| `--pfx-accent-strong` | `24 85% 66%` | `18 78% 36%` | Hover/pressed del acento |
| `--pfx-on-accent` | `20 30% 8%` | `30 40% 97%` | Texto sobre acento |
| `--pfx-glow` | `32 90% 60%` | `28 85% 50%` | Halo de actividad IA (usar con alpha) |
| `--pfx-success` | `152 45% 55%` | `152 55% 30%` | Éxito |
| `--pfx-warning` | `40 85% 60%` | `36 90% 34%` | Aviso / invalidated |
| `--pfx-error` | `4 72% 60%` | `4 72% 42%` | Error / destructivo |
| `--pfx-forge-active` | `= accent` + glow | `= accent` | Estación/artefacto trabajándose |
| `--pfx-forge-sealed` | `196 35% 46%` (acero frío) | `200 45% 30%` | Sellado (frío, sólido) |
| `--pfx-forge-locked` | `222 8% 34%` | `222 8% 60%` | Bloqueado (apagado, punteado) |
| `--pfx-radius` | `6px` | `6px` | Radio de plancha |
| `--pfx-font-mono` | var de IBM Plex Mono | idem | Datos de forja |

Mecánica: el layout `src/app/(admin)/proyectos/pixelforge/layout.tsx` (NUEVO,
envuelve listado+nueva+[id]) monta `<div data-product="pixelforge">` + variable
de la fuente mono + importa `pixelforge-theme.css`. El CSS define los tokens bajo
`[data-product="pixelforge"]` y su variante `.dark [data-product="pixelforge"]`
(el tema global sigue mandando con la clase `.dark` de next-themes). Nada fuera
del wrapper cambia. El preview embebido vive en un iframe (documento aparte):
sin colisión de cascada con `--pf-*`.

## Iconografía (Lucide, stroke 2, un solo estilo)

Glifos semánticos fijos del módulo: Confirmado=`BadgeCheck` · Inferido=`Lightbulb`
· Faltante=`CircleDashed` · Contradicción=`TriangleAlert` · Evidencia=`Quote` ·
Riesgo=`ShieldAlert` · Sellado=`Stamp` · Reabierto=`RotateCcw` · Bloqueado=`Lock`
· Dirección=`Compass` · Motif=`Fingerprint` · Capability=`Puzzle` · Forja/IA
activa=`Flame` PROHIBIDO (usar `Sparkles` solo para IA global del OS; actividad
de forja usa la veta, no un icono de fuego).

## Estados canónicos (materialidad)

- **draft**: plancha con veta tenue en reposo; texto normal.
- **forging** (IA generando): veta fluyendo + glow ámbar suave en el perímetro; progreso con mono.
- **sealed**: plancha con notch de esquina + veta sólida acero + estampa `SELLADO · <fecha>` en mono; acciones de edición ocultas.
- **locked**: contorno punteado, contenido al 55% de opacidad, icono `Lock`; clic navega pero el panel explica el gate (no se rompe la navegación actual).
- **invalidated**: veta discontinua ámbar + aviso con `RotateCcw`.

## Stepper — "Riel de forja"

Horizontal, sticky (se conserva URL/navegación). Deja de ser círculos numerados:
un riel continuo (la veta) donde cada estación es un **segmento de material**:
- locked: segmento hueco punteado (forge-locked).
- active: segmento caliente — relleno cobre + glow, label siempre visible, `aria-current="step"`.
- sealed: segmento sólido acero con check grabado.
- invalidated: segmento con fisura ámbar (`RotateCcw`).
El progreso se lee como porción del riel solidificada. En móvil: riel compacto
(solo segmentos) + nombre de la estación actual bajo el riel. Contraste AA en
todos los estados (corrige el fallo AA del stepper actual).
