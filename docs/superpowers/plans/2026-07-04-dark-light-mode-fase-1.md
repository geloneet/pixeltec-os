# Modo Oscuro/Claro — Fase 1: Infraestructura + Switch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar la infraestructura de theming (next-themes), un ThemeToggle en el header público y en el header del dashboard, scrollbars tematizados y paleta light pulida — sin migrar ningún color hardcodeado.

**Architecture:** next-themes con `attribute="class"` sobre el sistema de variables CSS shadcn ya existente en `globals.css`. Un `ThemeProvider` client-side envuelve la app en `layout.tsx` (que hoy fuerza `dark` en `<html>`); un `ThemeToggle` con guard de `mounted` evita hydration mismatch; un `ThemeColorSync` actualiza la meta tag `theme-color` según el tema activo.

**Tech Stack:** Next.js 15 App Router, next-themes, Tailwind (`darkMode: ['class']`), shadcn/ui, lucide-react.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-04-dark-light-mode-design.md`
- `defaultTheme="dark"`, `enableSystem={false}` (preparado para activar system después con una línea).
- **PROHIBIDO en esta fase:** migrar colores hardcodeados (`bg-[#030303]`, `bg-zinc-900`, `text-white`, etc.) en cualquier archivo que no esté listado en las tareas. Eso es Fase 2/3 y requiere gate de aprobación de Miguel.
- El repo usa **npm** (no pnpm): `npm run typecheck`, `npm run build`, `npm run dev` (puerto 9002).
- No hay framework de tests unitarios en el repo; la validación es typecheck + build + verificación visual/funcional en dev server (así lo define el spec).
- Copy y aria-labels en español (convención del proyecto).
- Es esperado que en modo claro el sitio se vea "mezclado" durante Fase 1 (heros y secciones siguen oscuros por los colores hardcodeados). El criterio de éxito de Fase 1 es que la infraestructura funcione, no que todo el sitio se vea bien en claro.
- NUNCA hacer deploy al VPS (regla permanente de Miguel).

---

### Task 1: next-themes + ThemeProvider + integración en layout

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `package.json` (dependencia nueva)

**Interfaces:**
- Produces: `ThemeProvider({ children })` exportado desde `@/components/theme-provider`. Internamente monta next-themes con `attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange` y un `ThemeColorSync` que sincroniza la meta tag `theme-color` (`#FAFAFA` en light, `#030303` en dark).
- Consumes: nada de tareas previas.

- [ ] **Step 1: Instalar next-themes**

```bash
cd /home/ubuntu/pixeltec-os && npm install next-themes
```

Expected: `added 1 package` sin errores.

- [ ] **Step 2: Crear el ThemeProvider**

Crear `src/components/theme-provider.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

/**
 * Mantiene la meta tag theme-color alineada con el tema activo.
 * No puede ser media query en metadata porque el tema es por clase
 * (toggle manual), no por prefers-color-scheme.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!resolvedTheme) return;
    const color = resolvedTheme === 'light' ? '#FAFAFA' : '#030303';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 3: Integrar en el layout raíz**

En `src/app/layout.tsx`:

3a. Añadir el import junto a los demás:

```tsx
import { ThemeProvider } from '@/components/theme-provider';
```

3b. Reemplazar la línea 59 (el `<html>` que fuerza dark):

```tsx
// ANTES:
<html lang="es-MX" className={cn('dark scroll-smooth', poppins.variable, roboto.variable, leagueSpartan.variable)}>

// DESPUÉS (se quita 'dark', se añade suppressHydrationWarning porque
// next-themes muta className de <html> antes de la hidratación):
<html lang="es-MX" className={cn('scroll-smooth', poppins.variable, roboto.variable, leagueSpartan.variable)} suppressHydrationWarning>
```

3c. Envolver el contenido del `<body>` con ThemeProvider (todo lo que ya está adentro queda igual, solo se envuelve):

```tsx
<body className={cn('font-body antialiased min-h-screen bg-background text-foreground')}>
  <ThemeProvider>
    <OrganizationStructuredData />
    <FirebaseClientProvider>
      {children}
      <Toaster />
    </FirebaseClientProvider>
  </ThemeProvider>
</body>
```

NO tocar el bloque `other: { 'theme-color': '#030303' }` del metadata: sirve
como valor inicial correcto para el default dark; `ThemeColorSync` lo
actualiza client-side cuando el tema cambia.

- [ ] **Step 4: Verificar typecheck**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck
```

Expected: exit 0, sin errores.

- [ ] **Step 5: Verificar en dev server que el default sigue siendo dark**

```bash
cd /home/ubuntu/pixeltec-os && npm run dev
```

Abrir `http://localhost:9002` con un navegador (Playwright del skill
webapp-testing sirve). Verificar:
- `document.documentElement.classList.contains('dark')` es `true`.
- `localStorage.getItem('theme')` es `null` o `"dark"` (visitante nuevo → dark).
- La página se ve idéntica a como se veía antes del cambio (dark premium).
- Consola sin errores de hidratación.

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/pixeltec-os && git add package.json package-lock.json src/components/theme-provider.tsx src/app/layout.tsx && git commit -m "feat(theme): infraestructura next-themes con default dark y theme-color dinamico"
```

---

### Task 2: ThemeToggle montado en header público y header del dashboard

**Files:**
- Create: `src/components/theme-toggle.tsx`
- Modify: `src/components/header.tsx` (header público, desktop + mobile)
- Modify: `src/components/nav/global-header.tsx` (header del dashboard)

**Interfaces:**
- Consumes: `ThemeProvider` de Task 1 (debe estar montado en el layout; `useTheme()` de next-themes lo requiere).
- Produces: `ThemeToggle({ className? })` exportado desde `@/components/theme-toggle`. Botón circular sol/luna con tokens semánticos, seguro contra hydration mismatch.

- [ ] **Step 1: Crear el componente ThemeToggle**

Crear `src/components/theme-toggle.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Antes de montar no sabemos el tema real (SSR): asumimos dark (el
  // default del sitio) y ocultamos el icono para no pintar el incorrecto.
  const isDark = !mounted || resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={cn(
        'flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full',
        'border border-border bg-secondary/60 text-muted-foreground backdrop-blur-md',
        'hover:text-foreground hover:bg-secondary transition-all duration-200',
        className
      )}
    >
      {isDark ? (
        <Sun className={cn('w-4 h-4', !mounted && 'opacity-0')} />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Montarlo en el header público (desktop)**

En `src/components/header.tsx`:

2a. Añadir el import:

```tsx
import { ThemeToggle } from './theme-toggle';
```

2b. Reemplazar el bloque desktop del CTA de WhatsApp (líneas 125–132) para
que el toggle quede junto al botón:

```tsx
// ANTES:
<div className="hidden lg:block">
  <a href="https://api.whatsapp.com/send?phone=523221378336&text=Hola,%20quiero%20informaci%C3%B3n." target="_blank" rel="noopener noreferrer">
    <ShinyButton>
        <Phone className="h-5 w-5" />
        WhatsApp
    </ShinyButton>
  </a>
</div>

// DESPUÉS:
<div className="hidden lg:flex items-center gap-4">
  <ThemeToggle />
  <a href="https://api.whatsapp.com/send?phone=523221378336&text=Hola,%20quiero%20informaci%C3%B3n." target="_blank" rel="noopener noreferrer">
    <ShinyButton>
        <Phone className="h-5 w-5" />
        WhatsApp
    </ShinyButton>
  </a>
</div>
```

- [ ] **Step 3: Montarlo en el header público (mobile)**

En el mismo archivo, el contenedor mobile (línea 134) pasa de solo hamburger
a toggle + hamburger:

```tsx
// ANTES:
<div className="lg:hidden">
    <AnimatedHamburger isOpen={isMenuOpen} onClick={() => setIsMenuOpen(true)} />

// DESPUÉS:
<div className="lg:hidden flex items-center gap-3">
    <ThemeToggle />
    <AnimatedHamburger isOpen={isMenuOpen} onClick={() => setIsMenuOpen(true)} />
```

El resto del bloque (Sheet, menú mobile) no se toca.

- [ ] **Step 4: Montarlo en el header del dashboard**

En `src/components/nav/global-header.tsx`:

4a. Añadir el import:

```tsx
import { ThemeToggle } from "@/components/theme-toggle";
```

4b. En el bloque RIGHT (líneas 52–71), insertar el toggle entre el botón de
búsqueda y `<NotificationsMenu />`:

```tsx
        <NotificationsMenu />

// se convierte en:

        <ThemeToggle />
        <NotificationsMenu />
```

(Queda: botón Buscar → ThemeToggle → NotificationsMenu → UserMenu.)

- [ ] **Step 5: Verificar typecheck**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Verificación funcional en dev server**

Con `npm run dev` corriendo, en `http://localhost:9002`:
- El toggle aparece en el header público (desktop y viewport mobile).
- Click en el toggle: `<html>` pierde/gana la clase `dark`, los fondos que
  usan tokens (`bg-background`) cambian, `localStorage.theme` alterna
  entre `"light"` y `"dark"`.
- Recargar en modo light: la página carga en light sin flash dark→light.
- En `/portal` o cualquier ruta del dashboard (requiere login): el toggle
  aparece en el header global y funciona igual. Si no hay credenciales de
  prueba disponibles, verificar al menos que la ruta compila y el header
  se renderiza (el componente es el mismo ya probado en público).
- Consola sin warnings de hydration mismatch.

- [ ] **Step 7: Commit**

```bash
cd /home/ubuntu/pixeltec-os && git add src/components/theme-toggle.tsx src/components/header.tsx src/components/nav/global-header.tsx && git commit -m "feat(theme): ThemeToggle sol/luna en header publico y header del dashboard"
```

---

### Task 3: Scrollbars tematizados en globals.css

**Files:**
- Modify: `src/app/globals.css:89-111` (scrollbars globales) y `:135-153` (`.scrollbar-soft`)

**Interfaces:**
- Consumes: variables CSS `--muted-foreground` ya definidas en `:root` y `.dark`.
- Produces: scrollbars que se adaptan al tema activo (nada exportado a código TS).

- [ ] **Step 1: Tematizar los scrollbars globales**

En `src/app/globals.css`, reemplazar el bloque de scrollbars globales
(líneas 89–111) — los rgba fijos de zinc pasan a la variable de tema:

```css
  /* Scrollbars premium tematizados: delgados y discretos en ambos temas,
     nunca la barra nativa gruesa del navegador. */
  * {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.35) transparent;
  }
  *::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
  *::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.35);
    border-radius: 9999px;
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: hsl(var(--muted-foreground) / 0.55);
  }
  *::-webkit-scrollbar-corner {
    background: transparent;
  }
```

- [ ] **Step 2: Tematizar `.scrollbar-soft`**

En el mismo archivo, dentro del bloque `.scrollbar-soft` (líneas 135–153),
reemplazar solo los valores de color (la estructura queda igual):

```css
  .scrollbar-soft {
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
  .scrollbar-soft::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .scrollbar-soft::-webkit-scrollbar-track {
    background: transparent;
  }
  .scrollbar-soft::-webkit-scrollbar-thumb {
    background-color: hsl(var(--muted-foreground) / 0.3);
    border-radius: 9999px;
  }
  .scrollbar-soft::-webkit-scrollbar-thumb:hover {
    background-color: rgba(34, 211, 238, 0.4); /* cyan-400: acento de marca en hover */
  }
```

- [ ] **Step 3: Verificación visual**

Con dev server corriendo: en dark los scrollbars se ven igual que antes
(finos, grises discretos); al cambiar a light con el toggle, el thumb se ve
gris medio sobre fondo claro (no blanco invisible ni negro duro).

- [ ] **Step 4: Commit**

```bash
cd /home/ubuntu/pixeltec-os && git add src/app/globals.css && git commit -m "fix(theme): scrollbars tematizados con variables en vez de grises fijos"
```

---

### Task 4: Pulido de la paleta light base

**Files:**
- Modify: `src/app/globals.css:6-40` (bloque `:root`)

**Interfaces:**
- Consumes: nada.
- Produces: paleta light refinada usada por todos los tokens Tailwind (`bg-background`, `bg-card`, `border-border`, etc.). El bloque `.dark` NO se toca.

- [ ] **Step 1: Refinar las variables light de `:root`**

La paleta light actual nunca se usó en producción y es gris plano (0 0%).
Para que el modo claro se sienta diseñado y no un invertido, las superficies
y borders adoptan un tinte frío muy sutil (220°, coherente con el azul de
marca `#2196F3`) y el texto secundario sube de contraste (AA). Reemplazar el
bloque `:root` (líneas 6–40) por:

```css
  :root {
    --background: 210 20% 98%; /* off-white con tinte frío sutil */
    --foreground: 224 71% 4%;
    --card: 0 0% 100%;
    --card-foreground: 224 71% 4%;
    --popover: 0 0% 100%;
    --popover-foreground: 224 71% 4%;
    --primary: 207 90% 54%; /* #2196F3 */
    --primary-foreground: 0 0% 98%;
    --secondary: 214 15% 93%;
    --secondary-foreground: 224 71% 4%;
    --muted: 214 15% 92%;
    --muted-foreground: 220 9% 38%; /* AA sobre background */
    --accent: 214 15% 92%;
    --accent-foreground: 224 71% 4%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 214 15% 88%;
    --input: 214 15% 88%;
    --ring: 207 90% 54%; /* #2196F3 */
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
    --sidebar-background: 210 20% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 214 15% 93%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 214 15% 89%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
```

El bloque `.dark` (líneas 42–75) queda intacto: el dark actual es la
identidad de marca y no cambia en esta fase.

- [ ] **Step 2: Verificación visual en ambos temas**

Con dev server corriendo:
- En dark: cero cambios visuales (solo se tocó `:root`, que dark sobreescribe).
- En light: fondo off-white con tinte frío sutil (no gris plano), cards
  blancas con borders visibles pero suaves, texto secundario legible.
  Verificar en la home y en `/login` (página con formulario que usa tokens).

- [ ] **Step 3: Commit**

```bash
cd /home/ubuntu/pixeltec-os && git add src/app/globals.css && git commit -m "feat(theme): paleta light refinada con tinte frio y contraste AA"
```

---

### Task 5: Validación final de Fase 1 (checklist del spec)

**Files:**
- Ninguno nuevo; solo verificación. Si algo falla, se arregla y se re-verifica antes de cerrar la fase.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia (salidas de comandos + screenshots) para presentar a Miguel en el gate de aprobación.

- [ ] **Step 1: Typecheck y build de producción**

```bash
cd /home/ubuntu/pixeltec-os && npm run typecheck && npm run build
```

Expected: ambos exit 0. El build de Next debe completar sin errores ni
warnings nuevos de prerender.

- [ ] **Step 2: Verificación anti-flash**

Con `npm run dev` (o `npm start` tras el build) y un navegador:
1. Cambiar a light con el toggle, recargar 3 veces → la página pinta light
   directo, sin frame dark inicial.
2. Cambiar a dark, recargar 3 veces → pinta dark directo, sin frame light.
3. Ventana de incógnito (sin localStorage) → carga dark (default de marca).

- [ ] **Step 3: Verificación de hydration**

Con la consola del navegador abierta, cargar home, `/blog`, `/contact` y una
ruta del dashboard en ambos temas. Expected: cero errores/warnings de
hydration mismatch (buscar "Hydration" y "did not match" en consola).

- [ ] **Step 4: Verificación funcional desktop y mobile**

En viewport desktop (1440px) y mobile (390px), en ambos temas:
- Navbar público: links, logo, toggle, hamburger y menú mobile funcionan.
- Footer: se renderiza sin roturas de layout.
- Formulario de `/contact`: inputs, labels y botón de envío visibles y usables.
- Cards y botones en home: clickeables, sin texto invisible por contraste
  (se tolera que secciones hardcodeadas sigan oscuras en light — es Fase 2).

- [ ] **Step 5: Capturar screenshots para el gate**

Screenshots en ambos temas (desktop y mobile) de: home, header con toggle,
`/login`, y una ruta del dashboard. Guardarlos en el scratchpad de la sesión
para presentárselos a Miguel.

- [ ] **Step 6: Presentar resultado a Miguel — GATE**

Reportar: qué se hizo, salidas de typecheck/build, screenshots, y qué se ve
"mezclado" en light por los hardcodeados pendientes. **NO iniciar Fase 2 ni
tocar colores hardcodeados hasta que Miguel apruebe explícitamente.**
