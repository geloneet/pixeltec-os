/**
 * Contenido de las páginas locales de Desarrollo Web y Consultoría
 * (WO-2026-00128, ampliación 2026-08-28 — mismo patrón que
 * automatizacion-local.ts, ver ese archivo para las reglas de enlazado).
 *
 * Miguel confirmó: "Desarrollo de Apps" NO se separa como servicio propio,
 * sigue dentro de Ecosistemas Web ("Desarrollo Web"). El slug de URL usa
 * "desarrollo-web-<ciudad>" (término que la gente busca) aunque el servicio
 * interno se llame "ecosistemas-web" — el contenido de cada página es
 * distinto por ciudad Y por servicio (nunca el mismo texto de
 * automatizacion-<ciudad> con el título cambiado).
 */

export interface LocalServiceCity {
  slug: string;
  city: string;
  region: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  contextTitle: string;
  contextBody: string[];
  useCases: { icon: 'MessageSquareText' | 'FileScan' | 'BarChart3' | 'MailCheck' | 'Factory' | 'Building2'; title: string; description: string }[];
  faq: { q: string; a: string }[];
  /** 2 fuentes: la local (cámara/gobierno de la ciudad) y una nacional del
   *  mismo tipo de autoridad — más señal, sin caer en link-stuffing. */
  externalSources: { label: string; href: string }[];
  neighborSlugs: string[];
}

export interface LocalServiceDefinition {
  serviceSlug: 'ecosistemas-web' | 'consultoria';
  serviceHref: string;
  serviceLabel: string;
  ctaVerb: string;
  cities: LocalServiceCity[];
}

