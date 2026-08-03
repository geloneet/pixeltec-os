# Plan — Landing pública de PixelBot (`/pixelbot`)

**Fecha:** 2026-08-03 · **Rama:** `feat/pixelbot-landing` (desde `origin/main` @ `4adb76f`, ya incluye PR #47) · **Deploy:** PROHIBIDO en este incremento.

Instrucción vigente de Miguel (literal): *"Investiga a fondo los bots de WhatsApp, es decir la competencia, para crear una landing page en mi página pixeltec.mx/pixelbot o pixeltec.mx/whatsappbot. Evalúa el mejor / para publicar y, con base en la competencia y el sistema bot que ya existe, arma y ejecuta una landing exitosa donde se describa todo lo que el cliente necesita saber, con un diseño atractivo adaptado al diseño existente de PixelTEC."* Ratificada 2026-08-03 con GO de merge de PR #47 y ejecución de la landing.

## Contexto y fuentes

- Investigación competitiva: `~/Downloads/INVESTIGACION-COMPETENCIA-Y-ESTRATEGIA-LANDING-PIXELBOT-2026-08-03.md` (ManyChat, Landbot, WATI, respond.io, SleekFlow, Botmaker, Blip, Zenvia, Leadsales, Lovbot, Kovia, Talky, CXFlow, VendeBot, Lumin, IADrop).
- Prompt maestro: `~/Downloads/PROMPT-MAESTRO-CLAUDE-CODE-LANDING-PIXELBOT.md`.
- NeuroPIXEL: boot + context_package; `04_PRODUCTOS/PixelTEC OS/PixelTEC OS.md`, `04_PRODUCTOS/PixelBot/README.md` (stub con `> CONFIRMAR`), `learnings.md` (vacío), ADR-0014 (Bento Dark v2).
- Código PixelBot: `~/Desktop/PixelTECDEV/pixelbot` (verificación capacidad por capacidad, ver matriz).
- PixelTEC OS: exploración de `src/lib/seo.ts`, `src/components/seo/structured-data.tsx`, `src/app/actions.ts`, `src/app/sitemap.ts`, `next.config.ts`, header/footer, tokens.

## Decisiones

| Decisión | Valor |
|---|---|
| URL canónica | `https://pixeltec.mx/pixelbot` (única indexable) |
| Aliases 301 | `/whatsappbot`, `/whatsapp-bot`, `/bot-whatsapp`, `/chatbot-whatsapp`, `/agente-whatsapp` (verificado: no existen) |
| Conversión primaria | **Solicitar diagnóstico de PixelBot** (sin prueba gratis, sin registro) |
| Modelo comunicado | Implementación personalizada + operación mensual, sin cifras |
| Posicionamiento | PixelBot convierte WhatsApp en un sistema de atención y calificación: responde con información aprobada, recopila datos, conserva contexto y entrega a tu equipo cuando se necesita criterio humano. PixelTEC lo diseña, integra y opera. |
| Categoría | Agente de IA para WhatsApp / sistema de atención y calificación (NO "ChatGPT para WhatsApp") |
| Header | NO se agrega 7º link; descubrimiento por footer + `/services/automatizacion` |
| Analytics | Ninguno nuevo (CSP enforcing; eventos → backlog) |

## Claims Matrix

### A. Permitidos (verificados en código PixelBot)
| Claim | Evidencia |
|---|---|
| Conexión mediante API oficial de WhatsApp (Meta Cloud API, webhooks verificados) | `agent/providers/meta.py:101`, `agent/main.py:147-165` |
| Personalidad, tono y formalidad configurables; frases permitidas/prohibidas | `agent/bot_config.py:68-88`, `agent/brain.py:61-105` |
| Temas que puede y no puede responder; reconoce incertidumbre; no inventa por política configurada; guardia previa al modelo | `agent/bot_config.py:59-64,96-97`, `agent/guardia.py:28-138` |
| Horario de atención y mensaje fuera de horario | `agent/bot_config.py:52-56`, `agent/main.py:256-269,635-637` |
| Preguntas de calificación/cotización ordenadas, una por turno | `agent/bot_config.py:65,92`, `agent/brain.py:187` |
| Memoria por contacto: historial + datos recopilados, con expiración y filtro de datos sensibles | `agent/memory.py:195-209`, `agent/conversation_memory.py` |
| Clasificación de conversaciones (cliente/prospecto/soporte/proveedor/spam) | `agent/main.py:246,272-289` |
| Entrenamiento con respuestas de referencia (biblioteca de ejemplos) | `agent/examples.py`, `agent/brain.py:119-127` |
| Handoff con resumen de contexto y notificación al responsable | `agent/main.py:333-383`, `agent/tenants.py:190-213` |
| Control humano: takeover, pausa temporal/indefinida, el bot deja de responder | `agent/main.py:615-621,846-891` |
| Simulador de conversaciones y versiones de configuración (probar antes de publicar, volver atrás) | `agent/main.py:923-1014`, `agent/bot_config.py:450-544` |
| Consola: Bandeja, Bot, Entrenamiento, Pruebas | PR #47 fusionado (`4adb76f`). NO afirmar "en producción" hasta verificar deploy |
| Implementación, infraestructura y soporte operados por PixelTEC | Modelo real de deployment administrado |

### B. Condicionales — siempre «puede integrarse/configurarse para … cuando forma parte del alcance»
Agenda/citas, pedidos, catálogo, pagos, estado de proyectos, ERP/CRM, tickets, campañas con plantillas y consentimiento, documentos. (No existe cliente CRM/ERP/calendario en código; es alcance de servicio.)

### C. Prohibidos (omitidos del copy)
Etiquetas y notas (no existen en código) · escalamiento "por umbral de confianza" (definido pero nunca evaluado → decir "por reglas") · audio/voz/multimedia · Meta Partner/BSP · palomita verde · mensajes ilimitados · "nunca inventa"/"cero alucinaciones" · "reemplaza a tu equipo" · cifras/porcentajes/"3x" · clientes/logos/testimonios · tiempo fijo de implementación · precios · prueba gratis · omnicanal · equipos/round-robin · campañas como feature estándar.

## Copy definitivo por sección

### 1. Hero
- Eyebrow: `PixelBot · IA aplicada a WhatsApp`
- H1: `Convierte WhatsApp en un sistema que atiende, califica y prepara cada oportunidad para tu equipo.`
- Subcopy: `PixelBot responde con la información aprobada de tu negocio, recopila datos, conserva el contexto y entrega la conversación a una persona cuando hace falta. PixelTEC lo diseña, integra y opera alrededor de tu proceso real.`
- CTA 1: `Solicitar diagnóstico de PixelBot` (→ #diagnostico) · CTA 2: `Ver cómo funciona` (→ #como-funciona)
- Trust row: `API oficial de WhatsApp · IA con reglas y límites · Handoff humano · Operado por PixelTEC`
- Visual: composición propia — hilo de conversación sintético, chip "Bot respondiendo", panel lateral con datos capturados (nombre, servicio, presupuesto sintéticos), transición a "Ana tomó la conversación".

### 2. Dolor
- H2: `El problema no es recibir mensajes. Es perder oportunidades dentro del chat.`
- Bullets: mensajes fuera de horario que nadie retoma · respuestas tardías que enfrían al prospecto · las mismas preguntas todos los días · prospectos sin calificar mezclados con todo lo demás · información dispersa entre chats y libretas · seguimiento que depende de la memoria del equipo.

### 3. Cómo funciona (`#como-funciona`, rail de 6 pasos)
1. `Tu cliente escribe por WhatsApp.` 2. `PixelBot identifica qué necesita.` 3. `Responde dentro de tus reglas, con tu información aprobada.` 4. `Hace las preguntas necesarias para calificar o cotizar.` 5. `Guarda el contexto y clasifica la conversación.` 6. `Resuelve, o transfiere a tu equipo con todo el contexto.`

### 4. Capacidades por resultado (6)
- **Responde con criterio** — Información aprobada de tu negocio, personalidad configurada, temas permitidos y prohibidos. Cuando no sabe algo, lo reconoce en lugar de improvisar.
- **Califica antes de entregar** — Preguntas ordenadas, una por turno, para detectar intención y reunir los datos que tu equipo necesita para cerrar.
- **Recuerda lo importante** — Memoria por contacto: historial y datos recopilados, disponibles en la siguiente conversación.
- **Entrega sin empezar de cero** — Cuando se requiere criterio humano, transfiere con un resumen del contexto y notifica a la persona responsable.
- **Tu equipo conserva el control** — Modo bot, control humano o pausa. Mientras una persona atiende, el bot guarda silencio. Cada cambio queda registrado.
- **Se conecta a tu operación** — Puede integrarse con tu CRM, ERP, agenda u otros sistemas cuando esa integración forma parte del alcance de tu implementación.

### 5. Consola (showcase, tabs)
Intro: `PixelBot no es una caja negra. Su consola te deja ver y controlar cada conversación.`
- **Bandeja** — conversaciones, clasificación y control Bot/Humano en un solo lugar.
- **Bot** — personalidad, reglas, horarios y preguntas de calificación, editables sin tocar código.
- **Entrenamiento** — respuestas de referencia que enseñan al bot el estilo de tu negocio.
- **Pruebas** — simula conversaciones y publica versiones cuando estás conforme; puedes volver a una versión anterior.
Nota bajo tabs: `Capturas de la consola de PixelBot con datos de demostración.`

### 6. Comparativa (tabla)
| Capacidad | WhatsApp Business básico | Bot genérico | PixelBot |
|---|---|---|---|
| Respuestas frecuentes | Respuestas rápidas manuales | Sí, con flujos fijos | Sí, con información aprobada |
| Lenguaje natural | No | Variable | Configurado a tu negocio |
| Reglas y límites | Dependen del operador | Básicos | Temas, tono y políticas específicas |
| Memoria y contexto | Limitados al chat | Variable | Por contacto |
| Calificación | Manual | Flujo fijo | Preguntas estructuradas |
| Handoff humano | Todo es manual | Variable | Control explícito Bot / Humano / Pausa |
| Integraciones | No | Conectores estándar | A medida, según alcance |
| Implementación y soporte | Autoservicio | Plataforma self-service | Diseñado y operado por PixelTEC |

### 7. Casos de uso (posibilidades sujetas a alcance)
Ventas y calificación de prospectos · Atención y preguntas frecuentes · Soporte inicial y registro de casos · Citas y reservaciones (con integración de agenda) · Estado de pedido o proyecto (con integración a tu sistema) · Seguimiento de prospectos con consentimiento y plantillas.

### 8. Fit / no-fit
**PixelBot es para ti si:** recibes un flujo constante de mensajes · tu equipo tarda en responder o responde fuera de horario · contestas las mismas preguntas cada día · calificas prospectos antes de venderles · necesitas conectar WhatsApp con tus sistemas · quieres IA con control, no un experimento.
**No es para ti si:** buscas enviar mensajes masivos a bases compradas · quieres un bot genérico sin definir tu proceso · esperas que la IA reemplace por completo a tu equipo · buscas la opción más barata del mercado.

### 9. Implementación (6 pasos)
1. Diagnóstico operativo. 2. Diseño conversacional. 3. Configuración e integración. 4. Pruebas y simulación. 5. Lanzamiento controlado. 6. Operación y optimización.
(Sin días/semanas.)

### 10. Qué incluye / qué necesitas
**Incluye:** diagnóstico · diseño del flujo · conexión oficial · personalidad y reglas · preparación del conocimiento · integraciones acordadas · pruebas · despliegue · monitoreo · soporte y optimización.
**Necesitas:** acceso administrativo a Meta Business · decisión sobre tu número · información real de servicios, horarios y políticas · responsables del handoff · qué puede y no puede prometer el bot · accesos a sistemas a integrar · aviso de privacidad y consentimiento · aprobación de plantillas cuando aplique.

### 11. Costos
`PixelBot se cotiza como implementación personalizada más una operación mensual. El alcance depende de tus conversaciones, reglas, integraciones y nivel de soporte. Los cargos de Meta y el consumo de proveedores de IA se explican por separado, antes del lanzamiento.`

### 12. FAQ (12 — respuestas condicionales; texto final = texto del JSON-LD)
1. **¿PixelBot usa la API oficial de WhatsApp?** Sí. La conexión de producción usa la plataforma oficial de WhatsApp (Meta), con webhooks verificados. No usamos lectores de QR ni conectores no oficiales.
2. **¿Puedo conservar mi número?** En la mayoría de los casos sí. Depende de la evaluación técnica y de cómo esté configurada tu cuenta en Meta; se define contigo durante el diagnóstico.
3. **¿Qué pasa cuando no sabe una respuesta?** Se configura para responder dentro de fuentes y reglas aprobadas. Si falta información o se requiere criterio, lo reconoce y transfiere la conversación a tu equipo con el contexto recopilado.
4. **¿Puede atender una persona en cualquier momento?** Sí. Tu equipo puede tomar el control cuando lo decida; mientras una persona atiende, el bot deja de responder. También puede pausarse por un tiempo o indefinidamente.
5. **¿Se integra con mi CRM, agenda o ERP?** Puede integrarse con tus sistemas cuando esa integración forma parte del alcance de tu implementación. En el diagnóstico se evalúa qué conviene conectar y cómo.
6. **¿Responde fuera de horario?** Sí. Dentro de tu horario responde normalmente; fuera de él, entrega el mensaje que tú definas y la conversación queda registrada para seguimiento.
7. **¿Puede enviar promociones?** Los mensajes que inicia el negocio requieren consentimiento del contacto y, fuera de la ventana de servicio de 24 horas, plantillas aprobadas por Meta. PixelBot no está diseñado para spam ni para bases compradas.
8. **¿Cómo se cobra?** Como implementación personalizada más operación mensual, según el alcance. Los cargos de Meta y el consumo de proveedores de IA se explican por separado antes del lanzamiento.
9. **¿Cuánto tarda la implementación?** Depende del alcance: flujos, conocimiento e integraciones. El diagnóstico incluye un plan con etapas y tiempos realistas para tu caso.
10. **¿Qué información debo entregar?** Acceso administrativo a Meta Business, la decisión sobre tu número, información real de servicios, horarios y políticas, responsables del handoff, los límites de lo que el bot puede prometer y los accesos a los sistemas que se vayan a integrar.
11. **¿PixelBot reemplaza a mi equipo?** No. Atiende y califica para que tu equipo dedique su tiempo a las conversaciones que requieren criterio humano. El control siempre es de tu equipo.
12. **¿Cómo se protege la información?** Conexión oficial con webhooks verificados, memoria con filtros para no guardar datos sensibles innecesarios, acceso controlado a la consola y despliegue administrado por PixelTEC conforme a tu aviso de privacidad.

### 13. CTA final + formulario
- H2: `Diseñemos el WhatsApp que tu operación necesita.`
- Campos: Nombre · Email empresarial · Empresa (opcional) · ¿Qué quieres automatizar? (textarea) · Volumen aproximado de mensajes (select opcional) · Consentimiento (obligatorio, link a `/aviso-de-privacidad`) · honeypot `website`.
- Action: `submitContactForm` intacta; el cliente antepone a `message`: `Interés: PixelBot` + `Volumen aproximado: <valor>` si se eligió.
- Fallback: `¿Prefieres escribirnos directo?` → wa.me con texto `Hola, quiero evaluar PixelBot para mi empresa.`
- Nota bajo el form: explicación breve de consentimiento/ventana 24h/plantillas y de que los costos de Meta se explican antes del lanzamiento.

## SEO

- `buildMetadata({ path: '/pixelbot', title: 'PixelBot | Agente de IA para WhatsApp para Empresas', description: 'Automatiza atención y calificación por WhatsApp con IA controlada, memoria, handoff humano e integraciones a tu operación. Implementado por PixelTEC en México.', ogImage: '/og/pixelbot.png' })`
- JSON-LD: `Service` (nuevo componente con URL `/pixelbot`) + `BreadcrumbList` (existente) + `FAQPage` (nuevo, texto idéntico al visible). NO `SoftwareApplication`.
- Sitemap: `staticRoutes` + `/pixelbot` priority 0.9. Robots: sin cambios. Redirects 301: 5 aliases.
- Internal links: footer (Soluciones) + CTA en `/services/automatizacion`. Un solo H1. Frases semánticas integradas de forma natural (agente de IA para WhatsApp, bot de WhatsApp para empresas, chatbot para WhatsApp, automatización de atención por WhatsApp, calificación de leads por WhatsApp, WhatsApp Business con IA, bot de WhatsApp en México).

## Arquitectura

`src/app/pixelbot/page.tsx` (Server Component: metadata + JSON-LD + composición) → secciones en `src/components/pixelbot-landing/`: hero (server) con `pixelbot-conversation-demo` (client island), workflow (server/CSS), capabilities (server), console-showcase (client tabs), comparison (server), use-cases + fit (server), implementation (server), faq (client accordion accesible), lead-form (client, `useActionState`). Reuso: `Header`, `Footer`, `ShinyButton`, tokens `brand-blue`, patrones `useReducedMotion` existentes. No se edita `components/ui/*`.

## Test matrix

- Unit: metadata/canonical `/pixelbot` · redirects aliases en `next.config` · JSON-LD FAQ = texto visible · claims lint (frases prohibidas ausentes) · prefijo `Interés: PixelBot` en el form.
- Smoke browser (5 viewports): anchors, CTAs, form success/error, WhatsApp link, FAQ teclado, reduced motion, overflow, title/canonical, 301s, sitemap, regresión homepage/services/contact.
- Baseline vs after de typecheck/test/build.

## Riesgos y rollback

- Riesgos: canibalización con `/services/automatizacion` (mitigada con cross-link e intención distinta) · rate limit 3/h del form compartido · `ignoreBuildErrors` en build (typecheck manual obligatorio) · screenshots con datos no sintéticos (inspección previa).
- Rollback: revert del merge del PR de la landing (cambios aditivos: ruta nueva, 5 redirects, 1 línea sitemap, 1 link footer, 1 CTA services). Sin migraciones ni cambios de contrato.

## Backlog (no implementado)

Pricing/paquetes · calculadora ROI · prueba real por WhatsApp · casos/testimonios/métricas · videos · campañas · agenda/pagos/catálogo estándar · omnicanal · equipos/round-robin · demo self-service · A/B · versión en inglés · analytics de eventos (requiere modificar CSP) · centralización de los 8 hardcodes del teléfono · claim de audio/voz (existe en producción pero vetado en este incremento).

## Cierre

Push a `feat/pixelbot-landing` → Draft PR. **Sin merge, sin deploy, sin write-back a NeuroPIXEL** (se propondrá al cierre como pendiente aprobable).
