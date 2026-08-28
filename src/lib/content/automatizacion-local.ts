/**
 * Contenido de las páginas locales de Automatización (WO-2026-00128).
 *
 * Cada ciudad tiene contexto económico, casos de uso y FAQ propios — NO es
 * el mismo texto con el nombre de la ciudad cambiado. Esto es deliberado:
 * Google trata las páginas de ciudad casi idénticas entre sí como "doorway
 * pages" y las penaliza (guía oficial: near-duplicate location pages que
 * solo cambian el nombre de la ciudad). El proceso de trabajo (`process`)
 * sí se repite entre ciudades porque es literalmente el mismo proceso real
 * de PixelTEC — no es la parte que le da unicidad a la página.
 *
 * Enlaces externos: SOLO fuentes de alta autoridad (cámaras .org.mx,
 * gobierno .gob.mx) — nunca Wikipedia (regla vigente desde Muebles Encino,
 * 2026-08-17). Todos verificados con curl (200) antes de publicarse — ver
 * docs/seo/plan-seo-local-automatizacion.md para la evidencia.
 */

export interface LocalCity {
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
  externalSource: { label: string; href: string };
  neighborSlugs: string[];
}

export const LOCAL_AUTOMATION_CITIES: LocalCity[] = [
  {
    slug: 'automatizacion-guadalajara',
    city: 'Guadalajara',
    region: 'Jalisco',
    metaTitle: 'Automatización de Procesos con IA en Guadalajara',
    metaDescription:
      'Bots, scripts y flujos con IA para empresas de manufactura, TI y servicios en Guadalajara. Diagnóstico gratuito con PixelTEC.',
    h1: 'Automatización de Procesos con IA en Guadalajara',
    intro:
      'PixelTEC diseña bots, scripts y flujos con IA para empresas de Guadalajara que necesitan eliminar tareas manuales repetitivas y ganar control sobre su operación diaria.',
    contextTitle: 'Por qué automatizar en Guadalajara',
    contextBody: [
      'Guadalajara concentra el principal clúster de alta tecnología del país, impulsado por CANIETI Occidente, la Cadena Productiva de Electrónica (Cadelec) y el Instituto Jalisciense de Tecnologías de la Información (IJALTI). La industria de exportación bajo el programa IMMEX representa más del 11% del empleo formal del estado, según datos de INDEX Occidente.',
      'En ese entorno, las empresas de manufactura, maquila y servicios de TI compiten con procesos administrativos que todavía dependen de captura manual: facturas, órdenes de compra, reportes de producción. Automatizar esos procesos es lo que separa a una operación que escala de una que se estanca en tareas repetitivas.',
    ],
    useCases: [
      {
        icon: 'Factory',
        title: 'Extracción de datos en manufactura',
        description:
          'Automatizamos la lectura de facturas, órdenes de compra y reportes de producción para eliminar la captura manual en plantas y maquiladoras.',
      },
      {
        icon: 'MessageSquareText',
        title: 'Bots de atención para servicios de TI',
        description:
          'Chatbots en WhatsApp que responden preguntas frecuentes, agendan citas y califican prospectos 24/7 para despachos y proveedores de servicios.',
      },
      {
        icon: 'BarChart3',
        title: 'Reportes consolidados de inventario',
        description:
          'Scripts que consolidan datos de múltiples fuentes (ERP, Excel, APIs) en reportes de inventario y producción listos para analizar.',
      },
      {
        icon: 'MailCheck',
        title: 'Onboarding automatizado de proveedores',
        description:
          'Flujos que recolectan documentación, validan datos y dan de alta proveedores IMMEX sin intervención manual del equipo administrativo.',
      },
    ],
    faq: [
      {
        q: '¿Trabajan con empresas de manufactura y maquiladora en Guadalajara?',
        a: 'Sí. Automatizamos procesos administrativos y de producción para empresas del sector IMMEX y manufactura ligera de la zona metropolitana de Guadalajara.',
      },
      {
        q: '¿La automatización se integra con nuestro ERP actual?',
        a: 'Sí. Conectamos scripts y bots con el ERP, CRM o sistema de facturación que ya usa tu empresa mediante APIs o integraciones directas.',
      },
      {
        q: '¿Cuánto tarda en implementarse una automatización?',
        a: 'Depende del alcance: un bot de atención o un script de extracción de datos suele estar operando entre 2 y 4 semanas después del diagnóstico inicial.',
      },
    ],
    externalSource: { label: 'CANIETI Occidente', href: 'https://www.canietisedeoccidente.org/' },
    neighborSlugs: ['automatizacion-zapopan'],
  },
  {
    slug: 'automatizacion-zapopan',
    city: 'Zapopan',
    region: 'Jalisco',
    metaTitle: 'Automatización de Procesos con IA en Zapopan',
    metaDescription:
      'Automatización para despachos, aseguradoras y oficinas corporativas de Zapopan: captura de documentos, CRM y reportes con IA.',
    h1: 'Automatización de Procesos con IA en Zapopan',
    intro:
      'PixelTEC ayuda a despachos, aseguradoras y empresas de servicios profesionales de Zapopan a automatizar la captura de documentos y el seguimiento a clientes con IA.',
    contextTitle: 'Por qué automatizar en Zapopan',
    contextBody: [
      'Zapopan concentra buena parte del corredor corporativo de la Zona Metropolitana de Guadalajara, con Puerta de Hierro como su zona de negocios más consolidada: torres de oficinas, despachos, aseguradoras y administradoras que operan a diario desde ahí.',
      'Ese tipo de empresas — servicios profesionales, seguros, administración de propiedades — depende de procesos de captura y seguimiento (pólizas, expedientes, cotizaciones) que consumen horas del equipo cada semana cuando se hacen a mano. Automatizarlos libera tiempo para atender clientes, no para llenar formularios.',
    ],
    useCases: [
      {
        icon: 'FileScan',
        title: 'Captura y validación de pólizas',
        description:
          'Automatizamos la lectura y validación de pólizas, contratos y expedientes para despachos y aseguradoras, sin captura manual.',
      },
      {
        icon: 'MessageSquareText',
        title: 'Seguimiento automatizado a clientes',
        description:
          'Bots que agendan citas, dan seguimiento a cotizaciones y responden preguntas frecuentes desde WhatsApp o tu sitio web.',
      },
      {
        icon: 'BarChart3',
        title: 'Reportes financieros y administrativos',
        description:
          'Scripts que consolidan información financiera y administrativa de múltiples sistemas en reportes listos para revisión.',
      },
      {
        icon: 'Building2',
        title: 'Integración CRM y facturación',
        description:
          'Conectamos tu CRM con el sistema de facturación para que cada cotización aceptada se convierta en factura sin doble captura.',
      },
    ],
    faq: [
      {
        q: '¿Automatizan procesos para despachos y aseguradoras en Zapopan?',
        a: 'Sí. Trabajamos con despachos, aseguradoras y administradoras de la zona de Puerta de Hierro y el resto de Zapopan en captura de documentos, seguimiento a clientes y reportes.',
      },
      {
        q: '¿Pueden automatizar procesos que hoy hacemos en Excel?',
        a: 'Sí. Es de los casos más comunes: consolidamos y automatizamos flujos que hoy dependen de hojas de Excel compartidas por correo.',
      },
      {
        q: '¿Ofrecen diagnóstico antes de cotizar?',
        a: 'Sí, sin costo. Revisamos tus procesos actuales y te decimos exactamente qué se puede automatizar y qué impacto tendría.',
      },
    ],
    externalSource: { label: 'INDEX Occidente (CCIJ)', href: 'https://www.ccij.org.mx/index/' },
    neighborSlugs: ['automatizacion-guadalajara'],
  },
  {
    slug: 'automatizacion-puerto-vallarta',
    city: 'Puerto Vallarta',
    region: 'Jalisco',
    metaTitle: 'Automatización de Procesos con IA en Puerto Vallarta',
    metaDescription:
      'PixelTEC tiene su sede en Puerto Vallarta. Automatizamos reservaciones, atención y reportes para hoteles, restaurantes e inmobiliarias.',
    h1: 'Automatización de Procesos con IA en Puerto Vallarta',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta. Diseñamos bots y flujos automatizados para hoteles, restaurantes, inmobiliarias y agencias de servicios de la bahía.',
    contextTitle: 'Por qué automatizar en Puerto Vallarta',
    contextBody: [
      'La economía de Puerto Vallarta gira en torno al turismo, la hotelería y los servicios: hoteles boutique, restaurantes, administradoras de propiedades y agencias inmobiliarias que atienden temporadas de alta demanda con equipos pequeños.',
      'Somos de aquí — trabajamos de cerca con negocios locales que necesitan automatizar reservaciones, atención al huésped y reportes de ocupación sin perder el trato personal que distingue al destino.',
    ],
    useCases: [
      {
        icon: 'MessageSquareText',
        title: 'Reservaciones y atención 24/7',
        description:
          'Bots de WhatsApp que atienden reservaciones, responden preguntas frecuentes y escalan casos complejos a tu equipo, incluso fuera de horario.',
      },
      {
        icon: 'BarChart3',
        title: 'Reportes de ocupación y ventas',
        description:
          'Scripts que consolidan reservaciones, check-ins y ventas de múltiples plataformas en un reporte diario listo para revisar.',
      },
      {
        icon: 'MailCheck',
        title: 'Facturación y cotizaciones automáticas',
        description:
          'Automatizamos la generación de cotizaciones y facturas para agencias e inmobiliarias, sin captura manual repetida.',
      },
      {
        icon: 'FileScan',
        title: 'Workflows de temporada alta y baja',
        description:
          'Flujos de email marketing y seguimiento a prospectos que se ajustan automáticamente a la temporada del destino.',
      },
    ],
    faq: [
      {
        q: '¿PixelTEC está en Puerto Vallarta?',
        a: 'Sí, nuestra sede está en Puerto Vallarta, Jalisco. Trabajamos en persona con negocios locales y de forma remota con el resto de México.',
      },
      {
        q: '¿Automatizan reservaciones para hoteles boutique?',
        a: 'Sí. Implementamos bots de WhatsApp y flujos de reservación integrados con tu sistema (PMS o calendario) para hoteles y rentas vacacionales.',
      },
      {
        q: '¿Trabajan con inmobiliarias y administradoras de propiedades?',
        a: 'Sí. Automatizamos cotizaciones, seguimiento a prospectos y reportes de ocupación para inmobiliarias y administradoras de la zona.',
      },
    ],
    externalSource: { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
    neighborSlugs: ['automatizacion-bahia-de-banderas'],
  },
  {
    slug: 'automatizacion-bahia-de-banderas',
    city: 'Bahía de Banderas',
    region: 'Nayarit',
    metaTitle: 'Automatización de Procesos con IA en Bahía de Banderas',
    metaDescription:
      'Automatización para administradoras, desarrollos inmobiliarios y hospitalidad en Bahía de Banderas y la Riviera Nayarit.',
    h1: 'Automatización de Procesos con IA en Bahía de Banderas',
    intro:
      'PixelTEC automatiza procesos para administradoras de condominios, desarrollos inmobiliarios y negocios de hospitalidad de Bahía de Banderas y la Riviera Nayarit.',
    contextTitle: 'Por qué automatizar en Bahía de Banderas',
    contextBody: [
      'Bahía de Banderas —que incluye Nuevo Vallarta, Punta Mita y el resto de la Riviera Nayarit— es uno de los municipios de mayor crecimiento turístico e inmobiliario del país, con un ritmo de desarrollo que exige procesos administrativos capaces de escalar al mismo paso.',
      'CANACINTRA Nayarit impulsa, junto con Nacional Financiera, el acceso a financiamiento y digitalización para las mipymes de la región. Automatizar reservaciones, reportes de ventas y atención a huéspedes es parte de esa digitalización para administradoras, desarrollos y negocios de hospitalidad.',
    ],
    useCases: [
      {
        icon: 'Building2',
        title: 'Administración de condominios y renta vacacional',
        description:
          'Automatizamos el seguimiento de pagos, mantenimiento y comunicación con residentes o huéspedes de condominios y renta vacacional.',
      },
      {
        icon: 'MessageSquareText',
        title: 'Atención a huéspedes por WhatsApp',
        description:
          'Bots que responden preguntas frecuentes, coordinan check-in/check-out y escalan casos a tu equipo cuando hace falta.',
      },
      {
        icon: 'BarChart3',
        title: 'Reportes de ventas y ocupación',
        description:
          'Scripts que consolidan ventas, reservaciones y ocupación de desarrollos inmobiliarios en reportes automáticos para dirección.',
      },
      {
        icon: 'FileScan',
        title: 'Integración de reservaciones con CRM',
        description:
          'Conectamos plataformas de reservación con tu CRM para que cada prospecto y huésped quede registrado sin doble captura.',
      },
    ],
    faq: [
      {
        q: '¿Cubren Nuevo Vallarta y Punta Mita?',
        a: 'Sí. Trabajamos con administradoras, desarrollos y negocios de hospitalidad en todo el municipio de Bahía de Banderas, incluidos Nuevo Vallarta y Punta Mita.',
      },
      {
        q: '¿Automatizan la administración de condominios?',
        a: 'Sí. Automatizamos seguimiento de pagos, mantenimiento y comunicación con residentes para administradoras de condominios y desarrollos.',
      },
      {
        q: '¿Cómo empezamos?',
        a: 'Con un diagnóstico gratuito: revisamos tus procesos actuales y te mostramos exactamente qué automatizar primero.',
      },
    ],
    externalSource: { label: 'Gobierno de Bahía de Banderas', href: 'https://www.bahiadebanderas.gob.mx/' },
    neighborSlugs: ['automatizacion-puerto-vallarta'],
  },
];

export function getLocalCity(slug: string): LocalCity | undefined {
  return LOCAL_AUTOMATION_CITIES.find((c) => c.slug === slug);
}
