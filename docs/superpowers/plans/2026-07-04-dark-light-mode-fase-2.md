# Modo Oscuro/Claro — Fase 2: Sistema Visual Dual Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el switch técnico de Fase 1 en un sistema visual dual real: dark premium PixelTEC intacto + light premium con identidad propia (limpio, cálido, buen contraste), migrando colores hardcodeados a tokens semánticos en componentes compartidos, secciones principales del sitio público y núcleo del dashboard.

**Architecture:** Migración por patrones (no archivo por archivo): primero tokens base en `globals.css` (paleta light cálida), luego componentes compartidos (arreglan muchas páginas de golpe), luego secciones visibles principales, con `dark:` variants SOLO donde un tema exige tratamiento distinto (glows, overlays sobre imagen). El dark actual es la referencia: no debe cambiar visualmente.

**Tech Stack:** Tailwind semantic tokens (shadcn), next-themes ya instalado (Fase 1 en rama `feat/theme-mode`).

## Global Constraints

- Brief de Miguel (2026-07-04) = especificación. Criterios de aceptación al final de este plan son vinculantes.
- **GATE DE CIERRE (Miguel):** no se da por terminado sin capturas lado a lado de Home light/dark y Dashboard light/dark que se vean intencionales, legibles y premium.
- **Dark mode NO debe cambiar visualmente** (identidad actual). En dark, cada migración debe renderizar igual o imperceptiblemente distinto.
- PROHIBIDO "agregar `dark:` por todos lados sin criterio": el default de cada clase es el token semántico; `dark:` solo para tratamientos intencionales por tema.
- Texto sobre imágenes u overlays oscuros que persisten en ambos temas: mantener `text-white` (única excepción legítima).
- npm; typecheck + build como sanity por tarea; commit por tarea en rama `feat/theme-mode`. NUNCA deploy ni push sin OK.
- Auditoría completa en `.superpowers/sdd/audit-fase2.md` (generada en Task 1).

## Mapa de migración (vinculante, del brief de Miguel)

| Patrón hardcodeado | Token destino |
|---|---|
| `bg-[#030303]`, `bg-black`, `bg-zinc-950/900`, `bg-neutral-950` | `bg-background` (página) o `bg-card` (superficie) |
| Superficies elevadas `bg-white/5`, `bg-zinc-800/900` en cards | `bg-card text-card-foreground` o `bg-muted/40` |
| Overlays oscuros | variantes explícitas light/dark (`bg-background/80 dark:bg-black/60`…) |
| `text-white` | `text-foreground` (o mantener sobre imagen/overlay oscuro persistente) |
| `text-zinc-100/200`, `text-gray-100` | `text-foreground` o `text-muted-foreground` según jerarquía |
| grises secundarios (`text-zinc-400/500`, `text-gray-300`) | `text-muted-foreground` |
| `border-white/10`, `border-zinc-800/700` | `border-border` (divisores: `border-border/60`) |
| Cards: sombras | `shadow-sm`/`shadow-md` en light, glow sutil solo `dark:` |
| Botones negros | jerarquía de marca: primary/foreground según rol; CTAs (WhatsApp, Agendar) mantienen jerarquía en ambos temas |
| Gradientes oscuros fijos | variante light (fondos suaves, azul muy sutil, neutral warm) + variante dark (glow azul/cyan sobre negro) vía `dark:` |
| `hover:bg-white/10`, `hover:bg-zinc-800`, `hover:text-white` | `hover:bg-accent hover:text-foreground` / `hover:text-accent-foreground` |
| Glows/shadows que solo funcionan en dark | envolver en `dark:`; en light usar sombra neutra suave o nada |

## Tareas

### Task 1: Auditoría completa + paleta light cálida (tokens base)

**Files:**
- Create: `.superpowers/sdd/audit-fase2.md` (informe de auditoría)
- Modify: `src/app/globals.css` (solo bloque `:root`)

Auditoría: correr los greps de patrones (fondos negros, texto blanco, bordes dark, gradientes, hovers, glows, superficies zinc) sobre `src/` y volcar a `audit-fase2.md`: conteos por patrón, top archivos, y clasificación en 4 grupos: (A) compartidos públicos, (B) secciones home/páginas principales, (C) dashboard core, (D) pendientes fuera de alcance de esta fase.

Paleta light: Miguel pide light "limpio, cálido, premium". La paleta Fase 1 usó tinte frío 210-214°; corregir a neutral cálido manteniendo el azul de marca:

```css
  :root {
    --background: 40 20% 97%;   /* warm off-white premium */
    --foreground: 224 40% 8%;
    --card: 0 0% 100%;
    --card-foreground: 224 40% 8%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 40% 8%;
    --primary: 207 90% 54%;
    --primary-foreground: 0 0% 98%;
    --secondary: 40 15% 93%;
    --secondary-foreground: 224 40% 10%;
    --muted: 40 15% 92%;
    --muted-foreground: 220 9% 38%;
    --accent: 40 15% 92%;
    --accent-foreground: 224 40% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 40 12% 87%;
    --input: 40 12% 87%;
    --ring: 207 90% 54%;
    --radius: 0.5rem;
    /* charts y sidebar-* light: sidebar-background 40 20% 97%, sidebar-accent 40 15% 93%, sidebar-border 40 12% 88%; resto sin cambios */
  }
```

(Los valores exactos pueden ajustarse ±2-3% en la verificación visual; la intención — warm neutral, cards blancas, borders suaves cálidos, azul de marca intacto — es vinculante. `.dark` NO se toca.)

Verificación: typecheck + captura light de /login para sanity del tono. Commit.

### Task 2: Componentes compartidos públicos

