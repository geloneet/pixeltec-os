/**
 * Registro de industrias (WO-2026-00345, L2).
 *
 * Fuente única de `/industrias` (hub), de `/industrias/[slug]` (páginas propias)
 * y del strip de sectores del home. Módulo puro: sin React, sin `next`.
 *
 * Reglas del registro (plan `04_PRODUCTOS/Pixeltec.mx/plan-seo-integral-2026-09-14.md` §2):
 *
 * 1. Solo sectores con al menos un cliente real documentado en
 *    `NeuroPIXEL/03_CLIENTES/*.md`, y solo los claims que ESA ficha sostiene.
 *    Lo que la auditoría 2026-09-14 no pudo verificar (integraciones SAT,
 *    seguimiento en tiempo real, pasarelas de pago, portal del paciente,
 *    reportes de ocupación, CRM/inventario en moda, ROI/prospectos en solar)
 *    se retiró; `industrias.test.ts` lo vigila con cadenas prohibidas.
 * 2. `page` solo cuando hay un caso real en producción con alcance documentado
 *    y una intención de búsqueda propia (hoy: clínicas dentales → Smile More,
 *    hoteles → Villa Nogal). Los demás sectores son bloques del hub.
 * 3. Nombres de clientes: solo los que ya son públicos en los testimonios del
 *    home (`components/sections/testimonials.tsx`). Ubicación: la de la ficha,
 *    nunca «en Puerto Vallarta» si la ficha no lo dice.
 * 4. `metaTitle` ≤ 49 (el layout añade « | PixelTEC» = 11) y
 *    `metaDescription` ≤ 155. FAQ con texto idéntico al FAQPage JSON-LD.
 * 5. «Stack típico» = el stack con el que PixelTEC construye (ADR-0001), más
 *    las piezas documentadas del caso; no es un inventario del sistema del
 *    cliente.
 */

export type IndustryIcon = 'Truck' | 'Droplets' | 'Stethoscope' | 'Hotel' | 'ShoppingBag' | 'Sun';

/** `value` de COMPANY_TYPES (`@/lib/diagnostic/logic`) que preselecciona el wizard. */
export type DiagnosticIndustry = 'logistica' | 'agua' | 'clinica' | 'hotel' | 'retail' | 'solar';

export interface IndustrySection {
  title: string;
  body: string[];
  /** H3 dentro del H2 de la sección. */
  bullets?: { title: string; description: string }[];
}

export interface IndustryCaseStudy {
  /** H2 de la sección («Caso real: …»). */
  title: string;
  client: string;
  /** Ubicación tal como la documenta la ficha del cliente. */
  location: string;
  summary: string[];
  /** Ruta de la ficha en el vault que sostiene cada afirmación. */
  source: `03_CLIENTES/${string}`;
  /** Cita ya pública en el home (mismo texto que `testimonials.tsx`). */
  testimonial?: { quote: string; author: string; role: string };
}

export interface IndustryPageContent {
  /** Segmento de URL: `/industrias/<slug>`. */
  slug: string;
  /** ≤ 49 caracteres. */
  metaTitle: string;
  /** ≤ 155 caracteres. */
  metaDescription: string;
  h1: string;
  intro: string;
  /** `serviceType` del Service JSON-LD: la intención de búsqueda. */
  serviceType: string;
  /** `audience.audienceType` del Service JSON-LD. */
  audienceType: string;
  sections: IndustrySection[];
  caseStudy: IndustryCaseStudy;
  faq: { q: string; a: string }[];
  relatedServices: { href: '/services/ecosistemas-web' | '/services/automatizacion' | '/services/consultoria'; label: string }[];
  /** Slugs de landings existentes (ciudad×servicio o keyword). */
  relatedLandings: string[];
  /** H2 del CTA final, en singular y con el sector («¿Hablamos de tu hotel?»). */
  ctaHeading: string;
  ctaHref: `/diagnostico?industry=${DiagnosticIndustry}`;
}

export interface Industry {
  slug: string;
  title: string;
  /** Etiqueta corta del strip del home. */
  shortLabel: string;
  icon: IndustryIcon;
  /** Tarjeta del hub: qué se construyó, en una o dos frases verificables. */
  summary: string;
  /** «Lo que resolvemos»: 4 puntos sostenidos por la ficha. */
  problems: string[];
  stack: string[];
  diagnosticType: DiagnosticIndustry;
  page?: IndustryPageContent;
}