export const DESARROLLO_WEB_CITIES: LocalServiceCity[] = [
  {
    slug: 'desarrollo-web-guadalajara',
    city: 'Guadalajara',
    region: 'Jalisco',
    metaTitle: 'Desarrollo Web y Ecosistemas Digitales en Guadalajara',
    metaDescription:
      'CRMs, portales corporativos y e-commerce a la medida para empresas de Guadalajara. Next.js, React y arquitecturas escalables. Diagnóstico gratuito.',
    h1: 'Desarrollo Web y Ecosistemas Digitales en Guadalajara',
    intro:
      'PixelTEC construye CRMs, portales corporativos y plataformas e-commerce a la medida para empresas de Guadalajara que necesitan tecnología propia, no plantillas genéricas.',
    contextTitle: 'Por qué desarrollar a la medida en Guadalajara',
    contextBody: [
      'Guadalajara concentra el principal clúster de alta tecnología del país, con más de 150 empresas de electrónica y TI agrupadas en CANIETI Occidente. En ese entorno, competir con un sitio de plantilla o un sistema interno genérico es quedarse atrás.',
      'Las empresas de manufactura, TI y servicios de la zona necesitan portales de proveedores, CRMs integrados con su ERP y dashboards de producción hechos a su medida — no software genérico que no habla el lenguaje de su operación.',
    ],
    useCases: [
      {
        icon: 'Building2',
        title: 'Portales corporativos multilenguaje',
        description: 'Sitios corporativos rápidos en Next.js/React, con versión en inglés para clientes y proveedores internacionales.',
      },
      {
        icon: 'FileScan',
        title: 'CRMs integrados con tu ERP',
        description: 'Sistemas de gestión a medida que se conectan con el ERP que ya usas, sin doble captura de información.',
      },
      {
        icon: 'BarChart3',
        title: 'Dashboards de producción en tiempo real',
        description: 'Paneles que consolidan datos de planta y producción para que dirección tome decisiones con información actualizada.',
      },
      {
        icon: 'MailCheck',
        title: 'E-commerce B2B para proveedores',
        description: 'Plataformas de pedidos y cotización en línea para relaciones proveedor-cliente entre empresas.',
      },
    ],
    faq: [
      {
        q: '¿Construyen portales para empresas de manufactura?',
        a: 'Sí. Diseñamos portales corporativos y de proveedores a la medida para empresas de manufactura y TI de Guadalajara.',
      },
      {
        q: '¿Integran el sitio o CRM con nuestro ERP actual?',
        a: 'Sí. Conectamos el sistema nuevo con tu ERP, CRM o facturación existente mediante APIs, sin doble captura.',
      },
      {
        q: '¿Cuánto tarda un sitio corporativo o CRM a la medida?',
        a: 'Depende del alcance: un sitio corporativo suele tomar de 3 a 6 semanas; un CRM a la medida, de 6 a 10 semanas.',
      },
    ],
    externalSources: [
      { label: 'CANIETI Occidente', href: 'https://www.canietisedeoccidente.org/' },
      { label: 'CANIETI (nacional)', href: 'https://canieti.org/' },
    ],
    neighborSlugs: ['desarrollo-web-zapopan'],
  },
  {
    slug: 'desarrollo-web-zapopan',
    city: 'Zapopan',
    region: 'Jalisco',
    metaTitle: 'Desarrollo Web y Ecosistemas Digitales en Zapopan',
    metaDescription:
      'Portales de clientes, CRMs y sitios corporativos para despachos, aseguradoras y empresas de servicios de Zapopan. Diagnóstico gratuito.',
    h1: 'Desarrollo Web y Ecosistemas Digitales en Zapopan',
    intro:
      'PixelTEC diseña portales de clientes, CRMs y sitios corporativos a la medida para despachos, aseguradoras y empresas de servicios profesionales de Zapopan.',
    contextTitle: 'Por qué desarrollar a la medida en Zapopan',
    contextBody: [
      'Zapopan concentra el corredor corporativo de Puerta de Hierro: torres de oficinas, despachos y aseguradoras que operan con sistemas internos muchas veces heredados o improvisados en Excel compartido.',
      'Un portal de clientes o un CRM a la medida —no un software genérico de catálogo— es lo que le permite a estas empresas dar seguimiento profesional a pólizas, expedientes y cotizaciones sin depender de hojas de cálculo.',
    ],
    useCases: [
      {
        icon: 'Building2',
        title: 'Portales de clientes para despachos',
        description: 'Portales donde tus clientes consultan el estatus de su expediente, póliza o trámite sin llamar a preguntar.',
      },
      {
        icon: 'FileScan',
        title: 'CRM a la medida para aseguradoras',
        description: 'Sistemas de gestión de pólizas y siniestros diseñados para tu flujo real de trabajo, no adaptados de un software genérico.',
      },
      {
        icon: 'BarChart3',
        title: 'Sitios corporativos para servicios profesionales',
        description: 'Sitios rápidos y profesionales para despachos, consultoras y administradoras que operan desde Zapopan.',
      },
      {
        icon: 'MailCheck',
        title: 'Migración de Excel a sistema real',
        description: 'Convertimos flujos que hoy viven en hojas de Excel compartidas en un sistema con permisos, historial y reportes.',
      },
    ],
    faq: [
      {
        q: '¿Diseñan portales para despachos y aseguradoras en Zapopan?',
        a: 'Sí. Trabajamos con despachos, aseguradoras y administradoras de la zona de Puerta de Hierro y el resto de Zapopan.',
      },
      {
        q: '¿Pueden migrar lo que hoy tenemos en Excel a un sistema real?',
        a: 'Sí, es de los proyectos más comunes: convertimos flujos de Excel compartido en un CRM o sistema con permisos y reportes.',
      },
      {
        q: '¿Ofrecen diagnóstico antes de cotizar el desarrollo?',
        a: 'Sí, sin costo. Revisamos qué tienes hoy y te decimos exactamente qué construir primero.',
      },
    ],
    externalSources: [
      { label: 'INDEX Occidente (CCIJ)', href: 'https://www.ccij.org.mx/index/' },
      { label: 'CANIETI (nacional)', href: 'https://canieti.org/' },
    ],
    neighborSlugs: ['desarrollo-web-guadalajara'],
  },
  {
    slug: 'desarrollo-web-puerto-vallarta',
    city: 'Puerto Vallarta',
    region: 'Jalisco',
    metaTitle: 'Desarrollo Web y Ecosistemas Digitales en Puerto Vallarta',
    metaDescription:
      'PixelTEC tiene su sede en Puerto Vallarta. Sitios, motores de reservación y portales a la medida para hoteles, restaurantes e inmobiliarias.',
    h1: 'Desarrollo Web y Ecosistemas Digitales en Puerto Vallarta',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta. Construimos sitios, motores de reservación y portales a la medida para hoteles, restaurantes e inmobiliarias de la bahía.',
    contextTitle: 'Por qué desarrollar a la medida en Puerto Vallarta',
    contextBody: [
      'Muchos negocios turísticos de Puerto Vallarta operan con plataformas de terceros (motores de reservación genéricos, plantillas de WordPress) que cobran comisión por reservación o no reflejan la marca del negocio.',
      'Somos de aquí: construimos sitios y motores de reservación propios —sin comisión por reservación, con la marca y el diseño del negocio— para hoteles boutique, restaurantes e inmobiliarias de la zona.',
    ],
    useCases: [
      {
        icon: 'Building2',
        title: 'Motores de reservación propios',
        description: 'Sistemas de reservación sin comisión por reserva, integrados con tu calendario y sistema de pagos.',
      },
      {
        icon: 'FileScan',
        title: 'Portales para inmobiliarias',
        description: 'Catálogos de propiedades con búsqueda, filtros y formularios de contacto integrados a tu CRM.',
      },
      {
        icon: 'BarChart3',
        title: 'Sitios corporativos para restaurantes y hoteles',
        description: 'Sitios rápidos y a la medida, con menú/tarifas siempre actualizados y sin depender de una plantilla genérica.',
      },
      {
        icon: 'MailCheck',
        title: 'E-commerce y venta de experiencias',
        description: 'Plataformas para vender paquetes, tours o experiencias en línea con pago integrado.',
      },
    ],
    faq: [
      {
        q: '¿PixelTEC está en Puerto Vallarta?',
        a: 'Sí, nuestra sede está en Puerto Vallarta, Jalisco. Trabajamos en persona con negocios locales.',
      },
      {
        q: '¿Construyen motores de reservación sin comisión por reserva?',
        a: 'Sí. A diferencia de plataformas de terceros, tu motor de reservación es tuyo, sin comisión por cada reserva.',
      },
      {
        q: '¿Trabajan con inmobiliarias de la zona?',
        a: 'Sí. Diseñamos portales de propiedades a la medida para inmobiliarias de Puerto Vallarta y la bahía.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
      { label: 'Secretaría de Turismo (gob.mx)', href: 'https://www.gob.mx/sectur' },
    ],
    neighborSlugs: ['desarrollo-web-bahia-de-banderas'],
  },
  {
    slug: 'desarrollo-web-bahia-de-banderas',
    city: 'Bahía de Banderas',
    region: 'Nayarit',
    metaTitle: 'Desarrollo Web y Ecosistemas Digitales en Bahía de Banderas',
    metaDescription:
      'Portales para desarrollos inmobiliarios, administradoras y renta vacacional en Bahía de Banderas y la Riviera Nayarit. Diagnóstico gratuito.',
    h1: 'Desarrollo Web y Ecosistemas Digitales en Bahía de Banderas',
    intro:
      'PixelTEC construye portales a la medida para desarrollos inmobiliarios, administradoras de condominios y negocios de renta vacacional en Bahía de Banderas.',
    contextTitle: 'Por qué desarrollar a la medida en Bahía de Banderas',
    contextBody: [
      'Bahía de Banderas —Nuevo Vallarta, Punta Mita y el resto de la Riviera Nayarit— crece a un ritmo inmobiliario y turístico que exige plataformas capaces de escalar: catálogos de propiedades, portales de propietarios, sistemas de renta vacacional.',
      'Un desarrollo inmobiliario o una administradora que crece necesita un sistema propio para gestionar unidades, pagos y comunicación con residentes — no una plantilla genérica que no refleja la calidad del proyecto.',
    ],
    useCases: [
      {
        icon: 'Building2',
        title: 'Portales para desarrollos inmobiliarios',
        description: 'Catálogos de unidades con disponibilidad en tiempo real, planos y formularios de contacto integrados a ventas.',
      },
      {
        icon: 'FileScan',
        title: 'Portales de propietarios y residentes',
        description: 'Sistemas donde propietarios consultan pagos, mantenimiento y comunicados sin llamar a la administración.',
      },
      {
        icon: 'BarChart3',
        title: 'Plataformas de renta vacacional propias',
        description: 'Sistemas de reservación y gestión de renta vacacional con tu marca, sin depender solo de plataformas de terceros.',
      },
      {
        icon: 'MailCheck',
        title: 'E-commerce para amenidades y servicios',
        description: 'Venta en línea de amenidades, tours o servicios adicionales para huéspedes y residentes.',
      },
    ],
    faq: [
      {
        q: '¿Construyen portales para desarrollos inmobiliarios en Nuevo Vallarta o Punta Mita?',
        a: 'Sí. Diseñamos portales de ventas y de propietarios a la medida para desarrollos de todo Bahía de Banderas.',
      },
      {
        q: '¿Pueden integrar el portal con nuestro sistema de administración de condominios?',
        a: 'Sí. Conectamos el portal nuevo con el sistema de administración o pagos que ya uses, o construimos uno desde cero.',
      },
      {
        q: '¿Cómo empezamos?',
        a: 'Con un diagnóstico gratuito: revisamos lo que tienes hoy y te mostramos exactamente qué construir primero.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Bahía de Banderas', href: 'https://www.bahiadebanderas.gob.mx/' },
      { label: 'Secretaría de Turismo (gob.mx)', href: 'https://www.gob.mx/sectur' },
    ],
    neighborSlugs: ['desarrollo-web-puerto-vallarta'],
  },
];

export const CONSULTORIA_CITIES: LocalServiceCity[] = [
  {
    slug: 'consultoria-guadalajara',
    city: 'Guadalajara',
    region: 'Jalisco',
    metaTitle: 'Consultoría Tecnológica Estratégica en Guadalajara',
    metaDescription:
      'Diagnóstico y transformación digital para empresas de manufactura y TI en Guadalajara. Auditoría, estrategia y rediseño UI/UX. Diagnóstico gratuito.',
    h1: 'Consultoría Tecnológica Estratégica en Guadalajara',
    intro:
      'PixelTEC audita procesos y sistemas de empresas de Guadalajara para diseñar una estrategia de transformación digital realista, no una lista de tecnología de moda.',
    contextTitle: 'Por qué consultoría tecnológica en Guadalajara',
    contextBody: [
      'La industria de exportación bajo el programa IMMEX representa más del 11% del empleo formal de Jalisco, según datos de INDEX Occidente. Competir en ese entorno exige decisiones tecnológicas correctas, no solo más herramientas.',
      'Muchas empresas de manufactura y TI de Guadalajara acumulan sistemas que ya no hablan entre sí: un ERP, un CRM aparte, reportes en Excel. Antes de construir algo nuevo, hace falta un diagnóstico honesto de qué vale la pena conservar, integrar o reemplazar.',
    ],
    useCases: [
      {
        icon: 'FileScan',
        title: 'Auditoría de procesos y sistemas',
        description: 'Revisamos tus sistemas actuales (ERP, CRM, reportes) para identificar qué integrar, qué reemplazar y qué automatizar primero.',
      },
      {
        icon: 'Building2',
        title: 'Estrategia de transformación digital',
        description: 'Diseñamos una hoja de ruta realista, priorizada por impacto y costo, no una lista de tecnología de moda.',
      },
      {
        icon: 'BarChart3',
        title: 'Rediseño UI/UX de sistemas internos',
        description: 'Modernizamos la experiencia de sistemas internos que tu equipo usa todos los días pero nadie rediseñó nunca.',
      },
      {
        icon: 'MailCheck',
        title: 'Diagnóstico de digitalización de flotillas y operación',
        description: 'Evaluamos procesos operativos (logística, flotillas, planta) para identificar oportunidades reales de digitalización.',
      },
    ],
    faq: [
      {
        q: '¿Hacen auditoría de sistemas para empresas de manufactura?',
        a: 'Sí. Auditamos ERP, CRM y reportes de empresas de manufactura y TI de Guadalajara para diseñar una estrategia clara.',
      },
      {
        q: '¿La consultoría incluye implementación o solo diagnóstico?',
        a: 'Ambas cosas si lo necesitas: entregamos la estrategia y, si decides avanzar, la implementamos nosotros mismos.',
      },
      {
        q: '¿Cuánto dura un diagnóstico inicial?',
        a: 'El diagnóstico gratuito toma una sesión; una auditoría completa con hoja de ruta suele tomar de 1 a 2 semanas.',
      },
    ],
    externalSources: [
      { label: 'INDEX Occidente (CCIJ)', href: 'https://www.ccij.org.mx/index/' },
      { label: 'CANIETI (nacional)', href: 'https://canieti.org/' },
    ],
    neighborSlugs: ['consultoria-zapopan'],
  },
  {
    slug: 'consultoria-zapopan',
    city: 'Zapopan',
    region: 'Jalisco',
    metaTitle: 'Consultoría Tecnológica Estratégica en Zapopan',
    metaDescription:
      'Auditoría y estrategia digital para despachos, aseguradoras y administradoras de Zapopan. Rediseño de procesos y sistemas. Diagnóstico gratuito.',
    h1: 'Consultoría Tecnológica Estratégica en Zapopan',
    intro:
      'PixelTEC ayuda a despachos, aseguradoras y administradoras de Zapopan a diseñar una estrategia digital clara antes de invertir en sistemas nuevos.',
    contextTitle: 'Por qué consultoría tecnológica en Zapopan',
    contextBody: [
      'El corredor corporativo de Puerta de Hierro concentra despachos, aseguradoras y administradoras que suelen resolver procesos nuevos con parches: una hoja de Excel aquí, un WhatsApp de grupo allá.',
      'Antes de construir un sistema nuevo, conviene un diagnóstico honesto: qué procesos realmente necesitan un sistema, cuáles solo necesitan orden, y en qué orden conviene resolverlos.',
    ],
    useCases: [
      {
        icon: 'FileScan',
        title: 'Auditoría de procesos administrativos',
        description: 'Mapeamos cómo fluye la información hoy (pólizas, expedientes, cotizaciones) para encontrar los cuellos de botella reales.',
      },
      {
        icon: 'Building2',
        title: 'Estrategia de digitalización priorizada',
        description: 'Definimos qué digitalizar primero según impacto real en tu operación, no según lo que está de moda.',
      },
      {
        icon: 'BarChart3',
        title: 'Rediseño de portales y sistemas de captura',
        description: 'Rediseñamos la experiencia de tus sistemas de captura internos para que tu equipo pierda menos tiempo.',
      },
      {
        icon: 'MailCheck',
        title: 'Evaluación de proveedores y herramientas',
        description: 'Te ayudamos a decidir entre construir a la medida o adoptar una herramienta existente, con criterio y sin conflicto de interés.',
      },
    ],
    faq: [
      {
        q: '¿Trabajan con despachos y aseguradoras en Zapopan?',
        a: 'Sí. Hacemos auditoría y estrategia digital para despachos, aseguradoras y administradoras de la zona de Puerta de Hierro.',
      },
      {
        q: '¿Nos ayudan a decidir entre construir a la medida o comprar software?',
        a: 'Sí, con criterio independiente: te decimos qué conviene según tu caso, no vendemos una sola opción por default.',
      },
      {
        q: '¿El diagnóstico tiene costo?',
        a: 'El diagnóstico inicial es gratuito. Una auditoría completa con hoja de ruta se cotiza según alcance.',
      },
    ],
    externalSources: [
      { label: 'CANIETI Occidente', href: 'https://www.canietisedeoccidente.org/' },
      { label: 'CANIETI (nacional)', href: 'https://canieti.org/' },
    ],
    neighborSlugs: ['consultoria-guadalajara'],
  },
  {
    slug: 'consultoria-puerto-vallarta',
    city: 'Puerto Vallarta',
    region: 'Jalisco',
    metaTitle: 'Consultoría Tecnológica Estratégica en Puerto Vallarta',
    metaDescription:
      'PixelTEC tiene su sede en Puerto Vallarta. Auditoría y estrategia de transformación digital para hoteles, restaurantes e inmobiliarias.',
    h1: 'Consultoría Tecnológica Estratégica en Puerto Vallarta',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta. Ayudamos a hoteles, restaurantes e inmobiliarias de la bahía a diseñar su estrategia de transformación digital.',
    contextTitle: 'Por qué consultoría tecnológica en Puerto Vallarta',
    contextBody: [
      'Los negocios turísticos de Puerto Vallarta suelen depender de varias plataformas de terceros (reservaciones, pagos, atención) que no se hablan entre sí y cobran comisión por transacción.',
      'Somos de aquí: hacemos un diagnóstico honesto de qué plataformas conviene conservar, cuáles conviene reemplazar por sistemas propios, y en qué orden — sin comprometerte a un proyecto grande sin necesidad.',
    ],
    useCases: [
      {
        icon: 'FileScan',
        title: 'Auditoría de plataformas y comisiones',
        description: 'Revisamos qué plataformas de terceros usas hoy y cuánto te cuestan en comisiones frente a tener sistema propio.',
      },
      {
        icon: 'Building2',
        title: 'Estrategia digital para temporada alta y baja',
        description: 'Diseñamos una estrategia que se ajusta al ritmo real del destino, no un plan genérico de "transformación digital".',
      },
      {
        icon: 'BarChart3',
        title: 'Rediseño de la experiencia de reservación',
        description: 'Rediseñamos el recorrido de reservación de huéspedes para reducir fricción y aumentar conversión.',
      },
      {
        icon: 'MailCheck',
        title: 'Evaluación de CRM y sistemas de atención',
        description: 'Te ayudamos a elegir o diseñar el sistema de atención y seguimiento a huéspedes que realmente necesitas.',
      },
    ],
    faq: [
      {
        q: '¿PixelTEC tiene oficina en Puerto Vallarta?',
        a: 'Sí, nuestra sede está en Puerto Vallarta. Podemos reunirnos en persona con negocios locales.',
      },
      {
        q: '¿Analizan cuánto nos cuestan las comisiones de plataformas de terceros?',
        a: 'Sí. Parte del diagnóstico es comparar el costo real de las plataformas actuales contra tener un sistema propio.',
      },
      {
        q: '¿Trabajan con hoteles boutique y restaurantes?',
        a: 'Sí. Hacemos consultoría y estrategia digital para hoteles boutique, restaurantes e inmobiliarias de la zona.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
      { label: 'Secretaría de Turismo (gob.mx)', href: 'https://www.gob.mx/sectur' },
    ],
    neighborSlugs: ['consultoria-bahia-de-banderas'],
  },
  {
    slug: 'consultoria-bahia-de-banderas',
    city: 'Bahía de Banderas',
    region: 'Nayarit',
    metaTitle: 'Consultoría Tecnológica Estratégica en Bahía de Banderas',
    metaDescription:
      'Estrategia de digitalización para desarrollos inmobiliarios y administradoras de Bahía de Banderas y la Riviera Nayarit. Diagnóstico gratuito.',
    h1: 'Consultoría Tecnológica Estratégica en Bahía de Banderas',
    intro:
      'PixelTEC ayuda a desarrollos inmobiliarios y administradoras de Bahía de Banderas a diseñar su estrategia de digitalización antes de invertir en sistemas.',
    contextTitle: 'Por qué consultoría tecnológica en Bahía de Banderas',
    contextBody: [
      'Bahía de Banderas crece a un ritmo inmobiliario que puede dejar atrás a la operación administrativa si no se digitaliza a tiempo. CANACINTRA Nayarit impulsa, junto con Nacional Financiera, el acceso a financiamiento y digitalización para las mipymes de la región.',
      'Antes de construir un portal o un sistema de administración, conviene un diagnóstico de qué procesos (pagos, mantenimiento, comunicación con residentes) realmente necesitan digitalizarse primero.',
    ],
    useCases: [
      {
        icon: 'FileScan',
        title: 'Auditoría de procesos de administración',
        description: 'Revisamos cómo administras pagos, mantenimiento y comunicación con residentes hoy para encontrar lo más urgente.',
      },
      {
        icon: 'Building2',
        title: 'Estrategia de digitalización para desarrollos',
        description: 'Diseñamos una hoja de ruta de digitalización que crece al mismo ritmo que tu desarrollo o cartera de propiedades.',
      },
      {
        icon: 'BarChart3',
        title: 'Evaluación de plataformas de renta vacacional',
        description: 'Te ayudamos a decidir entre plataformas de terceros y un sistema propio de reservación y gestión.',
      },
      {
        icon: 'MailCheck',
        title: 'Rediseño de la experiencia de propietarios',
        description: 'Rediseñamos cómo tus propietarios o residentes consultan pagos y comunicados para reducir llamadas y fricción.',
      },
    ],
    faq: [
      {
        q: '¿Trabajan con administradoras de condominios en Nuevo Vallarta o Punta Mita?',
        a: 'Sí. Hacemos consultoría y estrategia de digitalización para administradoras y desarrollos de todo Bahía de Banderas.',
      },
      {
        q: '¿Nos ayudan a elegir entre plataformas de renta vacacional?',
        a: 'Sí, con criterio independiente: comparamos costo, control de marca y funcionalidad antes de recomendar una ruta.',
      },
      {
        q: '¿Cómo empezamos?',
        a: 'Con un diagnóstico gratuito: revisamos tu operación actual y te mostramos qué digitalizar primero.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Bahía de Banderas', href: 'https://www.bahiadebanderas.gob.mx/' },
      { label: 'Secretaría de Turismo (gob.mx)', href: 'https://www.gob.mx/sectur' },
    ],
    neighborSlugs: ['consultoria-puerto-vallarta'],
  },
];

export function getLocalServiceCity(slug: string): LocalServiceCity | undefined {
  return [...DESARROLLO_WEB_CITIES, ...CONSULTORIA_CITIES].find((c) => c.slug === slug);
}

export function getServiceForCitySlug(slug: string): { serviceHref: string; serviceLabel: string } | undefined {
  if (DESARROLLO_WEB_CITIES.some((c) => c.slug === slug)) {
    return { serviceHref: '/services/ecosistemas-web', serviceLabel: 'Ecosistemas Web Avanzados' };
  }
  if (CONSULTORIA_CITIES.some((c) => c.slug === slug)) {
    return { serviceHref: '/services/consultoria', serviceLabel: 'Consultoría Tecnológica Estratégica' };
  }
  return undefined;
}