**Files (Modify):** `src/components/header.tsx`, `src/components/ui/footer-section.tsx`, `src/components/ui/shiny-button.tsx`, `src/components/ui/social-links.tsx`, `src/components/ui/animated-menu.tsx`, `src/components/ui/tech-stack-marquee.tsx`, `src/components/ui/liquid-glass-button.tsx`, `src/components/ui/contact-card.tsx`, `src/components/ui/testimonial-card.tsx`

Aplicar el mapa. Decisiones específicas:
- **Header:** scrolled: `bg-background/85 backdrop-blur-md border-b border-border` (dark rinde igual que hoy). Logo "Pixel": `text-foreground`. Nav links: `text-muted-foreground hover:text-primary`. Hamburger `bg-[#f1faee]` → `bg-foreground`. Sheet mobile: `bg-background/90` + `border-border`.
- **Footer:** decisión explícita = footer claro en light (fondo `bg-muted/40`, `border-t border-border`, textos foreground/muted-foreground); en dark exactamente como hoy (vía tokens que en dark resuelven a lo mismo, o `dark:` puntual).
- **ShinyButton/CTAs:** mantener identidad de marca en ambos temas; el shine/glow fuerte solo `dark:`; en light versión con `shadow-md` y borde definido. WhatsApp CTA siempre alta jerarquía.

Verificación: typecheck + build. Commit.

### Task 3: Home completa (hero + secciones)

**Files (Modify):** `src/components/ui/shape-landing-hero.tsx`, `src/components/ui/about-wave-section.tsx` (+ `wave-path.tsx` si hace falta), `src/components/ui/interactive-image-accordion.tsx`, `src/components/sections/benefits.tsx`, `src/components/sections/testimonials.tsx` (+ `testimonials-with-marquee.tsx`), `src/components/sections/contact.tsx`, `src/components/ui/newsletter-section.tsx`

Decisiones específicas:
- **Hero:** en light NO puede quedar blanco con texto invisible: fondo claro premium (warm off-white con formas geométricas en azul muy sutil/neutral), título `text-foreground` con "Digital"/acentos en azul de marca, badge y glows adaptados (`dark:` para el glow cyan actual). En dark idéntico a hoy.
- **Secciones:** fondos alternos light (`bg-background` / `bg-muted/40`) para ritmo visual; textos por jerarquía; gradientes con variante light suave.
- **Newsletter/Contact:** inputs y cards con tokens (`bg-card`, `border-border`, `placeholder:text-muted-foreground`).

Verificación: typecheck + build. Commit.

### Task 4: Dashboard core

**Files (Modify):** `src/app/(admin)/layout.tsx` (Shell), `src/components/nav/desktop-sidebar.tsx`, `src/components/nav/global-header.tsx`, `src/components/nav/user-menu.tsx`, `src/components/nav/notifications-menu.tsx`, `src/components/nav/command-palette.tsx`, `src/components/dashboard/PageHeader.tsx`, `src/components/crm/ClientsView.tsx`

Decisiones específicas:
- **Shell:** `bg-[#030303] text-zinc-100` → `bg-background text-foreground`. Ambient gradient: mantener en dark; en light versión muy sutil (azul 3-4% de opacidad) o ninguna.
- **Sidebar:** `bg-card` o `bg-muted/60` en light con `border-r border-border`; items activos con acento azul/cyan de marca en ambos temas; hovers `hover:bg-accent`.
- **Global header:** pills/botones (`bg-white/5 border-white/10 text-zinc-400`) → `bg-secondary/60 border-border text-muted-foreground hover:text-foreground hover:bg-secondary` (patrón del ThemeToggle de Fase 1). kbd ⌘K con tokens.
- **ClientsView (dashboard clientes):** cards `bg-card border-border shadow-sm` (glow solo dark), textos por jerarquía, filtros/inputs con tokens, badges con variantes por tema si usan fondos oscuros fijos.
- Look objetivo light: SaaS premium (fondo warm-neutral, superficies blancas, acentos cyan/azul PixelTEC). No dejar bloques negros no intencionales.

Verificación: typecheck + build. Commit.

### Task 5: Páginas públicas principales restantes

**Files (Modify):** `src/app/services/page.tsx`, `src/app/services/[slug]/service-detail-client.tsx`, `src/app/contact/page.tsx` (y componentes propios que importen si tienen hardcode)

Mismo mapa y criterios. Blog, about, equipo, industrias, guías y legales quedan PENDIENTES (documentar en el informe final). Verificación: typecheck + build. Commit.

### Task 6: Validación final + entrega (GATE de capturas)

1. `npm run typecheck` + `npm run build` en verde.
2. Playwright contra build de producción: capturas light/dark desktop y mobile de home, /services, /contact; verificación de: sin texto blanco sobre fondo claro (revisión visual de capturas), sin secciones oscuras accidentales en light, sin flash, sin hydration errors, scrollbars correctos.
3. Dashboard autenticado: requiere credenciales de Miguel o captura suya — si no hay, capturar /login + solicitar validación de Miguel con el dev server.
4. Componer imágenes lado a lado (light|dark) de Home y Dashboard.
5. Informe final: archivos modificados, patrones corregidos (conteos antes/después del audit), pendientes, guía de verificación visual.

## Criterios de aceptación (vinculantes, del brief)

- Light: sin texto blanco sobre fondo claro; sin secciones oscuras accidentales; identidad propia limpia/cálida/premium.
- Dark: sin cambios visuales perceptibles.
- Dashboard: cambio real y premium entre temas.
- Sin flash, sin hydration mismatch, scrollbars correctos.
- Capturas lado a lado Home y Dashboard aprobables como "intencionales, legibles y premium".
