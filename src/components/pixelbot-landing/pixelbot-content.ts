/**
 * Fuente única del copy de la landing /pixelbot.
 *
 * Todo texto visible en la página sale de aquí; el JSON-LD (FAQPage) y los
 * tests de claims leen este mismo módulo, de modo que el markup estructurado
 * nunca puede divergir del contenido renderizado. Los claims siguen la matriz
 * verificada en docs/superpowers/plans/2026-08-03-pixelbot-landing.md:
 * capacidades condicionales SIEMPRE en lenguaje condicional, sin precios,
 * sin métricas, sin afiliaciones.
 */

export const PIXELBOT_PATH = '/pixelbot';

export const HERO = {
  eyebrow: 'PixelBot · IA aplicada a WhatsApp',
  h1: 'Convierte WhatsApp en un sistema que atiende, califica y prepara cada oportunidad para tu equipo.',
  subcopy:
    'PixelBot responde con la información aprobada de tu negocio, recopila datos, conserva el contexto y entrega la conversación a una persona cuando hace falta. PixelTEC lo diseña, integra y opera alrededor de tu proceso real.',
  ctaPrimary: 'Solicitar diagnóstico de PixelBot',
  ctaSecondary: 'Ver cómo funciona',
  trust: ['API oficial de WhatsApp', 'IA con reglas y límites', 'Handoff humano', 'Operado por PixelTEC'],
} as const;

export const PAIN = {
  title: 'El problema no es recibir mensajes. Es perder oportunidades dentro del chat.',
  items: [
    'Mensajes fuera de horario que nadie retoma al día siguiente.',
    'Respuestas tardías que enfrían al prospecto.',
    'Las mismas preguntas, todos los días, quitándole tiempo a tu equipo.',
    'Prospectos sin calificar mezclados con todo lo demás.',
    'Información dispersa entre chats, libretas y memoria.',
    'Seguimiento que depende de que alguien se acuerde.',
  ],
} as const;

export const WORKFLOW = {
  title: 'Así trabaja PixelBot dentro de tu operación',
  steps: [
    { title: 'Tu cliente escribe', detail: 'Por el mismo WhatsApp de tu negocio, a cualquier hora.' },
    { title: 'Identifica qué necesita', detail: 'Detecta la intención: información, cotización, soporte.' },
    { title: 'Responde dentro de tus reglas', detail: 'Con la información aprobada de tu negocio, en tu tono.' },
    { title: 'Hace las preguntas correctas', detail: 'Una por turno, para calificar o cotizar sin interrogar.' },
    { title: 'Guarda contexto y clasifica', detail: 'Historial y datos por contacto, conversación clasificada.' },
    { title: 'Resuelve o transfiere', detail: 'Si se necesita criterio humano, entrega a tu equipo con resumen.' },
  ],
} as const;

export const CAPABILITIES = {
  title: 'Capacidades pensadas por resultado, no por tecnología',
  items: [
    {
      title: 'Responde con criterio',
      detail:
        'Información aprobada de tu negocio, personalidad configurada, temas permitidos y prohibidos. Cuando no sabe algo, lo reconoce en lugar de improvisar.',
    },
    {
      title: 'Califica antes de entregar',
      detail:
        'Preguntas ordenadas, una por turno, para detectar intención y reunir los datos que tu equipo necesita para cerrar.',
    },
    {
      title: 'Recuerda lo importante',
      detail:
        'Memoria por contacto: historial de conversación y datos recopilados, disponibles la siguiente vez que ese cliente escriba.',
    },
    {
      title: 'Entrega sin empezar de cero',
      detail:
        'Cuando se requiere criterio humano, transfiere la conversación con un resumen del contexto y notifica a la persona responsable.',
    },
    {
      title: 'Tu equipo conserva el control',
      detail:
        'Modo bot, control humano o pausa. Mientras una persona atiende, el bot guarda silencio. Cada cambio de control queda registrado.',
    },
    {
      title: 'Se conecta a tu operación',
      detail:
        'Puede integrarse con tu CRM, ERP, agenda u otros sistemas cuando esa integración forma parte del alcance de tu implementación.',
    },
  ],
} as const;

