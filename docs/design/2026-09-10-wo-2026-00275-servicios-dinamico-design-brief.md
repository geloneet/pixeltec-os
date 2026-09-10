# Design Brief — Servicios dinámicos + CTA WhatsApp (WO-2026-00275)

Departamento: Diseño y Marca · Pipeline `/diseno` (R-DM-001) · 2026-09-10
Entidad: Pixeltec.mx (home, sección `#services` + header)

## 0 · Contexto y referencia

- Brief de Miguel (literal, es el encargo): «el botón de whatsapp carga de forma rara,
  primero carga el texto y luego el botón no tiene una animación como tal solo un
  flashazo en las fotos de servicios, quiero que se convierta los 3 en algo dinamico y
  unico […] en vez de la foto de automatización con ia, quiero que el fondo sea la
  simulación de un WhatsApp agent con IA pero que este trabajando de forma real […]
  Desarrollo web y apps quiero que de igual forma sea una construcción de un sitio y una
  app en tiempo real […] creada con puro codigo algo único […] y el consultoria que salga
  una animación de un monito dando una consultoria […] logra algo anormal».
- Referencia visual: el propio sitio (no hay kit externo nuevo). Estudiado en código:
  `globals.css` (tokens `--brand` cian #22D3EE en dark / #1463B8 en claro, `--glow`,
  fondo #030303), `GlowCard glowColor="cyan"` (tono 195→245, nunca morado — ADR-0014),
  CTA pill negro con shine cónico #2196F3, Poppins como única tipografía de UI.
- ADR aplicable: ADR-0014 `[Documentado en NeuroPIXEL]` — «cian controlado: acentos y
  estados vivos únicamente, nunca superficies grandes»; «movimiento con propósito».
- Referencia de vocabulario ya existente en el repo: `pixelbot-conversation-demo.tsx`
  (burbujas bot = cian/15 con borde cian/20, cliente = blanco/5, handoff = esmeralda,
  «Conversación de demostración con datos ficticios»). Las escenas nuevas hablan ese
  mismo idioma para que el sitio se sienta un solo sistema.

## 1 · Dirección estética (frontend-design)

**Tres ventanas de la misma sala de operaciones.** Las tarjetas dejan de ser fotos con
velo negro y se vuelven tres monitores de PixelTEC trabajando *ahora*: un agente de
WhatsApp resolviendo una conversación, un editor que construye un sitio y una app al
mismo tiempo, y la mascota PIX presentando un diagnóstico que se ordena solo. Lo que las
hace distintivas: todo se dibuja con trazos de 1 px sobre negro frío (#06080d), el cian
aparece solo donde algo está vivo (cursor, llamada a función, bloque recién construido,
nodo reordenado), y las tres comparten una franja superior monoespaciada `● en vivo ·
simulación` con reloj — la firma que las une y que declara honestamente que son datos
ficticios.

**Prohibido en esta pieza:** iconos flotando, partículas/«red neuronal» genérica,
gradientes morados, glassmorphism decorativo, tipografías nuevas (ni Orbitron ni mono
de marca — se descarta la propuesta automática de ui-ux-pro-max «Organic Biophilic +
Orbitron/JetBrains Mono» por contradecir el brief y ADR-0014), loops evidentes de 2 s,
video/gif/stock.

**Riesgo estético que se asume:** la mascota. Un personaje puede salir infantil; se
resuelve construyéndolo con la misma gramática geométrica de las otras dos escenas
(cabeza = píxel redondeado con trazo cian, ojos que parpadean, un brazo que señala), de
modo que no es un clip-art sino un elemento del sistema.

## 2 · Criterio (ui-ux-pro-max — reglas tomadas, propuesta de estilo rechazada)

- Estilo: **el del sitio** — dark tech sobrio, superficies negras, acento cian→azul.
- Paleta de escena (roles): fondo `#06080d`; retícula 24 px blanco/2.5 %; trazo
  blanco/12 %; texto secundario blanco/55 %; **vivo** cian `#22D3EE`; **estructura**
  azul `#3B82F6`; **éxito** esmeralda `#34D399`; **problema** ámbar `#F59E0B` (solo en
  el diagnóstico, para el «antes»). Contraste del texto real de la tarjeta (título/preview
  blanco sobre gradiente negro/80) se conserva porque el gradiente inferior se mantiene.
- Tipografía: Poppins (UI de las escenas) + `ui-monospace` del sistema (código,
  payloads, reloj). Nada nuevo se carga.
- Reglas UX aplicadas: solo `transform`/`opacity` (+ `pathLength` SVG); reduced-motion =
  escena final estática (más suave, no cero); datos ficticios declarados; arranque solo
  al entrar al viewport y pausa al salir o al ocultar la pestaña (presupuesto de hilo
  principal); sin alterar tamaño de tarjeta (CLS 0).

## 3 · Las tres escenas (dirección, no implementación)

1. **Automatización con IA — «WhatsAgent trabajando».** Chat a la izquierda + consola
   del agente a la derecha. El cliente escribe → indicador «escribiendo…» → la consola
   arma carácter a carácter una `tool.call crm.buscar_cliente({...})`, resuelve con
   `200 · 84ms` y el resultado se convierte en la respuesta del agente (tipeada por
   palabras). Segunda herramienta `calendario.agendar` → tarjeta de cita dentro del chat →
   `resuelto · sin handoff`. Tres conversaciones distintas (dentista, taller, inmobiliaria)
   rotan para que no se lea como loop.
2. **Desarrollo Web & Apps — «El plano se vuelve producto».** Un editor de una línea
   escribe tokens (`<Header />`, `<Hero />`, `grid 3`, `TabBar 4`) y cada línea
   materializa el bloque *a la vez* en una ventana de navegador y en un teléfono: primero
   trazo punteado (wireframe que se dibuja), luego relleno sólido con acento cian. Cierra
   con score de rendimiento contando a 100 y `deploy ✓`. Tres layouts (landing,
   e-commerce, dashboard) rotan.
3. **Consultoría & Soporte TI — «PIX presenta el diagnóstico».** Se conserva la idea de
   Miguel (mascota presentando) porque la consultoría es el servicio humano y la mascota
   es lo que mejor lo comunica; se eleva a la sofisticación de las otras dos haciendo que
   lo que presenta sea real: un tablero donde nodos desordenados (ámbar) se reordenan en un
   flujo limpio (cian) mientras PIX señala cada paso, parpadea y asiente; KPIs que cuentan
   («−38 % tiempo de proceso»); checklist final Diagnóstico → Plan 90 días →
   Acompañamiento. Tres tableros (procesos, seguridad, UX) rotan.

En el modal de detalle la misma escena se muestra en modo `poster` (fotograma final,
sin timers): ahí el usuario lee bullets y actúa — los datos que se leen no deben moverse.

## 4 · Movimiento (Emil Kowalski)

- **CTA WhatsApp.** Causa raíz del «flashazo»: `<style jsx global>` de styled-jsx no se
  sirve en el HTML del App Router (no hay `StyleRegistry`), así que el `<a>` pinta con el
  texto plano hasta que el cliente inyecta las reglas. Solución: mover `.shiny-cta` a
  `globals.css` (`@layer components`, presente en el CSS del build). Entrada
  (frecuencia: una vez por carga; propósito: evitar el cambio brusco + delight de marca):
  CSS animation (fuera del hilo principal, arranca en la primera pintura):
  pill `opacity 0→1` + `scale(.96→1)` 480 ms `cubic-bezier(0.23,1,0.32,1)`; el shine hace
  UNA vuelta de ignición de 900 ms con la misma curva y encadena al giro lineal de 3 s.
  Reduced-motion: fundido 200 ms `ease`, sin giro.
- **Escenas.** Herramienta: Framer Motion (springs de aparición de burbujas/bloques,
  `AnimatePresence`, `pathLength`) + un programador de pasos propio (`useSceneTimeline`)
  pausable por viewport/visibilidad. Entrada de elementos: `opacity 0→1` +
  `scale(.96→1)`/`translateY(6px→0)` con `cubic-bezier(0.23,1,0.32,1)` 260–320 ms;
  trazos: `pathLength 0→1` 350 ms; conteos: `linear`. Stagger 40–80 ms. Ningún
  `width/height` animado.
- `review-animations` al terminar (paso 4) · veredicto visual de Miguel (paso 5).

## 5 · Verificación prevista

`tsc --noEmit` · `next lint` · `vitest run` · `next build` · `next dev` en puerto 48xx
libre + `curl /` 200 · navegador real (desktop/móvil, con y sin reduced-motion) si la
herramienta está disponible; si no, «pendiente veredicto visual de Miguel».