export type IndustryWithPage = Industry & { page: IndustryPageContent };

export const INDUSTRIES: readonly Industry[] = [
  {
    slug: 'logistica',
    title: 'Logística y Transportes',
    shortLabel: 'Logística y transporte',
    icon: 'Truck',
    summary:
      'Digitalizamos la operación de empresas de transporte con un sistema propio: consultoría operativa y tecnología en el mismo proyecto, con hosting y soporte después de la entrega.',
    problems: [
      'Operación diaria digitalizada en un sistema propio',
      'Consultoría operativa junto con la tecnología',
      'Hosting y soporte continuo tras la entrega',
      'Mejoras por fases, según lo que la operación pide',
    ],
    stack: ['Next.js', 'PostgreSQL', 'Docker en VPS propio'],
    diagnosticType: 'logistica',
  },
  {
    slug: 'agua',
    title: 'Distribución de Agua',
    shortLabel: 'Distribución de agua',
    icon: 'Droplets',
    summary:
      'Presencia digital y consultoría tecnológica y operativa para distribuidoras de agua en pipas: un brazo tecnológico que acompaña la operación, no solo un proveedor de software.',
    problems: [
      'Sitio web y presencia digital de la distribuidora',
      'Consultoría tecnológica y operativa continua',
      'Medición de campañas y de los contactos que llegan desde el sitio',
      'Sistemas de gestión de pedidos a la medida',
    ],
    stack: ['Next.js', 'PostgreSQL', 'Analítica de campañas'],
    diagnosticType: 'agua',
  },
  {
    slug: 'salud',
    title: 'Salud Dental y Clínicas',
    shortLabel: 'Salud dental',
    icon: 'Stethoscope',
    summary:
      'Plataforma a la medida para clínicas dentales: citas y reprogramación, expediente y archivos clínicos por rol, comprobantes PDF, cobro en caja y recordatorios por correo.',
    problems: [
      'Citas, agenda y reprogramación',
      'Expediente y archivos clínicos con acceso por rol',
      'Comprobantes PDF y cobro en caja',
      'Confirmaciones y recordatorios por correo',
    ],
    stack: ['Next.js', 'Roles admin / doctor / recepción', 'Cloudflare R2', 'Docker en VPS propio'],
    diagnosticType: 'clinica',
    page: {
      slug: 'clinicas-dentales',
      metaTitle: 'Software para Clínicas Dentales a la Medida',
      metaDescription:
        'Plataforma para clínicas dentales: agenda, expediente clínico, comprobantes y recordatorios. Caso real: Smile More (Guadalajara). Diagnóstico gratuito.',
      h1: 'Software a la medida para clínicas dentales',
      intro:
        'PixelTEC construye plataformas propias para clínicas dentales: agenda y reprogramación de citas, expediente y archivos clínicos con acceso por rol, comprobantes PDF y cobro en caja, y confirmaciones y recordatorios automáticos por correo. Todo en un sistema que es de la clínica, no una licencia genérica.',
      serviceType: 'Software para clínicas dentales',
      audienceType: 'Clínicas dentales',
      sections: [
        {
          title: 'Qué construimos para una clínica dental',
          body: [
            'Una clínica no necesita un software genérico con cien módulos que nadie usa: necesita que la agenda, el expediente y el cobro trabajen juntos, con permisos claros para cada persona del equipo. Eso es lo que diseñamos, sobre el flujo real de la recepción, los doctores y la administración.',
            'La plataforma vive en un servidor propio, con la información clínica bajo control de la clínica y accesos que se otorgan por rol. Cada pieza de abajo está en producción hoy en una clínica real; no es una lista de promesas.',
          ],
          bullets: [
            {
              title: 'Citas y reprogramación',
              description:
                'Agenda por doctor y por sede, alta rápida de pacientes y reprogramación desde la misma ficha, pensada para usarse en tablet en recepción.',
            },
            {
              title: 'Expediente y archivos clínicos',
              description:
                'Historial del paciente y archivos clínicos servidos por el servidor con enlaces temporales, visibles solo para el personal con rol autorizado.',
            },
            {
              title: 'Comprobantes PDF y cobro en caja',
              description:
                'Cobro corregible, cierre de adeudos, folios secuenciales que no se pueden rebobinar y comprobante en PDF para el paciente.',
            },
            {
              title: 'Confirmaciones y recordatorios',
              description:
                'Correo de confirmación al agendar, recordatorio automático 24 horas antes y recordatorio de revisión a los seis meses, sin que nadie tenga que acordarse.',
            },
          ],
        },
        {
          title: 'Roles y control: admin, doctor y recepción',
          body: [
            'El sistema distingue tres roles. La administración ve finanzas y configura horarios y usuarios; cada doctor ve únicamente sus citas y sus pacientes; recepción agenda, cobra y confirma sin acceso a lo que no le corresponde. Las reglas se aplican en el servidor, no solo en la pantalla.',
            'Ese control es lo que permite que la clínica crezca en sedes y doctores sin que los expedientes se vuelvan un archivo compartido al que entra cualquiera.',
          ],
        },
        {
          title: 'Por qué a la medida y no un software dental genérico',
          body: [
            'Con una plataforma propia la clínica decide qué datos guarda, dónde viven y quién los ve; no depende de las condiciones de un proveedor externo para acceder a los expedientes de sus pacientes.',
            'Tampoco paga licencias por usuario que crecen con cada doctor nuevo: el sistema se construye una vez para la operación real de la clínica y se extiende cuando la clínica lo necesita, no cuando lo decide el catálogo de un tercero.',
            'El sitio público de la clínica forma parte del mismo proyecto: páginas por sede con datos de contacto, horario y mapa, optimizadas para búsquedas locales de «dentista en» cada ciudad donde atiende.',
          ],
        },
      ],
      caseStudy: {
        title: 'Caso real: Smile More',
        client: 'Smile More',
        location: 'Guadalajara y Guamúchil',
        summary: [
          'Smile More es una clínica dental con sedes en Guadalajara, Jalisco, y Guamúchil, Sinaloa. PixelTEC construyó y opera su plataforma de gestión y su sitio público (smilemore.mx).',
          'En producción: agenda y reprogramación de citas, expediente y archivos clínicos por rol, comprobantes PDF y cobro en caja, confirmaciones y recordatorios automáticos por correo, y páginas por sede para búsquedas locales. La integración con WhatsApp está disponible como siguiente paso.',
          'La plataforma sigue evolucionando con las mejoras que la propia clínica prioriza, fase por fase.',
        ],
        source: '03_CLIENTES/Smile More.md',
        // Grafía del nombre igual a la del home (`sections/testimonials.tsx`), para
        // no tener dos versiones públicas; la ficha del vault escribe «Polett».
        testimonial: {
          quote:
            'El sistema de gestión integral para la clínica y el rediseño del sitio web superaron todas nuestras expectativas. Hemos mejorado nuestra captación de pacientes notablemente.',
          author: 'Pollet Niebla',
          role: 'Fundadora, Smile More',
        },
      },
      faq: [
        {
          q: '¿Cuánto tarda una plataforma para clínica dental?',
          a: 'Depende del alcance: agenda y expediente salen primero y el resto se suma por fases. En el diagnóstico gratuito definimos qué construir primero y con qué calendario, sin comprometer un proyecto grande de entrada.',
        },
        {
          q: '¿Migran los datos de nuestro sistema actual o de Excel?',
          a: 'Sí. Parte del arranque es traer pacientes, citas y expedientes desde lo que la clínica usa hoy —otro software u hojas de Excel— para que el equipo no capture dos veces.',
        },
        {
          q: '¿Incluye recordatorios por WhatsApp?',
          a: 'Las confirmaciones y recordatorios automáticos van por correo desde el primer día. La integración con WhatsApp está disponible y se activa cuando la clínica lo decide.',
        },
      ],
      relatedServices: [
        { href: '/services/ecosistemas-web', label: 'Desarrollo Web y Apps' },
        { href: '/services/automatizacion', label: 'Automatización con IA' },
      ],
      relatedLandings: ['desarrollo-web-guadalajara', 'automatizacion-guadalajara'],
      ctaHeading: '¿Hablamos de tu clínica dental?',
      ctaHref: '/diagnostico?industry=clinica',
    },
  },
  {
    slug: 'hoteleria',
    title: 'Hotelería y Hospedaje',
    shortLabel: 'Hotelería',
    icon: 'Hotel',
    summary:
      'Motor de reservas propio y CRM hotelero a la medida: disponibilidad por habitación, sitio bilingüe y gestión de huéspedes sin depender solo de plataformas de terceros.',
    problems: [
      'Motor de reservas directas con disponibilidad por habitación',
      'Sitio bilingüe (español / inglés)',
      'CRM hotelero y gestión de huéspedes',
      'SEO local del hotel en su destino',
    ],
    stack: ['Next.js', 'next-intl (es/en)', 'Docker en VPS propio'],
    diagnosticType: 'hotel',
    page: {
      slug: 'hoteles',
      metaTitle: 'Sistema de Reservas y CRM para Hoteles a Medida',
      metaDescription:
        'Motor de reservas propio y CRM hotelero a la medida, sin depender solo de plataformas de terceros. Caso real: Villa Nogal, Jalisco. Desde Puerto Vallarta.',
      h1: 'Sistema de reservas y CRM a la medida para hoteles',
      intro:
        'PixelTEC construye motores de reservas propios y CRM hotelero a la medida para hoteles boutique y hospedaje independiente: disponibilidad por habitación, sitio bilingüe en español e inglés, gestión de huéspedes y posicionamiento local del hotel en su destino, con la marca del hotel y sin comisión por cada reserva directa.',
      serviceType: 'Sistema de reservas y CRM para hoteles',
      audienceType: 'Hoteles',
      sections: [
        {
          title: 'Qué construimos para un hotel',
          body: [
            'Un hotel independiente vive de dos cosas: que lo encuentren y que puedan reservar sin fricción. Construimos las dos piezas como un solo sistema: el sitio público que posiciona al hotel en su destino y el motor de reservas que convierte esa visita en una reserva directa.',
            'Todo corre en infraestructura propia del proyecto, con el dominio del hotel y sin plantillas: el diseño, los textos y las fotos son del hotel, no de un proveedor.',
          ],
          bullets: [
            {
              title: 'Motor de reservas directas',
              description:
                'Búsqueda de disponibilidad por fechas, habitaciones con tarifas y fotos, y flujo de reserva completo dentro del sitio del hotel.',
            },
            {
              title: 'Sitio bilingüe es/en',
              description:
                'Cada página existe en español e inglés con URLs propias y señales correctas para Google, pensado para huéspedes nacionales y extranjeros.',
            },
            {
              title: 'CRM hotelero y gestión de huéspedes',
              description:
                'Panel de administración para habitaciones, reservas y huéspedes, con cambios que se reflejan en el sitio público sin tocar código.',
            },
            {
              title: 'SEO local del hotel',
              description:
                'Páginas de guía y atractivos del destino, preguntas frecuentes y datos estructurados del hotel para búsquedas como «hotel en» su pueblo o ciudad.',
            },
          ],
        },
        {
          title: 'Reservas directas frente a las plataformas de terceros',
          body: [
            'Las plataformas de reservas dan visibilidad, pero cobran comisión por cada reserva, controlan la relación con el huésped y muestran al hotel junto a su competencia. No proponemos abandonarlas: proponemos que dejen de ser el único canal.',
            'Con un motor propio el hotel decide tarifas y condiciones, se queda con los datos del huésped y puede ofrecer algo que las plataformas no permiten: una experiencia de reserva con su propia marca de principio a fin.',
            'El equilibrio correcto entre canales se decide con datos del propio hotel, no con cifras genéricas; por eso el proyecto arranca con un diagnóstico y no con una promesa de ahorro.',
          ],
        },
        {
          title: 'Cómo se opera después del lanzamiento',
          body: [
            'El sistema se despliega en un servidor propio con proceso de liberación controlado: cada cambio se prueba en un entorno aislado y con navegador real antes de llegar al hotel, y siempre hay una versión anterior lista para volver atrás.',
            'El hotel administra habitaciones, contenidos y reservas desde su panel; PixelTEC se encarga de la infraestructura, la seguridad y las mejoras que el hotel prioriza en cada versión.',
          ],
        },
      ],
      caseStudy: {
        title: 'Caso real: Villa Nogal',
        client: 'Villa Nogal',
        location: 'San Sebastián del Oeste, Jalisco',
        summary: [
          'Villa Nogal es un hotel boutique en San Sebastián del Oeste, Pueblo Mágico en la sierra de Jalisco. PixelTEC construyó su CRM hotelero a la medida (versión 1 en producción) y el motor de reservas propio de villanogal.com.',
          'El sitio es bilingüe (español e inglés), con habitaciones y disponibilidad administradas desde el panel del hotel, guía del destino y páginas de atractivos para posicionarse en búsquedas locales, y datos estructurados alineados con el perfil real del negocio.',
          'El sistema sigue creciendo con las mejoras que el hotel prioriza en cada versión, a partir de lo que su operación muestra.',
        ],
        source: '03_CLIENTES/Villa Nogal.md',
        testimonial: {
          quote:
            'PixelTEC transformó por completo nuestra presencia digital. El nuevo sistema de reservas a medida no solo es elegante, sino que optimizó nuestras operaciones diarias de manera increíble.',
          author: 'Aidee García',
          role: 'Directora, Villa Nogal',
        },
      },
      faq: [
        {
          q: '¿Sustituye a Booking o Airbnb?',
          a: 'No tiene que sustituirlos: el motor propio se suma como canal directo, sin comisión por reserva y con la marca del hotel. Qué peso darle a cada canal se decide con los datos del propio hotel.',
        },
        {
          q: '¿Puedo administrar habitaciones y tarifas sin programador?',
          a: 'Sí. El panel del hotel permite crear y editar habitaciones, fotos, tarifas y disponibilidad; los cambios se reflejan en el sitio público sin tocar código.',
        },
        {
          q: '¿Trabajan con hoteles fuera de Puerto Vallarta?',
          a: 'Sí. PixelTEC tiene su sede en Puerto Vallarta y trabaja con hoteles de Jalisco, Nayarit y el resto de México; Villa Nogal, por ejemplo, está en San Sebastián del Oeste, en la sierra de Jalisco.',
        },
      ],
      relatedServices: [
        { href: '/services/ecosistemas-web', label: 'Desarrollo Web y Apps' },
        { href: '/services/automatizacion', label: 'Automatización con IA' },
      ],
      relatedLandings: ['desarrollo-web-puerto-vallarta', 'desarrollo-web-bahia-de-banderas'],
      ctaHeading: '¿Hablamos de tu hotel?',
      ctaHref: '/diagnostico?industry=hotel',
    },
  },
  {
    slug: 'moda',
    title: 'Moda y Comercio Especializado',
    shortLabel: 'Moda y comercio especializado',
    icon: 'ShoppingBag',
    summary:
      'Tiendas en línea y catálogos con identidad propia para marcas de moda y comercio especializado: imágenes en Cloudflare R2, correos transaccionales y venta por Instagram, WhatsApp o carrito propio, según la etapa de la marca.',
    problems: [
      'Tienda en línea que respeta el manual de marca del cliente',
      'Catálogo con imágenes servidas desde Cloudflare R2',
      'Venta por Instagram y WhatsApp o carrito propio, según la etapa de la marca',
      'Correos transaccionales con dominio propio',
    ],
    stack: ['Next.js', 'PostgreSQL + Drizzle', 'Cloudflare R2', 'Resend'],
    diagnosticType: 'retail',
  },
  {
    slug: 'solar',
    title: 'Energía Solar',
    shortLabel: 'Energía solar',
    icon: 'Sun',
    summary:
      'Cotizador fotovoltaico a la medida que sustituye el Excel: dimensionamiento de paneles e inversores y precio con tipo de cambio congelado por cotización, con roles de administrador y asesor.',
    problems: [
      'Cotizador de sistemas fotovoltaicos que reemplaza el proceso en Excel',
      'Dimensionamiento de paneles e inversores según consumo',
      'Precio con tipo de cambio, IVA y catálogo congelados por cotización',
      'Roles: administrador (catálogo y configuración) y asesor (sus cotizaciones)',
    ],
    stack: ['Next.js', 'PostgreSQL + Drizzle', 'NextAuth'],
    diagnosticType: 'solar',
  },
];

/** slug del hub → `value` del wizard de /diagnostico (derivado, no paralelo). */
export const DIAGNOSTIC_INDUSTRY_MAP: Record<string, DiagnosticIndustry> = Object.fromEntries(
  INDUSTRIES.map((i) => [i.slug, i.diagnosticType]),
);

export function getIndustry(slug: string): Industry | undefined {
  return INDUSTRIES.find((i) => i.slug === slug);
}

/** Industrias con página propia, en el orden del registro. */
export function industriesWithPage(): IndustryWithPage[] {
  return INDUSTRIES.filter((i): i is IndustryWithPage => Boolean(i.page));
}

/** Busca por el slug de la PÁGINA (`/industrias/<slug>`), no por el del hub. */
export function getIndustryPage(pageSlug: string): IndustryWithPage | undefined {
  return industriesWithPage().find((i) => i.page.slug === pageSlug);
}

export function industryPagePath(page: IndustryPageContent): string {
  return `/industrias/${page.slug}`;
}