export const CONSOLE_SHOWCASE = {
  title: 'PixelBot no es una caja negra',
  intro: 'Su consola te deja ver y controlar cada conversación: qué respondió, qué datos capturó y quién tiene el control.',
  note: 'Capturas de la consola de PixelBot con datos de demostración.',
  tabs: [
    {
      id: 'bandeja',
      label: 'Bandeja',
      heading: 'Todas las conversaciones, con contexto y control',
      detail:
        'Cada chat muestra quién lo atiende (bot, humano o en pausa), la clasificación sugerida y la ficha del contacto con los datos capturados. Tu equipo puede tomar el control con un clic.',
      image: '/images/pixelbot/consola-bandeja.webp',
      alt: 'Bandeja de la consola de PixelBot: conversación de WhatsApp atendida por el bot, con ficha de contacto, clasificación sugerida y botón para tomar control humano',
      width: 1440,
      height: 772,
    },
    {
      id: 'bot',
      label: 'Bot',
      heading: 'Personalidad y reglas, sin tocar código',
      detail:
        'Nombre público, tono, formalidad, temas permitidos y prohibidos, horarios y preguntas de calificación. Todo editable desde la consola, con vista previa.',
      image: '/images/pixelbot/consola-bot.webp',
      alt: 'Configuración del bot en la consola de PixelBot: identidad pública, tono y formalidad editables',
      width: 1440,
      height: 648,
    },
    {
      id: 'entrenamiento',
      label: 'Entrenamiento',
      heading: 'Enséñale cómo responde tu negocio',
      detail:
        'Respuestas de referencia para situaciones reales: precios, horarios, escalamiento. Se activan o desactivan individualmente y definen el estilo del bot.',
      image: '/images/pixelbot/consola-entrenamiento.webp',
      alt: 'Biblioteca de entrenamiento de PixelBot: ejemplos de preguntas y respuestas con etiquetas e importancia',
      width: 1440,
      height: 772,
    },
    {
      id: 'pruebas',
      label: 'Pruebas',
      heading: 'Prueba antes de publicar',
      detail:
        'El simulador ejecuta el mismo cerebro del bot sin enviar nada a WhatsApp. Publica una versión cuando estés conforme y vuelve a una anterior si lo necesitas.',
      image: '/images/pixelbot/consola-pruebas.webp',
      alt: 'Simulador de PixelBot: prueba cómo respondería el bot sin enviar mensajes reales a WhatsApp',
      width: 1440,
      height: 520,
    },
  ],
} as const;

export const COMPARISON = {
  title: '¿Dónde queda PixelBot frente a lo que ya conoces?',
  caption: 'Comparativa de capacidades entre WhatsApp Business básico, un bot genérico y PixelBot',
  columns: ['Capacidad', 'WhatsApp Business básico', 'Bot genérico', 'PixelBot'],
  rows: [
    ['Respuestas frecuentes', 'Respuestas rápidas manuales', 'Sí, con flujos fijos', 'Sí, con información aprobada'],
    ['Lenguaje natural', 'No', 'Variable', 'Configurado a tu negocio'],
    ['Reglas y límites', 'Dependen del operador', 'Básicos', 'Temas, tono y políticas específicas'],
    ['Memoria y contexto', 'Limitados al chat', 'Variable', 'Por contacto'],
    ['Calificación de prospectos', 'Manual', 'Flujo fijo', 'Preguntas estructuradas'],
    ['Handoff humano', 'Todo es manual', 'Variable', 'Control explícito Bot / Humano / Pausa'],
    ['Integraciones', 'No', 'Conectores estándar', 'A medida, según alcance'],
    ['Implementación y soporte', 'Autoservicio', 'Plataforma self-service', 'Diseñado y operado por PixelTEC'],
  ],
} as const;

export const USE_CASES = {
  title: 'Casos de uso',
  intro: 'Cada implementación se diseña alrededor de tu proceso. Estos son los escenarios más comunes:',
  items: [
    { title: 'Ventas y calificación', detail: 'Atiende el primer contacto, califica y entrega prospectos listos para tu equipo comercial.' },
    { title: 'Atención y preguntas frecuentes', detail: 'Resuelve las dudas repetitivas con información aprobada, a cualquier hora.' },
    { title: 'Soporte inicial', detail: 'Recibe el problema, recopila los detalles y escala al responsable con contexto.' },
    { title: 'Citas y reservaciones', detail: 'Puede conectarse con tu agenda para consultar disponibilidad y registrar citas cuando esa integración forma parte del alcance.' },
    { title: 'Estado de pedido o proyecto', detail: 'Puede consultar tus sistemas para informar avances cuando esa integración forma parte del alcance.' },
    { title: 'Seguimiento de prospectos', detail: 'Mensajes de seguimiento con consentimiento del contacto y plantillas aprobadas.' },
  ],
} as const;

