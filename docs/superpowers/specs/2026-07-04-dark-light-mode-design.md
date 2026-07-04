# Modo oscuro / modo claro con switch — Diseño

**Fecha:** 2026-07-04
**Estado:** Aprobado por Miguel (con ajustes incorporados)
**Alcance:** Sitio público + dashboard, ejecutado por fases con gates de aprobación

## Objetivo

Añadir modo claro y modo oscuro conmutables con un switch, en la página pública
y en el dashboard de PixelTEC. El modo claro NO debe verse como un dark mode
invertido: debe sentirse diseñado, limpio y premium, a la altura de la
identidad visual actual.

## Contexto actual

- Next.js App Router + Tailwind + shadcn/ui, `darkMode: ['class']`.
- `globals.css` ya define variables CSS para `:root` (light) y `.dark`, pero
  el light nunca se ha usado en producción.
- `src/app/layout.tsx:59` fuerza `className="dark"` en `<html>` — toda la app
  es dark-only hoy.
- **~160 de 283 archivos `.tsx` usan colores oscuros hardcodeados**
  (`bg-[#030303]`, `bg-zinc-900`, `bg-black`, `text-white`, gradientes fijos):
  ~121 en la parte pública, ~39 en `(admin)`. Estos NO reaccionan al switch
  hasta migrarlos a tokens semánticos.
- Scrollbars "dark premium" hardcodeados en `globals.css` (global, no por tema).
- `theme-color` del metadata hardcodeado a `#030303`.
- No hay `next-themes` instalado.

## Decisiones tomadas

| Decisión | Elección |
|---|---|
| Librería | `next-themes` (estándar shadcn/ui; resuelve persistencia, anti-flash e hidratación) |
| Tema default | `dark` siempre para visitantes nuevos (identidad de marca). `enableSystem` queda deshabilitado pero preparado para activarse en el futuro con un cambio de una línea |
| Persistencia | localStorage (manejado por next-themes) |
| Ubicación del switch | Header público (`src/components/header.tsx`) + header global del dashboard (`src/components/nav/global-header.tsx`) |
| Orden de migración | Fase 1 infraestructura → **gate de aprobación** → Fase 2 sitio público → Fase 3 dashboard |
| Estrategia de migración | Auditoría primero, componentes compartidos antes que páginas. Nunca archivo por archivo a ciegas |

## Arquitectura

### Fase 1 — Infraestructura + toggle + tokens base

**Gate: al terminar esta fase se muestra el resultado a Miguel. No se toca
ningún archivo de la migración masiva hasta su aprobación.**

1. **`next-themes`**: instalar. Crear `src/components/theme-provider.tsx`
   (client component wrapper). En `layout.tsx`: quitar `dark` hardcodeado del
   `<html>`, añadir `suppressHydrationWarning`, envolver children con
   `<ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>`.
   Activar system en el futuro = cambiar `enableSystem` a `true`.
2. **`ThemeToggle`** (`src/components/theme-toggle.tsx`): botón sol/luna
   consistente con la UI actual (Radix + lucide, estilo de los botones ghost
   del proyecto). Renderiza un placeholder neutro hasta `mounted` para evitar
   hydration mismatch. Se monta en el header público y en el header global
   del dashboard.
3. **`globals.css`**: los scrollbars hardcodeados pasan a usar
   `hsl(var(--muted-foreground) / …)` para que se vean correctos en ambos
   temas. Revisión y pulido de la paleta light de `:root` para que el modo
   claro base se sienta premium (fondos con calidez neutra, borders sutiles,
   sombras suaves) y no un simple invertido.
4. **`theme-color`**: se actualiza client-side según el tema activo (un
   `useEffect` en el ThemeProvider que ajusta la meta tag), en lugar del
   `#030303` fijo. Las media queries no sirven aquí porque el tema es por
   clase, no por preferencia del sistema.

### Fase 2 — Sitio público (post-aprobación del gate)

1. **Auditoría de colores hardcodeados** (script de grep + informe): agrupar
   los ~121 archivos públicos por patrón, no por página:
   - fondos oscuros (`bg-[#030303]`, `bg-black`, `bg-zinc-9xx`)
   - textos blancos (`text-white`, `text-zinc-100/200`)
   - borders zinc/slate (`border-zinc-800`, `border-white/10`)
   - gradientes (`from-[#0…]`, `via-black`, overlays)
   - cards y superficies elevadas
   - hover states (`hover:bg-zinc-800`, `hover:text-white`)
   - badges/chips/pills
   El informe define el mapeo patrón → token semántico antes de tocar código.
2. **Componentes compartidos primero**: header, footer, cards, botones,
   secciones reutilizables (`src/components/`). Migrar aquí arregla muchas
   páginas de golpe y evita duplicar trabajo.
3. **Páginas por bloque**: home → services/industrias → blog/guías →
   about/contact/equipo → legales. Verificación visual en ambos temas al
   cerrar cada bloque.
4. Assets que solo funcionan sobre fondo oscuro (logos, imágenes con fondo):
   se detectan en la revisión visual y se resuelven caso por caso (variante
   clara, fondo neutro, o `dark:`/`light:` condicional).

### Fase 3 — Dashboard (al final, con el sistema de tokens ya estable)

Mismo proceso que Fase 2 sobre los ~39 archivos de `(admin)`: auditoría →
layout/sidebar/header compartidos → módulos uno por uno (CRM, WhatsApp,
workspace, VPS…). El dashboard va al final deliberadamente: mayor riesgo
visual y funcional, y no se toca hasta que el sistema de tokens haya probado
ser estable en el sitio público.

## Regla de calidad

El modo claro debe sentirse **diseñado, no invertido**: paleta light propia
(no el negativo del dark), contraste AA en textos, sombras y borders pensados
para fondo claro, y coherencia entre secciones. Si un bloque migrado se ve
"lavado" o genérico en claro, se ajusta antes de cerrar el bloque.

## Validación por fase

- `npm run typecheck` (el repo usa npm, no pnpm)
- `npm run build`
- Revisión visual desktop y mobile en ambos temas
- Sin flash de tema incorrecto al cargar / recargar
- El toggle no genera hydration mismatch (consola limpia)
- Verificación funcional de formularios, cards, botones, navbar y footer

## Fuera de alcance (por ahora)

- Detección automática de `prefers-color-scheme` (preparada, no activada)
- Sincronización de la preferencia de tema en Firestore por usuario
- Temas adicionales más allá de light/dark
