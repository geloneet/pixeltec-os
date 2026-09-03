/**
 * Clúster B — automatización y WhatsApp (WO-2026-00189).
 *
 * 8 landings: 4 keywords del plan §2 («automatiza tu negocio», «automatizar
 * mensajes de whatsapp», «automatizar whatsapp business», «automatizacion de
 * mensajes en whatsapp») × genérica + Puerto Vallarta. Hub: `automatizacion`.
 *
 * Cada página tiene un ÁNGULO propio para no canibalizar dentro del clúster:
 * B1 guía por áreas del negocio · B2 mecánica de los mensajes y las reglas de
 * Meta · B3 app vs. WhatsApp Business Platform (API) · B4 casos por industria
 * e indicadores. Las variantes de Puerto Vallarta no repiten el texto de la
 * genérica: tienen contexto local propio (turismo, hotelería, restaurantes,
 * inmobiliaria y salud de la bahía), casos y FAQ distintos.
 *
 * Claims sobre WhatsApp: solo los verificables en la documentación pública de
 * Meta (ventana de servicio de 24 horas, plantillas que requieren aprobación,
 * WhatsApp Business Platform, coexistencia de la app con la API). Nada de
 * precios, cifras sin fuente ni clientes que no existan — los ejemplos se
 * redactan como escenarios.
 *
 * Fuentes externas verificadas con `curl -sIL -m 20 <url> | head -1` = 200 el
 * 2026-09-02; todas `.gob.mx` o `.org.mx`.
 */

import type { KeywordLanding } from './keyword-landings';

const PUERTO_VALLARTA = { name: 'Puerto Vallarta', region: 'Jalisco' } as const;