export const FIT = {
  title: '¿Es PixelBot para tu empresa?',
  yesTitle: 'Es para ti si…',
  yes: [
    'Recibes un flujo constante de mensajes por WhatsApp.',
    'Tu equipo tarda en responder o los mensajes llegan fuera de horario.',
    'Contestas las mismas preguntas todos los días.',
    'Calificas prospectos antes de dedicarles tiempo comercial.',
    'Necesitas conectar WhatsApp con tus sistemas.',
    'Quieres IA con control y acompañamiento, no un experimento.',
  ],
  noTitle: 'No es para ti si…',
  no: [
    'Buscas enviar mensajes masivos a bases compradas.',
    'Quieres un bot genérico sin definir tu proceso.',
    'Esperas que la IA reemplace por completo a tu equipo.',
    'Buscas la opción más barata del mercado.',
  ],
} as const;

export const IMPLEMENTATION = {
  title: 'Cómo se implementa',
  intro: 'PixelBot no se “activa”: se diseña alrededor de tu operación. El proceso es acompañado de principio a fin.',
  steps: [
    { title: 'Diagnóstico operativo', detail: 'Entendemos tu flujo real de mensajes, tu proceso comercial y qué debe lograr el bot.' },
    { title: 'Diseño conversacional', detail: 'Definimos personalidad, reglas, temas, preguntas de calificación y rutas de escalamiento.' },
    { title: 'Configuración e integración', detail: 'Conexión oficial con WhatsApp, preparación del conocimiento e integraciones acordadas.' },
    { title: 'Pruebas y simulación', detail: 'Validamos el comportamiento en el simulador antes de que hable con un solo cliente.' },
    { title: 'Lanzamiento controlado', detail: 'Salida gradual con monitoreo y ajustes sobre conversaciones reales.' },
    { title: 'Operación y optimización', detail: 'PixelTEC opera la infraestructura, da soporte y mejora el bot con lo aprendido.' },
  ],
  includesTitle: 'Qué incluye',
  includes: [
    'Diagnóstico operativo',
    'Diseño del flujo conversacional',
    'Conexión oficial con WhatsApp',
    'Personalidad y reglas configuradas',
    'Preparación del conocimiento del negocio',
    'Integraciones acordadas en el alcance',
    'Pruebas y simulación',
    'Despliegue administrado',
    'Monitoreo y soporte',
    'Optimización continua',
  ],
  needsTitle: 'Qué necesitamos de ti',
  needs: [
    'Acceso administrativo a tu Meta Business',
    'La decisión sobre el número de WhatsApp a usar',
    'Información real de servicios, horarios y políticas',
    'Responsables que recibirán el handoff',
    'Qué puede y qué no puede prometer el bot',
    'Accesos a los sistemas que se vayan a integrar',
    'Tu aviso de privacidad y la base de consentimiento',
    'Aprobación de plantillas cuando aplique',
  ],
} as const;

export const PRICING = {
  title: 'Modelo de costo',
  body:
    'PixelBot se cotiza como implementación personalizada más una operación mensual. El alcance depende de tus conversaciones, reglas, integraciones y nivel de soporte. Los cargos de Meta y el consumo de proveedores de IA se explican por separado, antes del lanzamiento.',
} as const;

export const COMPLIANCE = {
  title: 'WhatsApp, consentimiento y costos de Meta',
  items: [
    'La conexión de producción usa la plataforma oficial de WhatsApp (Meta), con webhooks verificados.',
    'Los mensajes iniciados por el negocio requieren consentimiento del contacto.',
    'Fuera de la ventana de servicio de 24 horas se usan plantillas aprobadas por Meta.',
    'Meta cobra por conversación según su categoría, país y modelo vigente; PixelTEC te explica estos costos antes del lanzamiento.',
    'PixelBot no está diseñado para spam ni para bases compradas.',
  ],
} as const;