export const KEYWORD_LANDINGS_WHATSAPP: KeywordLanding[] = [
  // ───────────────────────────── B1 · genérica ─────────────────────────────
  {
    slug: 'automatiza-tu-negocio',
    keyword: 'automatiza tu negocio',
    h1: 'Automatiza tu negocio: por dónde empezar, área por área',
    metaTitle: 'Automatiza tu negocio: guía por áreas | PixelTEC',
    metaDescription:
      'Automatiza tu negocio sin romper lo que funciona: qué conviene automatizar en ventas, cobros, atención y operaciones, y en qué orden hacerlo.',
    intro:
      'Automatizar un negocio no es comprar una herramienta: es quitarle a tu equipo el trabajo repetitivo que hoy hace a mano y dejar registrado lo que antes vivía en la cabeza de alguien. Esta guía ordena por área lo que sí conviene automatizar, con qué criterio elegir el primer proceso y qué esperar de cada paso.',
    sections: [
      {
        title: 'Qué significa automatizar un negocio (y qué no)',
        body: [
          'Automatizar es hacer que una tarea ocurra sola cuando se cumple una condición: llega un mensaje y se responde, se aprueba una cotización y se genera la factura, termina el día y el reporte ya está en el correo de dirección. El trabajo no desaparece; deja de consumir tiempo de una persona.',
          'Lo que la automatización no hace: no arregla un proceso que nadie entiende, no sustituye criterio en decisiones que requieren contexto, y no reemplaza a tu equipo. Si un proceso está mal definido, automatizarlo solo lo hace fallar más rápido y a mayor escala. Por eso el primer paso siempre es escribir el proceso como está hoy, con sus excepciones.',
          'La otra mitad del valor es la trazabilidad: un flujo automatizado deja registro de qué pasó, cuándo y con qué datos. Eso convierte discusiones de percepción («tardamos mucho en contestar») en números que se pueden revisar.',
        ],
      },
      {
        title: 'Área por área: dónde suele estar el mayor ahorro',
        body: [
          'No todas las áreas dan el mismo retorno. En la mayoría de las empresas medianas mexicanas con las que trabajamos, el orden de impacto suele ser este: primero lo que toca al cliente y hace perder ventas, después lo que retrasa el dinero, y al final lo interno.',
        ],
        bullets: [
          {
            title: 'Ventas y prospección',
            description:
              'Captura automática de prospectos desde el sitio, WhatsApp y redes en un solo lugar; asignación al vendedor correcto; recordatorios de seguimiento para que ninguna oportunidad se enfríe por olvido.',
          },
          {
            title: 'Cobros y facturación',
            description:
              'Generación de cotizaciones y facturas a partir de lo ya capturado, recordatorios de pago programados y conciliación de comprobantes sin volver a teclear los mismos datos en dos sistemas.',
          },
          {
            title: 'Atención al cliente',
            description:
              'Respuestas inmediatas a las preguntas que se repiten, ruteo al área correcta y escalamiento a una persona cuando el caso lo amerita, con el historial de la conversación disponible.',
          },
          {
            title: 'Operaciones internas',
            description:
              'Reportes diarios consolidados desde varias fuentes, altas de proveedores o empleados con su documentación, y validaciones que hoy alguien hace revisando hoja por hoja.',
          },
        ],
      },
      {
        title: 'Cómo elegir el primer proceso a automatizar',
        body: [
          'El primer proyecto no debería ser el más ambicioso, sino el que demuestra valor rápido y deja aprendizaje. Buscamos procesos con cuatro características: alta frecuencia, reglas claras, datos que ya existen en algún sistema y un dueño identificable dentro de la empresa.',
          'Un proceso que ocurre cincuenta veces al día y toma tres minutos vale más que uno que ocurre una vez al mes y toma dos horas. Y un proceso con reglas ambiguas —donde tres personas del equipo lo hacen distinto— primero se estandariza y después se automatiza; ese orden no es negociable.',
          'También descartamos, al menos al inicio, lo que depende de sistemas cerrados sin forma de integrarse. Si un dato solo existe dentro de una aplicación que no expone API ni exportación, el costo de automatizar sube y el resultado es frágil.',
        ],
      },
      {
        title: 'Qué esperar durante y después de la implementación',
        body: [
          'La primera automatización se diseña, se prueba con casos reales del negocio y se libera acompañada de la operación manual durante un periodo corto, hasta que el equipo confía en el resultado. No se apaga el proceso viejo el día uno.',
          'Después de liberar, lo importante es la observación: qué casos se escapan de las reglas, qué preguntas no supo resolver el flujo, qué pasos se agregaron sin avisar. Esa lista es la que alimenta la siguiente iteración, y es también la razón por la que una automatización necesita mantenimiento igual que cualquier otro sistema.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'MessageSquareText',
        title: 'Primera respuesta inmediata',
        description:
          'Cada mensaje que entra por WhatsApp, el sitio o redes recibe respuesta al momento, se clasifica y llega al área correcta, sin que nadie tenga que estar mirando la bandeja.',
      },
      {
        icon: 'CreditCard',
        title: 'Cotización a factura sin doble captura',
        description:
          'Cuando una cotización se acepta, los datos ya capturados se convierten en factura y en registro contable, en lugar de volver a escribirse en otro sistema.',
      },
      {
        icon: 'BarChart3',
        title: 'Reporte diario de operación',
        description:
          'Un script consolida ventas, pedidos e incidencias de las distintas fuentes y deja un reporte listo cada mañana, con el mismo criterio todos los días.',
      },
      {
        icon: 'ClipboardList',
        title: 'Altas y expedientes completos',
        description:
          'Flujos que piden documentación, validan que esté completa y dan de alta a un proveedor, cliente o colaborador sin que administración persiga papeles por correo.',
      },
    ],
    faq: [
      {
        q: '¿Por dónde conviene empezar a automatizar un negocio?',
        a: 'Por un proceso frecuente, con reglas claras y con datos que ya existan en algún sistema. Suele ser la atención de mensajes entrantes o el paso de cotización a factura, porque se notan rápido y no dependen de reescribir toda la operación.',
      },
      {
        q: '¿Necesito cambiar los sistemas que ya uso?',
        a: 'En la mayoría de los casos no. Se conecta lo que ya tienes —CRM, sistema de facturación, hojas de cálculo, WhatsApp— mediante integraciones o APIs. Solo proponemos reemplazar un sistema cuando es la fuente del problema, y lo decimos con argumentos, no por default.',
      },
      {
        q: '¿La automatización va a reemplazar a mi equipo?',
        a: 'No es el objetivo ni lo que vemos en la práctica. Lo que se automatiza es la parte repetitiva: capturar, copiar, recordar, consolidar. El equipo se queda con lo que requiere criterio, negociación y trato humano, que es donde aporta valor.',
      },
      {
        q: '¿Cuánto tarda en implementarse una automatización?',
        a: 'Depende del alcance y de qué tan definido esté el proceso. Una automatización acotada —un flujo de atención, un reporte consolidado— suele estar operando en semanas, no en meses; una integración entre varios sistemas toma más y se entrega por partes.',
      },
      {
        q: '¿Cómo sé si realmente sirvió?',
        a: 'Se define antes de empezar qué se va a medir: tiempo del proceso, cantidad de errores, mensajes atendidos fuera de horario o carga de trabajo del área. Se toma la medición inicial y se compara después de liberar. Sin esa línea base, cualquier resultado es opinión.',
      },
    ],
    externalSources: [
      { label: 'INEGI — Tecnologías de la información', href: 'https://www.inegi.org.mx/temas/tic/' },
      { label: 'Secretaría de Economía (gob.mx)', href: 'https://www.gob.mx/se' },
    ],
    relatedSlugs: [
      'automatiza-tu-negocio-puerto-vallarta',
      'automatizar-mensajes-de-whatsapp',
      'automatizar-whatsapp-business',
      'automatizacion-de-mensajes-en-whatsapp',
    ],
    hub: 'automatizacion',
    ctaHref: '/diagnostico',
    ctaVerb: 'automatizar tu negocio',
  },

  // ─────────────────────────────── B1 · PV ─────────────────────────────────
  {
    slug: 'automatiza-tu-negocio-puerto-vallarta',
    keyword: 'automatiza tu negocio',
    h1: 'Automatiza tu negocio en Puerto Vallarta',
    metaTitle: 'Automatiza tu negocio en Puerto Vallarta | PixelTEC',
    metaDescription:
      'Automatiza tu negocio en Puerto Vallarta: reservaciones, atención al huésped, cobros y reportes para hotelería, restaurantes, inmobiliaria y salud.',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta. Automatizamos la operación de negocios de la bahía que trabajan con temporadas marcadas, equipos pequeños y clientes que escriben a cualquier hora: hotelería, restaurantes, inmobiliaria, tours y consultorios.',
    sections: [
      {
        title: 'Qué se automatiza en un negocio con temporada alta',
        body: [
          'La operación de Vallarta tiene una particularidad que no aparece en un negocio de ciudad: la carga no es constante. En temporada alta el mismo equipo atiende varias veces el volumen de mensajes, reservaciones y cobros que atiende en temporada baja, y contratar personal por unos meses no siempre es viable ni suficiente.',
          'Automatizar aquí no busca reducir plantilla: busca que la plantilla que ya tienes aguante el pico sin dejar mensajes sin contestar ni reservaciones sin confirmar. Lo que se automatiza es la parte que no requiere criterio —confirmar, recordar, consolidar, cobrar— para que el equipo se dedique a atender al huésped o al cliente.',
          'La segunda particularidad es el idioma: buena parte de la demanda del destino escribe en inglés. Un flujo automatizado puede responder en el idioma en que le escriben desde el primer mensaje, algo que un equipo pequeño no siempre puede sostener a las once de la noche.',
        ],
      },
      {
        title: 'Por área, con ejemplos de la bahía',
        body: [
          'Estos son los frentes donde vemos más trabajo repetitivo en negocios locales. Son escenarios de operación típicos del destino, no casos de clientes específicos.',
        ],
        bullets: [
          {
            title: 'Hotelería y renta vacacional',
            description:
              'Confirmaciones de reservación, instrucciones de llegada, coordinación de check-in y check-out, y recordatorios de limpieza o mantenimiento entre estancias.',
          },
          {
            title: 'Restaurantes y experiencias',
            description:
              'Reservación de mesa o tour por mensaje, recordatorio el día anterior para bajar el no-show y aviso automático de cambios por clima o temporada.',
          },
          {
            title: 'Inmobiliaria y administración de propiedades',
            description:
              'Captura y calificación de prospectos, envío de fichas de propiedades, agenda de visitas y seguimiento a pagos y mantenimiento de condominios.',
          },
          {
            title: 'Consultorios y servicios de salud',
            description:
              'Agenda de citas, recordatorios para reducir ausencias e instrucciones previas a la consulta, con el manejo de datos personales que exige la normativa.',
          },
        ],
      },
      {
        title: 'Cómo lo abordamos con negocios locales',
        body: [
          'Empezamos por observar una semana de operación real: qué se pregunta, cuántas veces, en qué horario y quién contesta. De ahí sale el primer proceso a automatizar, que casi siempre es el que hace perder reservaciones fuera de horario.',
          'Trabajamos con lo que el negocio ya usa. Si hay un PMS, un canal de reservación o un CRM, se integra; si la operación vive en hojas de cálculo y en la libreta de recepción, primero se ordena y después se automatiza. Cambiar todo de golpe en plena temporada es la forma más rápida de romper una operación que funcionaba.',
          'Al ser locales, la implementación se hace en sitio cuando hace falta: sentarse con recepción o con el equipo de ventas media hora vale más que tres correos explicando el mismo flujo.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los destinos turísticos principales de Jalisco y su economía se apoya en hospedaje, alimentos y bebidas, servicios inmobiliarios y comercio ligados al visitante. El Ayuntamiento y el Gobierno del Estado publican la información oficial del municipio y de sus programas de desarrollo económico.',
        'Ese perfil económico explica el patrón que vemos en la operación local: mucha conversación entrante, alta estacionalidad, equipos compactos y clientes en distintas zonas horarias. Automatizar la primera respuesta, la confirmación y el recordatorio es lo que más rápido cambia el día a día de un negocio de la bahía.',
        'Somos de aquí y operamos desde aquí, así que el diagnóstico se hace mirando la operación real: la bandeja de WhatsApp de recepción, la hoja de reservaciones y el proceso de cobro, no un cuestionario genérico.',
      ],
    },
    useCases: [
      {
        icon: 'BedDouble',
        title: 'Reservaciones confirmadas sin intervención',
        description:
          'El huésped recibe confirmación, instrucciones de llegada y recordatorio automáticos; recepción solo interviene cuando hay un cambio o una petición especial.',
      },
      {
        icon: 'UtensilsCrossed',
        title: 'Menos no-show en restaurantes y tours',
        description:
          'Recordatorio el día previo con opción de confirmar o cancelar por mensaje, para liberar el lugar a tiempo en lugar de perderlo.',
      },
      {
        icon: 'Building2',
        title: 'Prospectos inmobiliarios calificados',
        description:
          'El interesado responde unas preguntas por mensaje, recibe la ficha de la propiedad que le corresponde y queda registrado con su presupuesto y fecha de interés.',
      },
      {
        icon: 'HeartPulse',
        title: 'Agenda de consultorio con recordatorios',
        description:
          'Citas agendadas por mensaje, recordatorio previo e indicaciones de preparación, reduciendo llamadas y ausencias sin cargarle la tarea a la recepcionista.',
      },
    ],
    faq: [
      {
        q: '¿PixelTEC está en Puerto Vallarta?',
        a: 'Sí, nuestra sede está en Puerto Vallarta, Jalisco. Trabajamos en persona con negocios de la bahía y de forma remota con el resto de México.',
      },
      {
        q: '¿Sirve para un negocio que solo tiene temporada alta unos meses?',
        a: 'Sí, y suele ser donde más se nota. La automatización absorbe el pico de mensajes y confirmaciones sin contratar personal temporal, y en temporada baja sigue trabajando sin costo de operación adicional.',
      },
      {
        q: '¿Puede atender en inglés a los visitantes?',
        a: 'Sí. Los flujos se pueden configurar para responder en el idioma en que escribe la persona, algo relevante en un destino con demanda internacional. Los textos se revisan con el negocio antes de publicarlos.',
      },
      {
        q: '¿Se integra con el sistema de reservaciones que ya usamos?',
        a: 'Si el sistema permite integración por API o exportación, sí. Cuando no, diseñamos el flujo alrededor de lo que sí se puede conectar y lo dejamos explícito desde el diagnóstico, sin prometer una integración que no existe.',
      },
      {
        q: '¿Nos acompañan durante la temporada?',
        a: 'Sí. Después de liberar damos monitoreo y ajustes, que es cuando aparecen los casos que ninguna prueba anticipó. En temporada alta ese acompañamiento es parte del trabajo, no un extra opcional.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
      { label: 'Secretaría de Desarrollo Económico de Jalisco', href: 'https://sedeco.jalisco.gob.mx/' },
    ],
    relatedSlugs: [
      'automatiza-tu-negocio',
      'automatizar-mensajes-de-whatsapp-puerto-vallarta',
      'automatizar-whatsapp-business-puerto-vallarta',
      'automatizacion-de-mensajes-en-whatsapp-puerto-vallarta',
    ],
    hub: 'automatizacion',
    city: PUERTO_VALLARTA,
    ctaHref: '/diagnostico',
    ctaVerb: 'automatizar tu negocio',
  },

  // ───────────────────────────── B2 · genérica ─────────────────────────────
  {
    slug: 'automatizar-mensajes-de-whatsapp',
    keyword: 'automatizar mensajes de WhatsApp',
    h1: 'Automatizar mensajes de WhatsApp: cómo funciona realmente',
    metaTitle: 'Automatizar mensajes de WhatsApp: cómo funciona',
    metaDescription:
      'Cómo automatizar mensajes de WhatsApp: respuestas, plantillas aprobadas, ventana de 24 horas y flujos con escalamiento a una persona. Guía sin humo.',
    intro:
      'Automatizar mensajes de WhatsApp es posible y útil, pero no funciona como mucha publicidad sugiere: Meta define reglas concretas sobre cuándo puedes escribir, con qué mensaje y con qué consentimiento. Esta página explica la mecánica real —respuestas, plantillas, flujos y límites— para que decidas con información.',
    sections: [
      {
        title: 'Qué se puede automatizar en una conversación',
        body: [
          'Una conversación automatizada se compone de tres piezas: un disparador (algo que ocurre), una respuesta (lo que el sistema envía) y una salida (a dónde va la conversación cuando el flujo termina o se sale del guion). Casi todo el valor está en la tercera pieza, que es la que la mayoría de las implementaciones descuida.',
          'Se automatiza bien lo que se repite con la misma forma: horarios, ubicación, disponibilidad, estatus de un pedido, confirmación de una cita, recolección de datos antes de pasar con una persona. Se automatiza mal lo ambiguo: negociaciones, reclamos delicados o cualquier caso donde una respuesta incorrecta cuesta más que no responder.',
          'El criterio que usamos es simple: si un integrante nuevo del equipo podría responder esa pregunta leyendo un manual de una página, es automatizable. Si necesita contexto, historial o criterio, el flujo debe reconocerlo y entregar la conversación a una persona con lo que ya recopiló.',
        ],
      },
      {
        title: 'Las reglas de Meta que definen lo que puedes enviar',
        body: [
          'WhatsApp no es un canal abierto de envío. La plataforma distingue entre responder dentro de una conversación en curso y escribir por iniciativa propia, y cada caso tiene reglas distintas. Todo lo siguiente está documentado públicamente por Meta para la WhatsApp Business Platform.',
        ],
        bullets: [
          {
            title: 'Ventana de servicio de 24 horas',
            description:
              'Cuando una persona te escribe, se abre una ventana de 24 horas durante la cual puedes responder con mensajes libres. Fuera de esa ventana ya no puedes enviar texto arbitrario.',
          },
          {
            title: 'Plantillas aprobadas',
            description:
              'Para iniciar una conversación o escribir fuera de la ventana hay que usar una plantilla de mensaje previamente enviada a revisión y aprobada por Meta. No se improvisa el texto en el momento.',
          },
          {
            title: 'Consentimiento del destinatario',
            description:
              'La plataforma exige que la persona haya aceptado recibir mensajes por WhatsApp. Ese opt-in debe recogerse de forma clara y quedar registrado; no es un requisito decorativo.',
          },
          {
            title: 'Calidad del número',
            description:
              'Meta evalúa la calidad de tu número a partir de bloqueos y reportes de los usuarios. Un uso agresivo degrada esa calificación y puede restringir tu capacidad de envío.',
          },
        ],
      },
      {
        title: 'Cómo se arma un flujo que no molesta',
        body: [
          'Empezamos por escribir las diez preguntas que más recibe el negocio, con su respuesta real, tal como la daría la persona que hoy contesta. Ese documento es el guion. Si no existe, no hay flujo que valga: la automatización solo amplifica lo que ya se dice.',
          'Luego se define el ruteo. Cada respuesta termina en una de tres cosas: resuelve y cierra, ofrece una acción concreta (agendar, cotizar, ver disponibilidad) o pasa con una persona. Nunca en un callejón sin salida donde el usuario tenga que repetir «hola» para reactivar el flujo.',
          'Finalmente se decide el tono y los límites: qué no responde el bot, cómo se identifica como automatización, en qué horario avisa que la respuesta humana llegará más tarde. Un flujo honesto genera menos molestia que uno que finge ser una persona y se descubre a los dos mensajes.',
        ],
      },
      {
        title: 'Qué medir para saber si funciona',
        body: [
          'Las métricas útiles son cuatro: tiempo hasta la primera respuesta, porcentaje de conversaciones resueltas sin intervención humana, porcentaje de conversaciones que se atienden fuera de horario laboral y conversión a la acción que te importa (cita, cotización, pedido).',
          'La métrica que engaña es «mensajes enviados». Se puede inflar sin aportar nada y, en WhatsApp, un volumen alto de mensajes no deseados se paga con bloqueos y con la calificación de calidad del número. Medimos conversaciones útiles, no envíos.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Clock',
        title: 'Atención fuera de horario',
        description:
          'Los mensajes que llegan de noche o en fin de semana reciben respuesta inmediata a lo frecuente y quedan en cola ordenada para el equipo al día siguiente.',
      },
      {
        icon: 'ClipboardList',
        title: 'Calificación antes de pasar con ventas',
        description:
          'El flujo recopila qué necesita la persona, para cuándo y en qué zona, de modo que el vendedor recibe la conversación con contexto en lugar de empezar de cero.',
      },
      {
        icon: 'CalendarCheck',
        title: 'Confirmaciones y recordatorios',
        description:
          'Plantillas aprobadas que confirman una cita o pedido y recuerdan la fecha, con opción de reprogramar respondiendo el mismo mensaje.',
      },
      {
        icon: 'Headset',
        title: 'Escalamiento con historial',
        description:
          'Cuando el caso se sale del guion, la conversación pasa a una persona con todo lo que el flujo ya recopiló, sin pedirle al cliente que repita su historia.',
      },
    ],
    faq: [
      {
        q: '¿Puedo enviar mensajes de WhatsApp a quien quiera si automatizo?',
        a: 'No. La plataforma de WhatsApp Business requiere que la persona haya dado su consentimiento para recibir mensajes, y para iniciar una conversación hay que usar una plantilla previamente aprobada por Meta. Automatizar no elimina esos requisitos.',
      },
      {
        q: '¿Qué es la ventana de 24 horas?',
        a: 'Es el periodo que se abre cuando un usuario te escribe: durante esas 24 horas puedes responder con mensajes libres. Pasado ese tiempo, para retomar el contacto necesitas enviar una plantilla aprobada.',
      },
      {
        q: '¿El cliente se da cuenta de que habla con un bot?',
        a: 'Debería. Recomendamos que el flujo se identifique como respuesta automática y ofrezca desde el inicio la opción de hablar con una persona. Fingir ser humano genera desconfianza y suele descubrirse en dos o tres mensajes.',
      },
      {
        q: '¿Se puede automatizar sin perder la atención personalizada?',
        a: 'Sí, y es el diseño que recomendamos: la automatización resuelve lo repetitivo y entrega a una persona todo lo demás, con el historial ya recopilado. El objetivo es que el equipo llegue mejor informado a la conversación, no que desaparezca.',
      },
      {
        q: '¿Qué pasa si el bot no entiende una pregunta?',
        a: 'El flujo debe reconocerlo y pasar la conversación a una persona en lugar de insistir. Un flujo bien diseñado tiene siempre una salida a atención humana; si no la tiene, el usuario abandona y el negocio pierde la conversación.',
      },
    ],
    externalSources: [
      { label: 'INAI — protección de datos personales', href: 'https://home.inai.org.mx/' },
      { label: 'PROFECO (gob.mx)', href: 'https://www.gob.mx/profeco' },
    ],
    relatedSlugs: [
      'automatizar-mensajes-de-whatsapp-puerto-vallarta',
      'automatizar-whatsapp-business',
      'automatizacion-de-mensajes-en-whatsapp',
      'automatiza-tu-negocio',
    ],
    hub: 'automatizacion',
    ctaHref: '/contact',
    ctaVerb: 'automatizar tus mensajes de WhatsApp',
  },

  // ─────────────────────────────── B2 · PV ─────────────────────────────────
  {
    slug: 'automatizar-mensajes-de-whatsapp-puerto-vallarta',
    keyword: 'automatizar mensajes de WhatsApp',
    h1: 'Automatizar mensajes de WhatsApp en Puerto Vallarta',
    metaTitle: 'Automatizar mensajes de WhatsApp en Puerto Vallarta',
    metaDescription:
      'Automatizar mensajes de WhatsApp en Puerto Vallarta: primera respuesta inmediata, atención bilingüe y confirmaciones para negocios de la bahía.',
    intro:
      'En Puerto Vallarta la primera conversación con un cliente casi siempre pasa por WhatsApp, y muchas veces llega fuera de horario o desde otra zona horaria. Automatizar esos mensajes es, sobre todo, dejar de perder conversaciones por no estar disponible a las once de la noche de un sábado de temporada.',
    sections: [
      {
        title: 'Por qué el mensaje entrante manda en un destino turístico',
        body: [
          'Un visitante que planea su viaje escribe cuando puede, no cuando tu negocio abre: desde otra ciudad, otro país u otro huso horario. Si la respuesta llega doce horas después, la reservación ya se hizo en otro lado. Ese es el costo concreto de no automatizar en un destino como este.',
          'A eso se suma la estacionalidad. En temporada alta el volumen de mensajes se multiplica sobre el mismo equipo, y la calidad de la atención se cae justo cuando más importa. Un flujo automatizado no reemplaza a recepción o a ventas: absorbe lo repetitivo para que el equipo llegue a las conversaciones que sí requieren trato.',
          'El idioma es el tercer factor. Buena parte de la demanda escribe en inglés y espera respuesta en inglés. Un flujo puede detectar el idioma del primer mensaje y responder en consecuencia sin depender de quién esté de turno.',
        ],
      },
      {
        title: 'Qué se automatiza en negocios de la bahía',
        body: [
          'Estos son los flujos que más pedimos revisar cuando hacemos el diagnóstico de un negocio local. Son escenarios de operación del destino, no casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Disponibilidad y tarifas',
            description:
              'Respuesta inmediata a la pregunta que más se repite —«¿tienen disponibilidad para estas fechas?»— con recolección de fechas y número de personas antes de pasar con el equipo.',
          },
          {
            title: 'Instrucciones de llegada',
            description:
              'Ubicación, indicaciones desde el aeropuerto o el malecón, estacionamiento y horario de check-in enviados automáticamente al confirmar, en el idioma del huésped.',
          },
          {
            title: 'Recordatorio y reprogramación',
            description:
              'Plantilla aprobada que recuerda la reservación, el tour o la cita y permite reprogramar respondiendo, para liberar el lugar cuando alguien no puede asistir.',
          },
          {
            title: 'Recolección de datos para cotizar',
            description:
              'Preguntas breves que capturan lo indispensable para cotizar una propiedad, un evento o un servicio, de modo que el vendedor no arranque de cero.',
          },
        ],
      },
      {
        title: 'Lo que las reglas de Meta permiten y lo que no',
        body: [
          'Vale la pena decirlo claro porque en el destino circulan promesas que no se sostienen: no se pueden enviar mensajes masivos a listas compradas ni escribir a cualquier número por el hecho de tener WhatsApp Business. La plataforma exige consentimiento previo de la persona y, para iniciar conversación, una plantilla aprobada por Meta.',
          'Dentro de las 24 horas posteriores a que alguien te escribe puedes responder libremente; fuera de ese periodo, el contacto se retoma con plantilla. Además, Meta evalúa la calidad del número según bloqueos y reportes: un negocio de temporada que satura a sus contactos puede terminar con su número restringido justo antes del pico de demanda.',
          'Diseñar el flujo respetando esas reglas no es una limitación burocrática: es lo que mantiene el número operativo y la tasa de respuesta alta durante la temporada.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta concentra actividad de hospedaje, alimentos y bebidas, servicios turísticos e inmobiliarios; el Gobierno del Estado publica la ficha del municipio y la Secretaría de Turismo de Jalisco la información oficial del destino. Es un perfil donde la venta se decide por conversación, no por formulario.',
        'En la práctica eso significa bandejas de WhatsApp con decenas de conversaciones simultáneas, preguntas que se repiten casi idénticas y un equipo que además atiende presencialmente. La automatización de la primera respuesta y de las confirmaciones es la que más carga quita sin cambiar la forma de trabajar.',
        'Trabajamos desde Puerto Vallarta, así que el guion del flujo se arma con las preguntas reales que recibe el negocio —incluidas las que llegan en inglés— y se prueba con la operación antes de publicarlo.',
      ],
    },
    useCases: [
      {
        icon: 'PlaneTakeoff',
        title: 'Respuesta a visitantes en su huso horario',
        description:
          'El mensaje que entra de madrugada recibe respuesta inmediata con disponibilidad e información básica, y queda listo para que el equipo lo retome por la mañana.',
      },
      {
        icon: 'Globe',
        title: 'Atención bilingüe automática',
        description:
          'El flujo responde en español o inglés según el idioma del primer mensaje, sin depender de quién esté cubriendo el turno en ese momento.',
      },
      {
        icon: 'MapPin',
        title: 'Llegada y logística resueltas',
        description:
          'Ubicación, indicaciones desde el aeropuerto y datos de acceso enviados automáticamente al confirmar, reduciendo llamadas el día de la llegada.',
      },
      {
        icon: 'Ticket',
        title: 'Tours y reservaciones con recordatorio',
        description:
          'Confirmación y recordatorio por plantilla con opción de reprogramar, para bajar el no-show en actividades con cupo limitado.',
      },
    ],
    faq: [
      {
        q: '¿Pueden automatizar el WhatsApp de un hotel o una renta vacacional en Puerto Vallarta?',
        a: 'Sí. Es de los casos más frecuentes en la bahía: disponibilidad, confirmación, instrucciones de llegada y recordatorios. El equipo se queda con las peticiones especiales y con la atención en sitio.',
      },
      {
        q: '¿Responde en inglés a los huéspedes internacionales?',
        a: 'Sí. El flujo se configura para contestar en el idioma en que escribe la persona. Los textos en ambos idiomas se revisan con el negocio antes de publicarlos, para que suenen a la marca y no a traducción automática.',
      },
      {
        q: '¿Podemos mandar promociones de temporada a nuestra lista de clientes?',
        a: 'Solo a quienes hayan dado su consentimiento para recibir mensajes por WhatsApp, y usando una plantilla aprobada por Meta. No trabajamos con listas compradas: además de estar prohibido, es la vía rápida a que bloqueen y restrinjan tu número.',
      },
      {
        q: '¿Qué pasa en temporada alta con el volumen de mensajes?',
        a: 'Es cuando más rinde: el flujo atiende la primera respuesta de todas las conversaciones al mismo tiempo y prioriza las que requieren persona. La capacidad no depende de cuánta gente esté de turno esa noche.',
      },
      {
        q: '¿Trabajan presencialmente con negocios de la bahía?',
        a: 'Sí, nuestra sede está en Puerto Vallarta. La toma de requerimientos y la capacitación del equipo se hacen en sitio cuando conviene, que suele ser más rápido que explicarlo por correo.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Jalisco — Puerto Vallarta', href: 'https://www.jalisco.gob.mx/es/jalisco/municipios/puerto-vallarta' },
      { label: 'INAI — protección de datos personales', href: 'https://home.inai.org.mx/' },
    ],
    relatedSlugs: [
      'automatizar-mensajes-de-whatsapp',
      'automatizar-whatsapp-business-puerto-vallarta',
      'automatizacion-de-mensajes-en-whatsapp-puerto-vallarta',
      'automatiza-tu-negocio-puerto-vallarta',
    ],
    hub: 'automatizacion',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'automatizar tus mensajes de WhatsApp',
  },

  // ───────────────────────────── B3 · genérica ─────────────────────────────
  {
    slug: 'automatizar-whatsapp-business',
    keyword: 'automatizar WhatsApp Business',
    h1: 'Automatizar WhatsApp Business: la app, la API y qué puede cada una',
    metaTitle: 'Automatizar WhatsApp Business: app vs. API',
    metaDescription:
      'Automatizar WhatsApp Business: qué permite la app gratuita, qué desbloquea la API de WhatsApp Business Platform y cómo funciona la coexistencia.',
    intro:
      'Hay dos productos distintos con nombres parecidos y eso confunde a casi todo el mundo: la app de WhatsApp Business y la WhatsApp Business Platform (la API). Automatizar en una y en otra no es lo mismo, ni en alcance ni en requisitos. Aquí está la diferencia, sin marketing.',
    sections: [
      {
        title: 'Dos productos, dos techos distintos',
        body: [
          'La app de WhatsApp Business es la aplicación gratuita que se instala en un teléfono, pensada para negocios pequeños que atienden desde un dispositivo. Trae herramientas de automatización básicas y es suficiente para muchos negocios; su límite aparece cuando crece el volumen o el equipo.',
          'La WhatsApp Business Platform es la vía de integración por API: no tiene interfaz propia, se conecta a un sistema (un CRM, una consola de atención, un flujo a la medida) y está pensada para operaciones con varios agentes, integraciones y automatización real. Requiere una cuenta de WhatsApp Business verificada y un proveedor que la implemente.',
          'El error común es intentar sostener con la app una operación que ya necesita API: varias personas peleándose por un teléfono, mensajes que se pierden, cero registro de quién contestó qué. El error contrario también existe: montar una API completa para un negocio que atiende diez conversaciones al día.',
        ],
      },
      {
        title: 'Qué se puede automatizar con la app de WhatsApp Business',
        body: [
          'La app incluye herramientas que resuelven bastante sin desarrollo de por medio. Si tu operación cabe en un teléfono y una persona, empieza por aquí antes de contratar nada.',
        ],
        bullets: [
          {
            title: 'Mensaje de bienvenida',
            description:
              'Un texto que se envía automáticamente cuando alguien escribe por primera vez o después de un periodo de inactividad. Es la primera respuesta inmediata más barata que existe.',
          },
          {
            title: 'Mensaje de ausencia',
            description:
              'Respuesta automática fuera del horario que definas, para que quien escriba de noche sepa cuándo le van a contestar en lugar de quedarse sin señal.',
          },
          {
            title: 'Respuestas rápidas y etiquetas',
            description:
              'Atajos para respuestas frecuentes y etiquetas para clasificar conversaciones. No es automatización de flujo, pero reduce mucho el tecleo repetido.',
          },
          {
            title: 'Perfil y catálogo',
            description:
              'Horario, ubicación, sitio web y catálogo de productos disponibles sin que nadie tenga que escribirlos cada vez que se los preguntan.',
          },
        ],
      },
      {
        title: 'Qué desbloquea la API de WhatsApp Business Platform',
        body: [
          'Cuando el negocio necesita más de un agente, integración con sus sistemas o flujos condicionales, la API es el camino. Esto es lo que cambia respecto de la app.',
        ],
        bullets: [
          {
            title: 'Varios agentes sobre un mismo número',
            description:
              'La conversación deja de vivir en un teléfono: entra a una consola donde varias personas atienden, se asigna, se transfiere y queda registro de quién respondió.',
          },
          {
            title: 'Integración con tus sistemas',
            description:
              'El flujo puede consultar disponibilidad, estatus de un pedido o datos de un cliente en tu CRM o ERP y responder con información real, no con un texto fijo.',
          },
          {
            title: 'Plantillas para iniciar conversación',
            description:
              'Mensajes enviados a revisión y aprobados por Meta que permiten contactar fuera de la ventana de 24 horas: confirmaciones, recordatorios, avisos de estatus.',
          },
          {
            title: 'Automatización condicional y eventos',
            description:
              'Flujos con ramas según lo que responda la persona, y webhooks que disparan acciones en tus sistemas cuando ocurre algo en la conversación.',
          },
        ],
      },
      {
        title: 'Coexistencia: pasar a la API sin perder el número',
        body: [
          'La duda que frena a la mayoría es «si me paso a la API, ¿pierdo mi número y mis conversaciones?». Meta ofrece un modo de coexistencia que permite mantener la app de WhatsApp Business en el teléfono y a la vez conectar ese mismo número a la plataforma, de modo que el equipo puede seguir atendiendo desde el celular mientras la automatización opera en paralelo.',
          'Es la ruta que recomendamos para negocios que ya tienen su número publicado en tarjetas, letreros y anuncios: la transición se hace sin cambiar el número ni pedirle a los clientes que actualicen nada. Los detalles exactos de qué se conserva dependen de la configuración y conviene revisarlos caso por caso antes de mover nada.',
          'Nuestro criterio: no migramos a API por moda. Si con la app y un guion bien escrito el negocio resuelve, lo decimos. La API entra cuando hay equipo, volumen o integración de por medio.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Users',
        title: 'Bandeja compartida por el equipo',
        description:
          'Un solo número atendido por varias personas, con asignación, transferencia e historial completo en lugar de un teléfono que se pasa de mano en mano.',
      },
      {
        icon: 'Database',
        title: 'Respuestas con datos reales',
        description:
          'El flujo consulta tu sistema para responder disponibilidad, estatus de pedido o saldo, en vez de repetir un texto genérico que obliga a escalar todo.',
      },
      {
        icon: 'Send',
        title: 'Avisos por plantilla aprobada',
        description:
          'Confirmaciones, recordatorios y avisos de estatus enviados fuera de la ventana de 24 horas con plantillas revisadas y aprobadas por Meta.',
      },
      {
        icon: 'Repeat',
        title: 'Coexistencia app + API',
        description:
          'El equipo sigue atendiendo desde la app en el celular mientras la automatización trabaja sobre el mismo número, sin cambiar el contacto publicado.',
      },
    ],
    faq: [
      {
        q: '¿Cuál es la diferencia entre WhatsApp Business y la API de WhatsApp?',
        a: 'La app de WhatsApp Business es una aplicación gratuita para un teléfono, con automatizaciones básicas como mensaje de bienvenida y de ausencia. La WhatsApp Business Platform es una API sin interfaz propia que se integra a tus sistemas y permite varios agentes, flujos condicionales y plantillas.',
      },
      {
        q: '¿Puedo automatizar sin pagar, solo con la app?',
        a: 'Hasta cierto punto sí: mensaje de bienvenida, mensaje de ausencia, respuestas rápidas, etiquetas y catálogo. Es suficiente para un negocio que atiende desde un teléfono. El límite llega con varios agentes, integración a sistemas o flujos con ramas.',
      },
      {
        q: '¿Pierdo mi número si me cambio a la API?',
        a: 'No es necesario cambiar de número. Meta ofrece un modo de coexistencia que permite conectar el mismo número a la plataforma manteniendo la app en el teléfono. Qué se conserva exactamente depende de la configuración, así que se revisa antes de mover nada.',
      },
      {
        q: '¿Cuándo conviene dar el salto a la API?',
        a: 'Cuando más de una persona atiende el mismo número, cuando el flujo necesita datos de tus sistemas para responder o cuando necesitas enviar confirmaciones y recordatorios fuera de la ventana de 24 horas. Antes de eso, la app suele bastar.',
      },
      {
        q: '¿Qué se necesita para empezar con WhatsApp Business Platform?',
        a: 'Una cuenta de WhatsApp Business verificada, un número dedicado o en coexistencia, las plantillas de mensaje enviadas a aprobación y un proveedor que implemente y opere la integración. Nosotros hacemos ese acompañamiento completo.',
      },
    ],
    externalSources: [
      { label: 'INEGI — Censos Económicos', href: 'https://www.inegi.org.mx/programas/dce/' },
      { label: 'CANACINTRA', href: 'https://canacintra.org.mx/' },
    ],
    relatedSlugs: [
      'automatizar-whatsapp-business-puerto-vallarta',
      'automatizar-mensajes-de-whatsapp',
      'automatizacion-de-mensajes-en-whatsapp',
      'automatiza-tu-negocio',
    ],
    hub: 'automatizacion',
    ctaHref: '/contact',
    ctaVerb: 'automatizar tu WhatsApp Business',
  },

  // ─────────────────────────────── B3 · PV ─────────────────────────────────
  {
    slug: 'automatizar-whatsapp-business-puerto-vallarta',
    keyword: 'automatizar WhatsApp Business',
    h1: 'Automatizar WhatsApp Business en Puerto Vallarta',
    metaTitle: 'Automatizar WhatsApp Business en Puerto Vallarta',
    metaDescription:
      'Automatizar WhatsApp Business en Puerto Vallarta: cuándo basta la app, cuándo conviene la API y cómo migrar sin cambiar el número del negocio.',
    intro:
      'Casi todo negocio de la bahía tiene su número de WhatsApp impreso en el letrero, en la tarjeta y en el anuncio del portal de reservaciones. La pregunta no es si automatizar, sino hasta dónde llega la app gratuita y en qué momento conviene conectar ese mismo número a la API sin perderlo.',
    sections: [
      {
        title: 'El punto en el que la app deja de alcanzar',
        body: [
          'En un negocio de Puerto Vallarta la señal de que la app se quedó corta suele ser física: el teléfono del negocio pasa de recepción a ventas y de ventas a la dueña, nadie sabe quién contestó qué, y en temporada alta hay conversaciones que simplemente se pierden entre las demás.',
          'La segunda señal es la falta de datos. Cuando el visitante pregunta por disponibilidad de fechas concretas y la respuesta exige que alguien abra el sistema de reservaciones, cada consulta cuesta minutos. Con integración, el flujo consulta y responde; con la app, no hay forma.',
          'La tercera es la estacionalidad: mensajes que llegan de madrugada desde otro huso horario, en inglés, y que solo reciben el mensaje de ausencia. Funciona en temporada baja; en temporada alta es dinero que se va a otro alojamiento o a otra agencia.',
        ],
      },
      {
        title: 'Qué resuelve cada opción en la operación local',
        body: [
          'Estas son las diferencias que importan en la práctica para un negocio de la bahía. Son escenarios de operación típicos del destino, no casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'App: negocio de un teléfono',
            description:
              'Un consultorio, un taller o un restaurante pequeño con una persona atendiendo: mensaje de bienvenida, horario, ubicación y respuestas rápidas resuelven la mayor parte.',
          },
          {
            title: 'API: varios agentes en temporada',
            description:
              'Hotel, agencia de tours o inmobiliaria donde recepción, ventas y administración atienden el mismo número; la conversación se asigna y queda registro de quién respondió.',
          },
          {
            title: 'API: disponibilidad en tiempo real',
            description:
              'El flujo consulta el sistema de reservaciones o el inventario de propiedades y responde con datos reales en lugar de escalar cada consulta a una persona.',
          },
          {
            title: 'API: avisos por plantilla',
            description:
              'Confirmación de reservación, instrucciones de llegada y recordatorio de tour enviados fuera de la ventana de 24 horas con plantillas aprobadas por Meta.',
          },
        ],
      },
      {
        title: 'Migrar sin tocar el número que ya está publicado',
        body: [
          'En un destino turístico el número de WhatsApp es un activo: aparece en el letrero, en la tarjeta, en el portal de reservaciones y en reseñas de años. Cambiarlo no es una opción realista, y ese es justo el miedo que frena la decisión.',
          'Meta ofrece un modo de coexistencia que permite mantener la app de WhatsApp Business en el teléfono y conectar el mismo número a la plataforma. En la práctica, el equipo sigue atendiendo desde el celular como siempre mientras la automatización opera sobre el mismo número. Qué se conserva exactamente depende de la configuración, así que se revisa antes de mover nada.',
          'Nuestra recomendación operativa para negocios de temporada: hacer la migración en temporada baja, con el equipo entrenado y el flujo probado, para llegar al pico con todo funcionando. Mover la infraestructura de atención en plena temporada alta es el peor momento posible.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los destinos con mayor actividad turística de Jalisco; la Secretaría de Turismo del estado y el Ayuntamiento publican la información oficial del destino y del municipio. Esa actividad se traduce en negocios que reciben conversación entrante todo el año, con picos marcados.',
        'La consecuencia operativa: en la bahía el número de WhatsApp funciona como recepción, conmutador y punto de venta al mismo tiempo. Cuando ese número lo atienden tres personas desde un solo teléfono, el problema deja de ser de atención y pasa a ser de infraestructura.',
        'Trabajamos desde Puerto Vallarta y acompañamos la migración completa: verificación de la cuenta, plantillas enviadas a aprobación, integración con el sistema que ya usa el negocio y capacitación presencial del equipo que va a operar la consola.',
      ],
    },
    useCases: [
      {
        icon: 'Headset',
        title: 'Recepción, ventas y administración en un número',
        description:
          'Un solo número atendido por varias áreas, con asignación y transferencia, en lugar de un teléfono que circula por el mostrador durante la temporada.',
      },
      {
        icon: 'CalendarCheck',
        title: 'Disponibilidad consultada al momento',
        description:
          'El flujo revisa el sistema de reservaciones o el inventario de propiedades y responde fechas y opciones sin esperar a que alguien lo abra.',
      },
      {
        icon: 'Send',
        title: 'Confirmaciones de llegada automáticas',
        description:
          'Plantillas aprobadas que envían confirmación, indicaciones desde el aeropuerto y recordatorio, incluso días después de la última conversación.',
      },
      {
        icon: 'Repeat',
        title: 'Mismo número, misma app, más capacidad',
        description:
          'Coexistencia para no cambiar el número publicado en letreros y portales: el equipo sigue en la app y la automatización trabaja en paralelo.',
      },
    ],
    faq: [
      {
        q: '¿Tengo que cambiar el número de WhatsApp de mi negocio en Puerto Vallarta?',
        a: 'No necesariamente. El modo de coexistencia de Meta permite conectar el mismo número a la plataforma manteniendo la app en el teléfono. Revisamos tu configuración antes de mover nada, porque qué se conserva depende del caso.',
      },
      {
        q: '¿Con la app gratuita alcanza para un hotel pequeño?',
        a: 'Depende del volumen y de cuántas personas atiendan. Si atiende una sola persona desde un teléfono, la app con mensaje de bienvenida, ausencia y respuestas rápidas suele bastar. Si recepción y ventas comparten el número, es momento de la API.',
      },
      {
        q: '¿Cuándo conviene hacer la migración en un negocio de temporada?',
        a: 'En temporada baja. Se implementa, se prueba con casos reales y se capacita al equipo con calma, para llegar al pico de demanda con el flujo estable. Migrar en plena temporada alta es el escenario que menos recomendamos.',
      },
      {
        q: '¿Se integra con el sistema de reservaciones que ya usamos?',
        a: 'Si el sistema permite integración por API, sí, y esa es la mayor ventaja de la plataforma. Cuando no la permite, lo decimos desde el diagnóstico y diseñamos el flujo alrededor de lo que sí se puede conectar.',
      },
      {
        q: '¿Ustedes se encargan del trámite con Meta?',
        a: 'Sí. Acompañamos la verificación de la cuenta de WhatsApp Business, la preparación de las plantillas que se envían a aprobación y la configuración técnica. Los tiempos de revisión los define Meta, no nosotros.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Turismo de Jalisco', href: 'https://secturjal.jalisco.gob.mx/' },
      { label: 'Ayuntamiento de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/gobierno' },
    ],
    relatedSlugs: [
      'automatizar-whatsapp-business',
      'automatizar-mensajes-de-whatsapp-puerto-vallarta',
      'automatizacion-de-mensajes-en-whatsapp-puerto-vallarta',
      'automatiza-tu-negocio-puerto-vallarta',
    ],
    hub: 'automatizacion',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'automatizar tu WhatsApp Business',
  },

  // ───────────────────────────── B4 · genérica ─────────────────────────────
  {
    slug: 'automatizacion-de-mensajes-en-whatsapp',
    keyword: 'automatización de mensajes en WhatsApp',
    h1: 'Automatización de mensajes en WhatsApp: casos e indicadores',
    metaTitle: 'Automatización de mensajes en WhatsApp: casos',
    metaDescription:
      'Automatización de mensajes en WhatsApp por industria y los indicadores que sí importan: tiempo de respuesta, resolución sin humano y carga del equipo.',
    intro:
      'La pregunta útil no es si se puede automatizar WhatsApp, sino qué cambia en tu operación cuando lo haces y cómo lo compruebas. Esta página recorre los casos por industria que vemos con más frecuencia y los indicadores con los que medimos si la automatización sirvió o solo agregó ruido.',
    sections: [
      {
        title: 'Casos por industria',
        body: [
          'El tipo de conversación cambia mucho según el giro, y con él lo que conviene automatizar. Estos son patrones de operación que se repiten; los tratamos como escenarios, no como casos de clientes específicos.',
        ],
        bullets: [
          {
            title: 'Comercio y e-commerce',
            description:
              'Estatus del pedido, disponibilidad, políticas de cambio y guía de rastreo. Es el giro donde más consultas se resuelven sin intervención humana porque la respuesta está en un sistema.',
          },
          {
            title: 'Servicios profesionales',
            description:
              'Calificación del prospecto antes de agendar: qué necesita, para cuándo, alcance aproximado. El equipo entra a la conversación con contexto en vez de invertir la primera llamada en descubrirlo.',
          },
          {
            title: 'Salud y consultorios',
            description:
              'Agenda, recordatorio de cita e indicaciones previas. Requiere cuidado especial con los datos personales: se recolecta lo mínimo y se maneja conforme a la normativa aplicable.',
          },
          {
            title: 'Educación y capacitación',
            description:
              'Información de programas, requisitos, fechas y proceso de inscripción, con recolección de datos del interesado para que admisiones dé seguimiento.',
          },
          {
            title: 'Inmobiliaria',
            description:
              'Presupuesto, zona y tipo de propiedad recogidos por mensaje, envío de fichas que coinciden y agenda de visitas, con el prospecto ya calificado.',
          },
          {
            title: 'Servicios a domicilio y talleres',
            description:
              'Cotización orientativa a partir de unas preguntas, agenda del servicio y aviso de estatus, reduciendo llamadas de seguimiento al taller.',
          },
        ],
      },
      {
        title: 'Los indicadores que sí dicen algo',
        body: [
          'Antes de implementar definimos la línea base: cómo está hoy cada indicador. Sin ese número previo, cualquier resultado posterior es una anécdota. Estos son los cuatro que usamos.',
        ],
        bullets: [
          {
            title: 'Tiempo hasta la primera respuesta',
            description:
              'Cuánto tarda el negocio en contestar el primer mensaje. Es el indicador que más rápido se mueve con automatización y el que más pesa en la decisión de compra.',
          },
          {
            title: 'Resolución sin intervención humana',
            description:
              'Qué porcentaje de conversaciones termina sin que una persona tenga que entrar. Sube conforme el guion se afina con las preguntas reales que llegan.',
          },
          {
            title: 'Conversaciones atendidas fuera de horario',
            description:
              'Cuántas conversaciones se atienden de noche, fin de semana o en días festivos. Suele ser el volumen que antes simplemente se perdía.',
          },
          {
            title: 'Carga por persona del equipo',
            description:
              'Cuántas conversaciones atiende cada integrante y cuántas de ellas eran repetitivas. Es el indicador que justifica el proyecto ante el equipo, no solo ante dirección.',
          },
        ],
      },
      {
        title: 'Cómo medirlo sin engañarse',
        body: [
          'Hay dos trampas frecuentes. La primera es celebrar el volumen: «enviamos diez mil mensajes» no dice nada si nadie respondió, y en WhatsApp el envío indiscriminado se paga con bloqueos y con la calificación de calidad que Meta asigna al número.',
          'La segunda es medir solo el mes del lanzamiento, cuando el equipo está atento y el flujo recién revisado. La medición honesta compara periodos equivalentes —misma temporada, mismo tipo de semana— y se repite pasados dos o tres meses.',
          'También conviene revisar lo que falla: la lista de conversaciones donde el flujo no supo qué hacer es el mejor insumo para la siguiente versión del guion. Una automatización que nadie revisa se degrada, porque el negocio cambia y el guion se queda igual.',
        ],
      },
      {
        title: 'Qué no resuelve la automatización',
        body: [
          'No arregla un producto que decepciona ni un servicio que llega tarde: solo hace que la queja llegue más rápido y mejor documentada. Tampoco sustituye la negociación, el manejo de un cliente molesto ni las decisiones que requieren contexto del negocio.',
          'Y no es una máquina de enviar promociones. WhatsApp exige consentimiento previo del destinatario y plantillas aprobadas para iniciar conversación; quien promete envíos masivos a listas compradas está describiendo algo que la plataforma prohíbe y que termina con el número restringido.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Timer',
        title: 'Primera respuesta en segundos',
        description:
          'Toda conversación entrante recibe respuesta inmediata con la información básica, mientras el sistema decide si puede resolverla o si la escala.',
      },
      {
        icon: 'TrendingUp',
        title: 'Prospectos calificados antes de ventas',
        description:
          'El flujo recopila necesidad, plazo y alcance, de modo que el equipo comercial dedica su tiempo a las conversaciones con intención real.',
      },
      {
        icon: 'ShoppingCart',
        title: 'Estatus de pedido autoservicio',
        description:
          'El cliente consulta su pedido por mensaje y recibe el estatus desde el sistema, sin ocupar a una persona en una consulta que se repite todo el día.',
      },
      {
        icon: 'BarChart3',
        title: 'Tablero de conversaciones',
        description:
          'Volumen, tiempo de respuesta, resolución automática y escalamientos en un reporte periódico, para decidir con datos qué ajustar del guion.',
      },
    ],
    faq: [
      {
        q: '¿Qué industrias aprovechan mejor la automatización de mensajes en WhatsApp?',
        a: 'Las que reciben muchas consultas repetidas con respuesta objetiva: comercio, servicios a domicilio, salud, educación e inmobiliaria. En general, cualquier giro donde la primera conversación decide si el cliente sigue contigo o se va con otro.',
      },
      {
        q: '¿Qué indicadores debo medir?',
        a: 'Tiempo hasta la primera respuesta, porcentaje de conversaciones resueltas sin intervención humana, conversaciones atendidas fuera de horario y carga por persona del equipo. Con la línea base tomada antes de implementar, para poder comparar.',
      },
      {
        q: '¿Cuánto tarda en verse el efecto?',
        a: 'El tiempo de primera respuesta cambia desde el primer día. La resolución sin intervención humana sube gradualmente, conforme el guion se ajusta con las preguntas reales que llegan durante las primeras semanas.',
      },
      {
        q: '¿Se puede usar para campañas masivas?',
        a: 'No como se suele entender. WhatsApp requiere consentimiento previo de cada destinatario y plantillas aprobadas por Meta para iniciar conversación. Los envíos a listas sin consentimiento están prohibidos y degradan la calidad del número hasta restringirlo.',
      },
      {
        q: '¿Qué pasa con los datos personales de los clientes?',
        a: 'Se recolecta lo mínimo necesario para el trámite, se informa para qué se usa y se maneja conforme a la normativa mexicana de protección de datos personales. En giros como salud ese diseño se define antes de escribir el primer mensaje del flujo.',
      },
    ],
    externalSources: [
      { label: 'INEGI — DENUE', href: 'https://www.inegi.org.mx/app/mapa/denue/' },
      { label: 'COPARMEX', href: 'https://coparmex.org.mx/' },
    ],
    relatedSlugs: [
      'automatizacion-de-mensajes-en-whatsapp-puerto-vallarta',
      'automatizar-mensajes-de-whatsapp',
      'automatizar-whatsapp-business',
      'automatiza-tu-negocio',
    ],
    hub: 'automatizacion',
    ctaHref: '/contact',
    ctaVerb: 'automatizar tus conversaciones',
  },

  // ─────────────────────────────── B4 · PV ─────────────────────────────────
  {
    slug: 'automatizacion-de-mensajes-en-whatsapp-puerto-vallarta',
    keyword: 'automatización de mensajes en WhatsApp',
    h1: 'Automatización de mensajes en WhatsApp en Puerto Vallarta',
    metaTitle: 'Automatización de mensajes en WhatsApp en Puerto Vallarta',
    metaDescription:
      'Automatización de mensajes en WhatsApp en Puerto Vallarta: casos de hotelería, restaurantes, inmobiliaria y salud, con los indicadores para medirla.',
    intro:
      'En la bahía la conversación de WhatsApp es el mostrador del negocio: por ahí entra la reservación, la pregunta del huésped y el prospecto de una propiedad. Esta página recoge los casos por industria que vemos en Puerto Vallarta y los indicadores con los que comprobamos si la automatización realmente cambió la operación.',
    sections: [
      {
        title: 'Casos por industria en la bahía',
        body: [
          'Cada giro del destino tiene su propio patrón de conversación. Estos son escenarios de operación que se repiten en Puerto Vallarta, descritos como tales y no como casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Hotelería y renta vacacional',
            description:
              'Disponibilidad por fechas, confirmación, instrucciones de llegada y coordinación de check-in. El pico de consultas llega de madrugada, desde otros husos horarios.',
          },
          {
            title: 'Restaurantes y bares',
            description:
              'Reservación de mesa, horario, ubicación y menú del día. En temporada alta la mayoría de las consultas son idénticas y llegan todas a la misma hora.',
          },
          {
            title: 'Tours y actividades',
            description:
              'Cupo, punto de encuentro, qué llevar y aviso por clima. La confirmación previa con opción de reprogramar es lo que más reduce lugares perdidos.',
          },
          {
            title: 'Inmobiliaria y administración de propiedades',
            description:
              'Presupuesto y zona del interesado, envío de fichas, agenda de visitas y, del otro lado, seguimiento a pagos y mantenimiento con propietarios y residentes.',
          },
          {
            title: 'Salud y bienestar',
            description:
              'Agenda de citas y recordatorios para consultorios, spas y clínicas que atienden tanto a residentes como a visitantes, con manejo cuidadoso de datos personales.',
          },
          {
            title: 'Servicios y proveedores locales',
            description:
              'Cotización orientativa, agenda del servicio y aviso de estatus para talleres, mantenimiento y proveedores que atienden a hoteles y condominios.',
          },
        ],
      },
      {
        title: 'Indicadores que importan en un negocio de temporada',
        body: [
          'A los cuatro indicadores habituales —tiempo de primera respuesta, resolución sin persona, atención fuera de horario y carga del equipo— en Vallarta hay que sumarles la lectura por temporada. Comparar noviembre contra agosto no dice nada; hay que comparar contra el mismo periodo del ciclo anterior.',
          'El indicador local más revelador suele ser el porcentaje de conversaciones atendidas de madrugada y en fin de semana. Es el volumen que antes se perdía completo y el que primero aparece cuando se activa el flujo.',
          'El segundo es la proporción de consultas en inglés que se resuelven sin esperar a que esté de turno alguien bilingüe. En un destino con demanda internacional, esa espera es exactamente el punto donde la reservación se va a otro lado.',
        ],
      },
      {
        title: 'Qué no arregla, aunque lo prometan',
        body: [
          'La automatización no compensa un servicio que no cumple: si la habitación no está lista o el tour sale tarde, el flujo solo hace que el reclamo llegue más rápido. Tampoco sustituye el trato personal que distingue a los negocios del destino; ese es justamente el tiempo que se busca liberar.',
          'Y no habilita envíos masivos de promociones de temporada a listas sin consentimiento: WhatsApp exige que la persona haya aceptado recibir mensajes y que las conversaciones iniciadas por el negocio usen plantillas aprobadas por Meta. Quien ofrezca lo contrario está poniendo en riesgo el número del negocio justo antes de la temporada.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es un destino de playa consolidado dentro de la oferta turística nacional que promueve la Secretaría de Turismo federal, y su directorio de unidades económicas —consultable en el DENUE del INEGI— refleja un tejido de hospedaje, alimentos y bebidas, comercio y servicios inmobiliarios de tamaño pequeño y mediano.',
        'Ese perfil —muchos negocios compactos atendiendo a un flujo internacional con picos marcados— es el que hace que la conversación de WhatsApp sea el cuello de botella real de la operación. No falta demanda: falta capacidad de contestar a tiempo cuando llegan todas las consultas juntas.',
        'Como estamos en Puerto Vallarta, el diagnóstico parte de la bandeja real del negocio: qué se pregunta, en qué idioma, a qué hora y cuántas veces. De ahí sale el guion, y de ahí salen también los indicadores con los que se va a medir el resultado.',
      ],
    },
    useCases: [
      {
        icon: 'BedDouble',
        title: 'Consultas de disponibilidad de madrugada',
        description:
          'La pregunta por fechas recibe respuesta inmediata y queda registrada con los datos del interesado, en lugar de esperar a que abra recepción.',
      },
      {
        icon: 'Ticket',
        title: 'Confirmación de tours con reprogramación',
        description:
          'Recordatorio previo con opción de confirmar, cancelar o mover, para liberar el cupo a tiempo cuando alguien no puede asistir.',
      },
      {
        icon: 'Building2',
        title: 'Seguimiento a propietarios y residentes',
        description:
          'Avisos de pago, reportes de mantenimiento y coordinación de accesos para administradoras de condominios, sin perseguir a nadie por teléfono.',
      },
      {
        icon: 'Globe',
        title: 'Consultas en inglés resueltas al momento',
        description:
          'El flujo responde en el idioma del visitante sin depender de quién esté de turno, y escala a una persona bilingüe solo cuando hace falta.',
      },
    ],
    faq: [
      {
        q: '¿Funciona para un negocio pequeño de Puerto Vallarta?',
        a: 'Sí, y suele ser donde más se nota: un equipo de dos o tres personas no puede cubrir la madrugada ni el pico de temporada, y ahí es donde la primera respuesta automática evita perder la conversación.',
      },
      {
        q: '¿Cómo se mide el resultado en un negocio de temporada?',
        a: 'Comparando contra el mismo periodo del ciclo anterior, no contra el mes pasado. Los indicadores base son tiempo de primera respuesta, conversaciones atendidas fuera de horario, resolución sin persona y carga del equipo.',
      },
      {
        q: '¿Puede atender consultas en inglés de los visitantes?',
        a: 'Sí. El flujo responde en el idioma del primer mensaje y escala a una persona bilingüe cuando el caso lo requiere. Los textos en ambos idiomas se revisan con el negocio antes de publicarse.',
      },
      {
        q: '¿Sirve también para la relación con propietarios y proveedores?',
        a: 'Sí. En administración de propiedades y en servicios a hoteles, buena parte del trabajo repetitivo está del lado interno: avisos de pago, reportes de mantenimiento y coordinación de accesos se automatizan igual que la atención al cliente.',
      },
      {
        q: '¿Pueden implementarlo antes de que empiece la temporada?',
        a: 'Es lo que recomendamos. Se implementa y se prueba en temporada baja para llegar al pico con el guion afinado y el equipo capacitado. Los tiempos dependen del alcance y de la aprobación de plantillas por parte de Meta.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Turismo (gob.mx)', href: 'https://www.gob.mx/sectur' },
      { label: 'INEGI — DENUE', href: 'https://www.inegi.org.mx/app/mapa/denue/' },
    ],
    relatedSlugs: [
      'automatizacion-de-mensajes-en-whatsapp',
      'automatizar-mensajes-de-whatsapp-puerto-vallarta',
      'automatizar-whatsapp-business-puerto-vallarta',
      'automatiza-tu-negocio-puerto-vallarta',
    ],
    hub: 'automatizacion',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'automatizar tus conversaciones',
  },
];