export const FAQ = {
  title: 'Preguntas frecuentes',
  items: [
    {
      q: '¿PixelBot usa la API oficial de WhatsApp?',
      a: 'Sí. La conexión de producción usa la plataforma oficial de WhatsApp (Meta), con webhooks verificados. No usamos lectores de QR ni conectores no oficiales.',
    },
    {
      q: '¿Puedo conservar mi número?',
      a: 'En la mayoría de los casos sí. Depende de la evaluación técnica y de cómo esté configurada tu cuenta en Meta; se define contigo durante el diagnóstico.',
    },
    {
      q: '¿Qué pasa cuando no sabe una respuesta?',
      a: 'Se configura para responder dentro de fuentes y reglas aprobadas. Si falta información o se requiere criterio, lo reconoce y transfiere la conversación a tu equipo con el contexto recopilado.',
    },
    {
      q: '¿Puede atender una persona en cualquier momento?',
      a: 'Sí. Tu equipo puede tomar el control cuando lo decida; mientras una persona atiende, el bot deja de responder. También puede pausarse por un tiempo o indefinidamente.',
    },
    {
      q: '¿Se integra con mi CRM, agenda o ERP?',
      a: 'Puede integrarse con tus sistemas cuando esa integración forma parte del alcance de tu implementación. En el diagnóstico se evalúa qué conviene conectar y cómo.',
    },
    {
      q: '¿Responde fuera de horario?',
      a: 'Sí. Dentro de tu horario responde normalmente; fuera de él, entrega el mensaje que tú definas y la conversación queda registrada para seguimiento.',
    },
    {
      q: '¿Puede enviar promociones?',
      a: 'Los mensajes que inicia el negocio requieren consentimiento del contacto y, fuera de la ventana de servicio de 24 horas, plantillas aprobadas por Meta. PixelBot no está diseñado para spam ni para bases compradas.',
    },
    {
      q: '¿Cómo se cobra?',
      a: 'Como implementación personalizada más operación mensual, según el alcance. Los cargos de Meta y el consumo de proveedores de IA se explican por separado antes del lanzamiento.',
    },
    {
      q: '¿Cuánto tarda la implementación?',
      a: 'Depende del alcance: flujos, conocimiento e integraciones. El diagnóstico incluye un plan con etapas y tiempos realistas para tu caso.',
    },
    {
      q: '¿Qué información debo entregar?',
      a: 'Acceso administrativo a Meta Business, la decisión sobre tu número, información real de servicios, horarios y políticas, responsables del handoff, los límites de lo que el bot puede prometer y los accesos a los sistemas que se vayan a integrar.',
    },
    {
      q: '¿PixelBot reemplaza a mi equipo?',
      a: 'No. Atiende y califica para que tu equipo dedique su tiempo a las conversaciones que requieren criterio humano. El control siempre es de tu equipo.',
    },
    {
      q: '¿Cómo se protege la información?',
      a: 'Conexión oficial con webhooks verificados, memoria con filtros para no guardar datos sensibles innecesarios, acceso controlado a la consola y despliegue administrado por PixelTEC conforme a tu aviso de privacidad.',
    },
  ],
} as const;

export const FINAL_CTA = {
  title: 'Diseñemos el WhatsApp que tu operación necesita.',
  body: 'Cuéntanos qué quieres automatizar y te respondemos con un diagnóstico claro: qué puede hacer PixelBot por tu operación, qué necesita y cómo se implementa.',
  submitLabel: 'Solicitar diagnóstico',
  whatsappFallbackLabel: '¿Prefieres escribirnos directo por WhatsApp?',
  whatsappMessage: 'Hola, quiero evaluar PixelBot para mi empresa.',
  volumeOptions: [
    'Menos de 20 mensajes al día',
    'Entre 20 y 100 mensajes al día',
    'Más de 100 mensajes al día',
    'No lo sé aún',
  ],
} as const;

/**
 * Serializa los campos visuales extra dentro de `message` con prefijo estable.
 * Mismo patrón "Opción A" de src/components/sections/contact.tsx — el contrato
 * de submitContactForm no cambia.
 */
export function buildPixelbotMessage(rawMessage: string, volume?: string | null): string {
  const lines = ['Interés: PixelBot'];
  if (volume && volume.trim() !== '') {
    lines.push(`Volumen aproximado: ${volume}`);
  }
  return `${lines.join('\n')}\n\n${rawMessage}`;
}

export const SEO_META = {
  title: 'PixelBot | Agente de IA para WhatsApp para Empresas',
  description:
    'Automatiza atención y calificación por WhatsApp con IA controlada, memoria, handoff humano e integraciones a tu operación. Implementado por PixelTEC en México.',
  ogImage: '/og/pixelbot.png',
  serviceName: 'PixelBot — Agente de IA para WhatsApp',
  serviceDescription:
    'Agente de IA para WhatsApp que atiende, califica y transfiere conversaciones a tu equipo, con memoria por contacto, reglas configurables y handoff humano. Implementado y operado por PixelTEC.',
} as const;
