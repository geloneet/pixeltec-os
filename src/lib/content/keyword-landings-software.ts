/**
 * Clúster A — software a medida (WO-2026-00189).
 *
 * 10 landings: 5 keywords del plan §2 («empresas de desarrollo de software»,
 * «programador de software», «sistemas a medida», «software a medida para
 * empresas» y «sistema personalizado para empresas») × genérica + Puerto
 * Vallarta. Hub: `ecosistemas-web`.
 *
 * Cada página tiene un ÁNGULO propio para no canibalizar dentro del clúster ni
 * con el clúster B (WhatsApp/automatización):
 *   A1 · cómo elegir proveedor: criterios, señales de alerta y entregables.
 *   A2 · el perfil de quien programa: individuo vs. equipo y cómo evaluarlo.
 *   A3 · la decisión de fondo: sistema a medida frente a un SaaS de catálogo.
 *   A4 · el proyecto como inversión: retorno, proceso y qué mueve el costo.
 *   A5 · los sistemas concretos: inventario, cotizador, CRM e integración.
 *
 * Las variantes de Puerto Vallarta no repiten el texto de la genérica: tienen
 * contexto local propio (turismo, hotelería, restaurantes, inmobiliaria y
 * salud de la bahía), casos y FAQ distintos.
 *
 * Cero datos inventados: sin precios, sin clientes que no existan y sin cifras
 * sin fuente. Los ejemplos se redactan como escenarios de operación.
 *
 * Fuentes externas verificadas con `curl -sIL -m 20 <url> | head -1` = 200 el
 * 2026-09-02; todas `.gob.mx` o `.org.mx`.
 */

import type { KeywordLanding } from './keyword-landings';

const PUERTO_VALLARTA = { name: 'Puerto Vallarta', region: 'Jalisco' } as const;

export const KEYWORD_LANDINGS_SOFTWARE: KeywordLanding[] = [
  // ───────────────────────────── A1 · genérica ─────────────────────────────
  {
    slug: 'empresas-de-desarrollo-de-software',
    keyword: 'empresas de desarrollo de software',
    h1: 'Empresas de desarrollo de software: cómo elegir la correcta',
    metaTitle: 'Empresas de desarrollo de software: cómo elegir',
    metaDescription:
      'Cómo evaluar empresas de desarrollo de software en México: criterios de selección, señales de alerta antes de firmar y qué debe entregarte al cerrar.',
    intro:
      'Elegir proveedor de software es una decisión cara de revertir: cuando sale mal se pierden meses y el sistema queda a medias, sin documentación y sin nadie que lo entienda. Esta página explica con qué criterios se evalúa a las empresas de desarrollo de software, qué señales de alerta aparecen antes de firmar y qué debería entregarte cualquier proveedor serio cuando el proyecto termina.',
    sections: [
      {
        title: 'Qué hace una empresa de desarrollo y en qué se diferencia de un freelance',
        body: [
          'Una empresa de desarrollo construye y mantiene sistemas por encargo: no te vende una licencia ya hecha, te vende el análisis, el diseño, la programación y el soporte de algo que antes no existía. La diferencia con un desarrollador independiente no es la calidad del código —hay independientes excelentes— sino la continuidad: quién responde cuando el proyecto crece, cuando la persona que lo escribió cambia de trabajo o cuando algo falla un viernes por la noche.',
          'También se confunde con una agencia digital. Una agencia suele ocuparse de marca, sitio y campañas; una empresa de desarrollo se ocupa de sistemas que sostienen la operación: inventarios, cotizadores, portales de clientes, integraciones entre plataformas que hoy no se hablan. Hay quien hace las dos cosas, pero conviene saber cuál estás contratando, porque los perfiles, los tiempos y la forma de medir el resultado son distintos.',
          'La tercera categoría es la fábrica que renta perfiles por hora. Funciona cuando ya tienes dirección técnica propia y solo te falta capacidad de ejecución. Si no la tienes, terminas administrando programadores sin nadie que sostenga las decisiones de arquitectura, que es el escenario en el que más proyectos se descarrilan sin que nadie sepa exactamente cuándo empezó a ir mal.',
        ],
      },
      {
        title: 'Seis criterios para evaluar a un proveedor',
        body: [
          'Estos son los criterios que usaríamos si tuviéramos que contratar a alguien más. Ninguno requiere conocimiento técnico para aplicarse: se observan en la conversación de venta, antes de que exista una sola línea de código.',
        ],
        bullets: [
          {
            title: 'Pregunta por tu operación antes que por tu tecnología',
            description:
              'En la primera reunión deberían interesarse más por cómo trabaja tu equipo que por el lenguaje de programación. Quien llega con la solución antes de conocer el proceso está vendiendo lo que ya sabe hacer, no lo que tu empresa necesita.',
          },
          {
            title: 'Entrega por partes, no en un solo golpe final',
            description:
              'Un proyecto que solo se ve el último día es un proyecto sin control. Pide entregas revisables cada pocas semanas, con algo que puedas abrir, usar y comentar. Los desvíos se corrigen baratos cuando se detectan temprano.',
          },
          {
            title: 'Te deja ser dueño del código y de los accesos',
            description:
              'Repositorio, dominios, servidores y cuentas de servicios deben quedar a nombre de tu empresa desde el primer día. Si el proveedor los conserva, la relación deja de ser voluntaria y la renegociación siempre la pierdes tú.',
          },
          {
            title: 'Documenta y capacita al cerrar',
            description:
              'Al final debe quedar documentación de la arquitectura, instrucciones de despliegue y una capacitación grabada para tu equipo. Sin eso, el siguiente proveedor te cobrará por volver a entender lo que ya pagaste una vez.',
          },
          {
            title: 'Habla de mantenimiento desde la propuesta',
            description:
              'Todo sistema necesita actualizaciones, respaldos y monitoreo. Quien no menciona el mantenimiento en la propuesta o no piensa quedarse, o va a cobrarlo después como si fuera una sorpresa que nadie podía prever.',
          },
          {
            title: 'Sabe decir que no',
            description:
              'Un proveedor que acepta cada petición sin discutir el alcance está construyendo un proyecto que no va a terminar. Poder decir «eso no conviene, y esta es la razón» es señal de oficio, no de mala disposición.',
          },
        ],
      },
      {
        title: 'Señales de alerta antes de firmar',
        body: [
          'Las siguientes aparecen antes de que empiece el proyecto, cuando cambiar de opinión todavía es gratis. Ninguna es prueba definitiva de nada, pero dos o tres juntas justifican pedir una segunda opinión.',
        ],
        bullets: [
          {
            title: 'Cotización sin alcance escrito',
            description:
              'Un número sin la lista de lo que incluye y lo que no es una invitación a discutir después. El alcance por escrito protege a las dos partes: a ti de pagar de más y al proveedor de trabajar de gratis.',
          },
          {
            title: 'Plazos redondos y sospechosamente cortos',
            description:
              'Estimaciones de «un mes» para sistemas que integran varias áreas suelen esconder que nadie analizó el problema. Un plazo honesto viene con supuestos explícitos y con lo que pasa si esos supuestos no se cumplen.',
          },
          {
            title: 'Ninguna pregunta incómoda',
            description:
              'Si nadie te pregunta por las excepciones, por quién aprueba qué o por los datos que hoy viven en hojas de cálculo, es que no piensan encontrárselas. Se las van a encontrar igual, pero a mitad del proyecto.',
          },
          {
            title: 'Plataforma propietaria sin salida',
            description:
              'Cuando el sistema solo corre en la infraestructura del proveedor y no hay forma documentada de exportar los datos ni de migrarlo, el costo real del proyecto incluye el de nunca poder cambiar de proveedor.',
          },
          {
            title: 'Referencias que no se pueden verificar',
            description:
              'Logotipos en una presentación no son referencias. Pide hablar con alguien que use hoy un sistema que ellos construyeron; un proveedor con trabajo real hecho no tiene problema en conectarte.',
          },
        ],
      },
      {
        title: 'Qué entregamos en PixelTEC',
        body: [
          'Trabajamos por entregas cortas y revisables: cada bloque termina en algo que se puede abrir y usar, no en un avance porcentual. Eso permite corregir el rumbo mientras corregir es barato y mantiene al equipo del cliente involucrado en decisiones que le tocan a él, no a nosotros.',
          'Al cierre entregamos el código en un repositorio a nombre del cliente, la documentación de arquitectura y despliegue, los accesos a la infraestructura y una capacitación con el equipo que va a operar el sistema. No retenemos credenciales ni dejamos dependencias que obliguen a seguir con nosotros: si el cliente continúa, que sea porque el trabajo lo justifica.',
          'Después de liberar ofrecemos mantenimiento con alcance definido —actualizaciones, respaldos, monitoreo y ajustes— y lo cotizamos aparte para que se vea qué cuesta sostener el sistema. Un proyecto cerrado sin plan de mantenimiento es un proyecto que empieza a degradarse el mismo día que se entrega.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Search',
        title: 'Comparar propuestas con el mismo criterio',
        description:
          'Cuando tienes tres cotizaciones que dicen cosas distintas, el primer trabajo es homologar el alcance. Ayudamos a leer qué incluye cada una antes de comparar cifras que no son comparables.',
      },
      {
        icon: 'ShieldCheck',
        title: 'Rescatar un proyecto detenido',
        description:
          'Sistemas a medio construir, sin documentación y con el proveedor anterior fuera de contacto: se audita lo que existe, se decide qué se conserva y se continúa desde ahí.',
      },
      {
        icon: 'Layers',
        title: 'Construir el sistema central de la operación',
        description:
          'Cuando el negocio ya no cabe en hojas de cálculo, se diseña el sistema que concentra la operación y se conecta con lo que ya se usa en facturación, ventas o atención.',
      },
      {
        icon: 'Handshake',
        title: 'Acompañamiento técnico sin equipo interno',
        description:
          'Empresas sin área de sistemas que necesitan quien decida arquitectura, revise proveedores y sostenga la infraestructura sin contratar una plantilla completa.',
      },
    ],
    faq: [
      {
        q: '¿Cómo sé si una empresa de desarrollo de software es seria?',
        a: 'Por lo que hace antes de venderte: pregunta por tu operación, pone el alcance por escrito, propone entregas parciales revisables, te deja a ti la propiedad del código y de los accesos, y habla de mantenimiento desde la propuesta. Si falta más de uno de esos puntos, pide una segunda opinión.',
      },
      {
        q: '¿Conviene contratar una empresa o un desarrollador independiente?',
        a: 'Depende del tamaño y de qué tan crítico sea el sistema. Un independiente funciona bien en proyectos acotados y con alguien del lado del cliente que pueda coordinarlo. Cuando el sistema sostiene operación diaria, la continuidad y el soporte pesan más que el precio por hora.',
      },
      {
        q: '¿De quién es el código cuando termina el proyecto?',
        a: 'Debe ser del cliente, y conviene que quede escrito en el contrato junto con la entrega del repositorio y de los accesos a la infraestructura. Nosotros lo entregamos así por default; si un proveedor se resiste a este punto, es la señal de alerta más clara que existe.',
      },
      {
        q: '¿Qué debe incluir una propuesta de desarrollo de software?',
        a: 'El problema que resuelve, el alcance con lo que incluye y lo que no, las entregas y sus fechas, los supuestos de los que depende la estimación, quién aporta qué del lado del cliente, la propiedad del código y el esquema de mantenimiento posterior.',
      },
      {
        q: '¿Qué pasa si ya empezamos con otro proveedor y el proyecto se detuvo?',
        a: 'Se puede retomar. Primero se audita lo que existe —código, datos, infraestructura y documentación— y se dice con honestidad qué se aprovecha y qué conviene rehacer. A veces la respuesta es que rehacer sale más barato que reparar, y también decimos eso.',
      },
    ],
    externalSources: [
      { label: 'COPARMEX', href: 'https://coparmex.org.mx/' },
      { label: 'CANACINTRA', href: 'https://canacintra.org.mx/' },
    ],
    relatedSlugs: [
      'empresas-de-desarrollo-de-software-puerto-vallarta',
      'programador-de-software',
      'sistemas-a-medida',
      'software-a-medida-para-empresas',
      'sistema-personalizado-para-empresas',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'evaluar tu proyecto de software',
  },

  // ─────────────────────────────── A1 · PV ─────────────────────────────────
  {
    slug: 'empresas-de-desarrollo-de-software-puerto-vallarta',
    keyword: 'empresas de desarrollo de software',
    h1: 'Empresas de desarrollo de software en Puerto Vallarta',
    metaTitle: 'Empresas de desarrollo de software en Puerto Vallarta',
    metaDescription:
      'Empresas de desarrollo de software en Puerto Vallarta: cómo verificar que un proveedor local exista, qué aporta la cercanía y qué proyectos se piden aquí.',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta y construye sistemas para negocios de la bahía. Si estás buscando proveedor en la ciudad, esta página te sirve para dos cosas: verificar que quien te cotiza existe y opera formalmente, y entender qué cambia cuando el equipo que va a construir tu sistema puede sentarse en tu recepción un martes por la mañana.',
    sections: [
      {
        title: 'Qué cambia cuando el proveedor está en la bahía',
        body: [
          'La mayor parte del desarrollo de software se puede hacer a distancia, y lo hacemos: buena parte de nuestro trabajo es con empresas de otras ciudades. Pero hay una fase donde estar cerca cambia el resultado, y es la primera: entender el proceso real, el que nadie tiene escrito y que solo se ve mirando cómo trabaja recepción, cocina o el área de ventas durante un rato.',
          'En Puerto Vallarta esa fase importa más que en otros lugares porque muchos negocios tienen procesos que no se parecen a los de una empresa de oficina: turnos partidos, personal de temporada, operación que sigue viva en fin de semana y una carga que cambia radicalmente entre enero y septiembre. Un requerimiento levantado por videollamada con el gerente pierde exactamente los detalles que después rompen el sistema.',
          'La segunda diferencia es el soporte. Cuando algo se cae en plena temporada alta, la distancia entre «mandamos un correo y esperamos» y «alguien llega en veinte minutos» es la diferencia entre un incidente y un día perdido. No todo se resuelve en sitio, pero poder hacerlo cuando hace falta cambia la conversación.',
        ],
      },
      {
        title: 'Cómo verificar que un proveedor local existe de verdad',
        body: [
          'En un destino turístico circulan muchos proveedores de paso: alguien que llega por temporada, cobra un anticipo y desaparece. Verificar antes de contratar es rápido y evita el problema más caro de todos.',
        ],
        bullets: [
          {
            title: 'Búscalo en el directorio de unidades económicas',
            description:
              'El DENUE del INEGI permite consultar los establecimientos registrados por actividad y ubicación. No estar ahí no es prueba de nada por sí sola, pero una empresa formal con domicilio en la ciudad suele aparecer.',
          },
          {
            title: 'Pide datos fiscales y factura',
            description:
              'Constancia de situación fiscal a nombre de la empresa y disposición a facturar el anticipo. Un proveedor que evita facturar es un proveedor que también va a evitar responder por la garantía.',
          },
          {
            title: 'Pregunta por un domicilio al que puedas ir',
            description:
              'No hace falta una oficina con recepcionista, pero sí un lugar físico y personas identificables. Un contacto que solo existe como número de WhatsApp es difícil de encontrar cuando el sistema falla.',
          },
          {
            title: 'Pide ver algo que esté funcionando hoy',
            description:
              'Un sistema en producción que puedas revisar, o hablar con quien lo usa a diario. Es más informativo que cualquier portafolio de capturas de pantalla sin contexto.',
          },
        ],
      },
      {
        title: 'Qué proyectos nos piden en Puerto Vallarta',
        body: [
          'El perfil económico del destino define el tipo de sistemas que se necesitan aquí. Estos son los frentes donde vemos más demanda; se describen como escenarios de operación del destino, no como casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Hotelería y renta vacacional',
            description:
              'Paneles que juntan reservaciones de varios canales, control de limpieza y mantenimiento entre estancias, y reportes de ocupación que hoy se arman a mano cada lunes.',
          },
          {
            title: 'Restaurantes y bares',
            description:
              'Control de inventario y mermas, recetas con costeo, comparación de consumo entre sucursales y cierres de turno que no dependan de la memoria del encargado.',
          },
          {
            title: 'Inmobiliaria y administración de condominios',
            description:
              'Inventario de propiedades con fichas, seguimiento de prospectos, control de cuotas de mantenimiento y portales donde el propietario consulta su estado de cuenta sin llamar a la administración.',
          },
          {
            title: 'Servicios de salud y consultorios',
            description:
              'Agenda, expediente y seguimiento de pacientes con el manejo de datos personales que exige la normativa, incluido el flujo de pacientes internacionales que llegan por temporadas.',
          },
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los municipios con mayor actividad turística de Jalisco; el Ayuntamiento publica la información oficial del municipio y sus trámites, y el DENUE del INEGI permite consultar qué unidades económicas están registradas en la ciudad y en qué actividad. Son las dos referencias públicas más útiles para verificar a un proveedor local antes de contratarlo.',
        'Ese perfil económico —hospedaje, alimentos y bebidas, servicios inmobiliarios y comercio ligado al visitante— explica por qué los sistemas que se piden aquí no se parecen a los de una empresa industrial. La estacionalidad, el personal rotativo y la operación de siete días a la semana son restricciones de diseño, no detalles.',
        'Somos de aquí y operamos desde aquí. El levantamiento de requerimientos lo hacemos en sitio cuando el proyecto lo justifica, porque media hora observando la operación real ahorra semanas de supuestos equivocados.',
      ],
    },
    useCases: [
      {
        icon: 'BedDouble',
        title: 'Operación hotelera concentrada en un panel',
        description:
          'Reservaciones de distintos canales, estado de las habitaciones y pendientes de mantenimiento en una sola pantalla, en lugar de tres sistemas y una libreta.',
      },
      {
        icon: 'UtensilsCrossed',
        title: 'Inventario y costeo para restaurantes',
        description:
          'Control de insumos, mermas y costo por platillo con cierre de turno, para saber qué margen deja cada área sin esperar al corte de mes.',
      },
      {
        icon: 'Building2',
        title: 'Portal para propietarios y condóminos',
        description:
          'Estados de cuenta, cuotas, avisos y reportes de mantenimiento accesibles en línea, con el historial disponible para la administración.',
      },
      {
        icon: 'MapPin',
        title: 'Soporte presencial en temporada',
        description:
          'Atención en sitio cuando un incidente no puede esperar, con el equipo que construyó el sistema y no con una mesa de ayuda que lo ve por primera vez.',
      },
    ],
    faq: [
      {
        q: '¿PixelTEC es una empresa de desarrollo con sede en Puerto Vallarta?',
        a: 'Sí. Nuestra sede está en Puerto Vallarta, Jalisco. Trabajamos presencialmente con empresas de la bahía y de forma remota con clientes del resto de México.',
      },
      {
        q: '¿Cómo compruebo que un proveedor de software local está formalmente establecido?',
        a: 'Pídele constancia de situación fiscal y factura, un domicilio verificable y un sistema en producción que puedas revisar. El DENUE del INEGI también permite consultar qué unidades económicas están registradas en la ciudad y en qué actividad.',
      },
      {
        q: '¿Trabajan solo con negocios turísticos?',
        a: 'No. El turismo es el sector predominante del destino, pero también construimos sistemas para comercio, servicios profesionales, salud y empresas con operación en varias ciudades. El giro cambia el contenido del sistema, no la forma de trabajarlo.',
      },
      {
        q: '¿Pueden atender a una empresa de fuera de Puerto Vallarta?',
        a: 'Sí, y es parte habitual de nuestro trabajo. El desarrollo se hace igual a distancia; lo que se coordina es cuándo conviene una visita presencial, normalmente al levantar requerimientos y al capacitar al equipo.',
      },
      {
        q: '¿Cuánto tarda un proyecto si empezamos en temporada alta?',
        a: 'El desarrollo tarda lo mismo, pero la disponibilidad de tu equipo no. En temporada alta el personal que conoce el proceso tiene menos tiempo para revisiones y pruebas, así que solemos proponer el levantamiento en temporada baja y la liberación antes del pico.',
      },
    ],
    externalSources: [
      { label: 'INEGI — DENUE, directorio de unidades económicas', href: 'https://www.inegi.org.mx/app/mapa/denue/' },
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
    ],
    relatedSlugs: [
      'empresas-de-desarrollo-de-software',
      'programador-de-software-puerto-vallarta',
      'sistemas-a-medida-puerto-vallarta',
      'software-a-medida-para-empresas-puerto-vallarta',
      'sistema-personalizado-para-empresas-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'construir tu sistema en Puerto Vallarta',
  },

  // ───────────────────────────── A2 · genérica ─────────────────────────────
  {
    slug: 'programador-de-software',
    keyword: 'programador de software',
    h1: 'Programador de software: contratar a uno o contratar un equipo',
    metaTitle: 'Programador de software: cómo contratar y evaluar',
    metaDescription:
      'Contratar un programador de software o un equipo: qué hace cada perfil, cómo evaluarlo sin ser técnico y qué acordar por escrito antes de empezar.',
    intro:
      'Cuando una empresa necesita software, la primera idea suele ser contratar a alguien que programe. A veces es la decisión correcta y a veces es la más cara a mediano plazo. Esta página explica qué hace realmente un programador de software, en qué casos basta con uno, cuándo hace falta un equipo y cómo evaluar a un candidato aunque no sepas leer código.',
    sections: [
      {
        title: 'Qué hace un programador y qué no hace solo',
        body: [
          'Programar es traducir una decisión ya tomada a instrucciones que una máquina ejecuta. Esa es la parte visible del trabajo y no suele ser la más difícil. Antes de escribir código alguien tiene que decidir qué se va a construir, cómo se guardan los datos, qué pasa cuando dos personas hacen lo mismo al mismo tiempo y qué ocurre el día que el sistema tenga diez veces más información.',
          'En un equipo, esas decisiones se reparten entre perfiles distintos: quien levanta requerimientos y traduce el negocio, quien define arquitectura, quien diseña la interfaz, quien programa, quien prueba y quien opera la infraestructura. Cuando contratas a una sola persona, esos roles no desaparecen: se acumulan sobre ella, o quedan sin hacer y aparecen después como fallas que nadie anticipó.',
          'Un buen programador cubre varios de esos roles con solvencia; ninguno los cubre todos con la misma profundidad. Por eso la pregunta útil no es «¿es buen programador?», sino «¿quién va a tomar las decisiones que no son de código, y con qué criterio?».',
        ],
      },
      {
        title: 'Uno, un equipo interno o un proveedor: cuándo conviene cada opción',
        body: [
          'Las tres opciones son legítimas y resuelven problemas distintos. El error caro es elegir por precio de entrada sin mirar qué implica sostener la decisión durante dos años.',
        ],
        bullets: [
          {
            title: 'Un programador por proyecto',
            description:
              'Funciona para desarrollos acotados y bien definidos, con alguien del lado de la empresa capaz de coordinarlo y revisar entregas. Su punto débil es la continuidad: si esa persona se va, el conocimiento se va con ella.',
          },
          {
            title: 'Un programador en nómina',
            description:
              'Tiene sentido cuando el software es parte permanente del negocio y hay trabajo constante. Requiere quien lo dirija técnicamente y un plan para que no quede aislado; un desarrollador solo, sin nadie que revise su trabajo, se estanca.',
          },
          {
            title: 'Un equipo externo',
            description:
              'Aporta los roles completos y continuidad institucional: si alguien deja el proyecto, el proveedor lo cubre. Cuesta más por hora y exige un interlocutor claro del lado del cliente para no diluir las decisiones.',
          },
          {
            title: 'Modelo mixto',
            description:
              'Un equipo externo construye y deja documentado, y una persona interna opera y hace los ajustes del día a día. Es la combinación que mejor funciona en empresas medianas que quieren autonomía sin montar un área completa.',
          },
        ],
      },
      {
        title: 'Cómo evaluar a un programador sin ser técnico',
        body: [
          'No hace falta revisar código para detectar si alguien tiene oficio. Estas cuatro señales se observan en una conversación de una hora.',
        ],
        bullets: [
          {
            title: 'Explica sin jerga',
            description:
              'Pídele que te describa un proyecto anterior y el problema que resolvía. Quien entiende de verdad puede explicarlo en términos de negocio; quien se refugia en nombres de tecnologías suele estar cubriendo un hueco.',
          },
          {
            title: 'Pregunta por las excepciones',
            description:
              'Un perfil con experiencia quiere saber qué pasa cuando algo sale mal: el pago que se rechaza, el usuario que cierra la sesión a la mitad, el dato que llega vacío. Si nadie pregunta eso, esos casos se descubrirán en producción.',
          },
          {
            title: 'Estima con supuestos',
            description:
              'Una estimación seria viene con condiciones: «tres semanas si el sistema de facturación tiene API, seis si hay que capturar a mano». Un número suelto y redondo no es una estimación, es una esperanza.',
          },
          {
            title: 'Habla de mantenimiento y de quien viene después',
            description:
              'Preguntar cómo va a documentar, cómo se despliega y quién podría continuar su trabajo es señal de madurez profesional. A quien no le importa lo que pase después, tampoco le importa la calidad de lo que deja.',
          },
        ],
      },
      {
        title: 'Lo que se acuerda por escrito antes de la primera línea de código',
        body: [
          'Sea una persona o un equipo, el acuerdo escrito evita el 90% de los conflictos. Debe incluir el alcance con lo que sí y lo que no entra, las entregas y sus fechas, quién aporta qué del lado de la empresa, cómo se manejan los cambios de alcance y qué pasa si la relación se termina antes de tiempo.',
          'Dos puntos suelen faltar y son los que más duelen. El primero es la propiedad del trabajo: el código, el repositorio, los dominios y los accesos deben quedar a nombre de la empresa que paga, y conviene que esté escrito con esas palabras. El segundo es la entrega de accesos y documentación como condición del pago final, no como un favor posterior.',
          'También conviene definir el esquema de contratación desde el inicio —relación laboral o prestación de servicios profesionales— porque cada uno tiene obligaciones distintas y la Secretaría del Trabajo publica el marco aplicable. Resolverlo antes evita discusiones cuando el proyecto ya está en marcha.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Code2',
        title: 'Desarrollo de un módulo acotado',
        description:
          'Una funcionalidad concreta sobre un sistema que ya existe, con alcance definido y entrega en semanas: el escenario donde un perfil individual bien coordinado rinde.',
      },
      {
        icon: 'Users',
        title: 'Equipo completo para un sistema nuevo',
        description:
          'Cuando hay que decidir arquitectura, diseñar interfaz, programar, probar e instalar en infraestructura, con alguien responsable de que las piezas encajen.',
      },
      {
        icon: 'FileText',
        title: 'Rescate de código sin documentación',
        description:
          'Sistemas heredados de un desarrollador que ya no está: se revisa lo que hay, se documenta y se deja en estado de poder continuar.',
      },
      {
        icon: 'Wrench',
        title: 'Apoyo técnico para tu programador interno',
        description:
          'Revisión de arquitectura y de código para empresas con una persona de sistemas que trabaja sola y necesita un segundo par de ojos con criterio.',
      },
    ],
    faq: [
      {
        q: '¿Me conviene contratar un programador de software o una empresa?',
        a: 'Un perfil individual funciona en proyectos acotados con alguien de tu lado que lo coordine. Si el sistema va a sostener operación diaria, necesitas los roles que un programador solo no cubre —arquitectura, pruebas, infraestructura— y ahí un equipo sale más barato que reparar después.',
      },
      {
        q: '¿Qué debe saber hacer un programador para un proyecto de empresa?',
        a: 'Además de escribir código: modelar datos, integrar con sistemas existentes, manejar control de versiones, dejar el sistema desplegado y documentado, y anticipar los casos en que algo falla. La parte de programar es la que menos distingue a un perfil de otro.',
      },
      {
        q: '¿Cómo evalúo a un candidato si no sé de tecnología?',
        a: 'Pídele que explique un proyecto anterior sin jerga, observa si pregunta por las excepciones de tu proceso, revisa si estima con supuestos explícitos y pregúntale cómo documentaría para que otra persona pudiera continuar. Esas cuatro respuestas dicen más que un examen técnico.',
      },
      {
        q: '¿Qué pasa si el programador se va a la mitad del proyecto?',
        a: 'Depende de lo que dejó. Si hay repositorio con historial, documentación y despliegue reproducible, otro perfil puede continuar. Si todo vivía en su computadora, el proyecto se reinicia. Por eso esos tres puntos se exigen desde el primer día, no al final.',
      },
      {
        q: '¿Quién es dueño del código que escribe un programador contratado?',
        a: 'Debe ser la empresa que lo paga, y conviene dejarlo por escrito en el contrato junto con la entrega del repositorio y de los accesos. Sin esa cláusula, la propiedad puede quedar en discusión justo cuando más necesitas el código.',
      },
    ],
    externalSources: [
      { label: 'INEGI — Tecnologías de la información', href: 'https://www.inegi.org.mx/temas/tic/' },
      { label: 'Secretaría del Trabajo y Previsión Social (gob.mx)', href: 'https://www.gob.mx/stps' },
    ],
    relatedSlugs: [
      'programador-de-software-puerto-vallarta',
      'empresas-de-desarrollo-de-software',
      'sistemas-a-medida',
      'software-a-medida-para-empresas',
      'sistema-personalizado-para-empresas',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'sumar capacidad de desarrollo a tu equipo',
  },

  // ─────────────────────────────── A2 · PV ─────────────────────────────────
  {
    slug: 'programador-de-software-puerto-vallarta',
    keyword: 'programador de software',
    h1: 'Programador de software en Puerto Vallarta',
    metaTitle: 'Programador de software en Puerto Vallarta',
    metaDescription:
      'Buscar programador de software en Puerto Vallarta: qué ofrece el mercado local, el riesgo de depender de una sola persona y cómo asegurar la continuidad.',
    intro:
      'En Puerto Vallarta encontrar quien programe es fácil; encontrar quien se quede es otra cosa. El mercado local es pequeño y con mucha rotación, así que el riesgo real de un negocio de la bahía no es contratar mal una vez, sino quedarse con un sistema que solo una persona entiende y que esa persona se vaya en octubre.',
    sections: [
      {
        title: 'Cómo es el mercado técnico local y qué implica',
        body: [
          'Puerto Vallarta no es un polo de desarrollo de software: su economía gira alrededor del turismo, y el talento técnico disponible es limitado y muy solicitado. En la práctica eso significa que un buen perfil rara vez está disponible mucho tiempo, y que las empresas locales compiten por él con proyectos remotos que pagan en otra escala.',
          'La consecuencia es un patrón que vemos seguido: el negocio contrata a alguien que resuelve bien durante un año, construye un sistema útil y luego cambia de trabajo o se muda a Guadalajara. El sistema sigue funcionando hasta el día en que hay que modificarlo, y ahí aparece el problema: nadie sabe cómo está hecho, no hay documentación y el código vive en una computadora que ya no está.',
          'La otra versión del mismo problema es el arreglo informal: el sobrino que sabe de computadoras, el estudiante que cobra poco, el amigo que hace páginas. Puede funcionar para empezar, y no lo descalificamos por principio, pero conviene entrar sabiendo que no hay garantía, ni documentación, ni nadie a quien reclamar si el sistema se cae en Semana Santa.',
        ],
      },
      {
        title: 'Las tres decisiones que protegen la continuidad',
        body: [
          'Independientemente de a quién contrates, estas tres condiciones hacen que tu sistema sobreviva a la salida de cualquier persona. Se piden desde el primer día y no cuestan dinero adicional.',
        ],
        bullets: [
          {
            title: 'El código vive en un repositorio de la empresa',
            description:
              'No en la laptop de quien programa. Una cuenta a nombre del negocio, con el historial completo, permite que otra persona tome el proyecto sin empezar de cero aunque el contacto anterior desaparezca.',
          },
          {
            title: 'Los accesos están a nombre del negocio',
            description:
              'Dominio, hosting, base de datos y servicios de terceros contratados con el correo de la empresa. Un dominio registrado a nombre de un tercero es el rehén más común en proyectos locales.',
          },
          {
            title: 'Existe un documento de cómo se despliega',
            description:
              'Media página que explique cómo se levanta el sistema, dónde está la base de datos y qué se necesita para publicar un cambio. Con eso, cualquier técnico competente puede retomarlo en un día.',
          },
        ],
      },
      {
        title: 'Presencial, remoto o mixto en un negocio de la bahía',
        body: [
          'Para el desarrollo puro, estar en la misma ciudad no aporta gran cosa: el trabajo se hace igual desde cualquier lugar. Donde sí pesa la presencia es en dos momentos concretos, y ambos son decisivos para que el sistema sirva.',
          'El primero es entender la operación. En un hotel, un restaurante o una administradora de propiedades, el proceso real no coincide con el proceso que describe el organigrama: hay atajos, excepciones y acuerdos que solo se ven observando un turno completo. Ese levantamiento hecho en sitio es lo que evita construir un sistema correcto para un negocio que no existe.',
          'El segundo es la capacitación y el arranque. Un equipo con personal de temporada y turnos partidos no se capacita por videollamada: se capacita en el mostrador, en dos sesiones cortas, con la gente que va a usar el sistema. Nosotros trabajamos desde Puerto Vallarta, así que esas dos fases las hacemos presenciales y el resto del desarrollo se ejecuta como cualquier proyecto remoto.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es un municipio de Jalisco con una economía concentrada en turismo, hospedaje, alimentos y bebidas y servicios inmobiliarios; el Gobierno del Estado publica la ficha oficial del municipio y el Instituto de Información Estadística y Geográfica de Jalisco difunde la estadística estatal por municipio. Ese perfil explica que el mercado de perfiles técnicos sea reducido comparado con el de la zona metropolitana de Guadalajara.',
        'Para un negocio local eso se traduce en dos cosas prácticas: cuesta más encontrar y retener a un programador en nómina, y depender de una sola persona es un riesgo operativo real, no teórico. Las condiciones de continuidad —repositorio, accesos y documentación a nombre del negocio— son la protección más barata que existe.',
        'Trabajamos desde Puerto Vallarta con equipo propio, así que la continuidad no depende de que una persona siga aquí. El levantamiento y la capacitación se hacen en sitio, y el sistema queda documentado para que cualquier técnico pueda retomarlo.',
      ],
    },
    useCases: [
      {
        icon: 'ShieldCheck',
        title: 'Recuperar un sistema que quedó huérfano',
        description:
          'El desarrollador anterior ya no está y nadie sabe cómo se publica un cambio: se recuperan accesos, se documenta lo que existe y se deja en estado operable.',
      },
      {
        icon: 'Store',
        title: 'Sistema interno para un negocio de la bahía',
        description:
          'Control de operación para hotel, restaurante o inmobiliaria construido con levantamiento presencial, no con supuestos tomados por videollamada.',
      },
      {
        icon: 'Timer',
        title: 'Capacidad extra antes de temporada',
        description:
          'Refuerzo técnico para llegar al pico de demanda con los cambios listos, sin contratar plantilla que después queda ociosa en temporada baja.',
      },
      {
        icon: 'Cpu',
        title: 'Dirección técnica para un equipo pequeño',
        description:
          'Revisión de arquitectura y acompañamiento para la persona de sistemas del negocio, que normalmente trabaja sola y sin nadie con quien contrastar decisiones.',
      },
    ],
    faq: [
      {
        q: '¿Es fácil encontrar un programador de software en Puerto Vallarta?',
        a: 'Encontrar, sí; retener, no tanto. El mercado técnico local es pequeño frente al de Guadalajara y compite con proyectos remotos. Por eso conviene diseñar el proyecto para que no dependa de una sola persona, sea quien sea.',
      },
      {
        q: '¿Qué riesgo tiene contratar a alguien informal para el sistema del negocio?',
        a: 'El riesgo no es la capacidad técnica: es la ausencia de respaldo. Sin contrato, sin repositorio de la empresa y sin documentación, cuando esa persona deja de estar disponible el sistema se vuelve intocable y hay que rehacerlo.',
      },
      {
        q: '¿Necesito que el programador esté físicamente en el negocio?',
        a: 'Para desarrollar, no. Para entender la operación y capacitar al equipo, sí ayuda mucho, sobre todo en negocios con turnos y personal de temporada. Nosotros hacemos esas dos fases en sitio y el resto del desarrollo de forma remota.',
      },
      {
        q: '¿Cómo evito quedarme sin acceso a mi propio sistema?',
        a: 'Exige tres cosas desde el primer día: el código en un repositorio de la empresa, el dominio y el hosting contratados con el correo del negocio, y un documento breve de cómo se despliega. Con eso, cualquier técnico puede continuar.',
      },
      {
        q: '¿Pueden dar mantenimiento a un sistema que hizo otra persona?',
        a: 'Sí, siempre que exista acceso al código y a la infraestructura. Empezamos con una revisión honesta: qué se puede sostener, qué conviene reescribir y qué riesgos tiene tal como está. A veces la recomendación es rehacer, y también lo decimos.',
      },
    ],
    externalSources: [
      { label: 'Instituto de Información Estadística y Geográfica de Jalisco', href: 'https://iieg.gob.mx/' },
      { label: 'Gobierno de Jalisco — Puerto Vallarta', href: 'https://www.jalisco.gob.mx/es/jalisco/municipios/puerto-vallarta' },
    ],
    relatedSlugs: [
      'programador-de-software',
      'empresas-de-desarrollo-de-software-puerto-vallarta',
      'sistemas-a-medida-puerto-vallarta',
      'software-a-medida-para-empresas-puerto-vallarta',
      'sistema-personalizado-para-empresas-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'resolver tu proyecto con equipo local',
  },

  // ───────────────────────────── A3 · genérica ─────────────────────────────
  {
    slug: 'sistemas-a-medida',
    keyword: 'sistemas a medida',
    h1: 'Sistemas a medida: qué son y cuándo convienen frente a un SaaS',
    metaTitle: 'Sistemas a medida: cuándo convienen frente a un SaaS',
    metaDescription:
      'Qué son los sistemas a medida, en qué se diferencian de un SaaS de catálogo, cuándo conviene cada opción y cuándo lo mejor es combinar los dos.',
    intro:
      'Antes de decidir si mandas construir un sistema conviene entender qué estás comprando exactamente y contra qué lo estás comparando. Los sistemas a medida no son mejores ni peores que un software de catálogo: resuelven un problema distinto. Esta página explica la diferencia real, cuándo cada opción gana y cuándo la respuesta correcta es usar las dos.',
    sections: [
      {
        title: 'Qué es un sistema a medida',
        body: [
          'Un sistema a medida es software construido para el proceso de una empresa concreta, en lugar de un producto genérico al que la empresa se adapta. La distinción no es la tecnología —muchas veces se usan las mismas herramientas— sino de dónde salen las reglas: en un producto de catálogo las define el fabricante para miles de clientes; en uno a medida las define tu operación.',
          'Eso tiene una consecuencia que casi nadie explica al vender: un sistema a medida solo es valioso si tu proceso realmente es distinto. Si tu forma de facturar, de vender o de llevar inventario es la misma que la de cualquier empresa de tu giro, mandar construir lo que ya existe en el mercado es pagar de más por lo mismo, con más riesgo y sin actualizaciones.',
          'Lo a medida gana cuando el proceso es el diferenciador del negocio, cuando ningún producto cubre la combinación específica que necesitas, o cuando la operación depende de que varios sistemas que no se hablan entre sí queden conectados. Fuera de esos tres casos, el catálogo suele ser la respuesta sensata.',
        ],
      },
      {
        title: 'SaaS o a medida: la comparación honesta',
        body: [
          'Comparados en abstracto, todos los argumentos suenan bien para ambos lados. Comparados dimensión por dimensión, la decisión se vuelve concreta.',
        ],
        bullets: [
          {
            title: 'Costo',
            description:
              'El SaaS empieza barato y crece con los usuarios y los módulos; lo a medida pide inversión inicial y después solo mantenimiento. La comparación sirve a tres años, no a tres meses, y hay que incluir el costo de adaptar la operación al producto.',
          },
          {
            title: 'Tiempo para estar operando',
            description:
              'Un SaaS se contrata hoy y se configura en semanas. Un sistema a medida se construye por partes y empieza a usarse cuando el primer módulo está listo. Si la urgencia es inmediata, el catálogo tiene ventaja clara.',
          },
          {
            title: 'Ajuste al proceso',
            description:
              'Aquí gana lo a medida sin discusión: hace exactamente lo que tu operación necesita, incluidas las excepciones que ningún producto contempla. Con un SaaS siempre queda un porcentaje del proceso resolviéndose fuera del sistema.',
          },
          {
            title: 'Integración con lo demás',
            description:
              'Un sistema propio se conecta con lo que tú decidas: facturación, banca, mensajería, comercio electrónico. Un SaaS integra solo con lo que su catálogo de conectores permite, y esa lista no la controlas tú.',
          },
          {
            title: 'Dependencia y salida',
            description:
              'Con SaaS dependes de las decisiones del proveedor: precios, funciones que se retiran, condiciones que cambian. Con un sistema propio dependes de tener quién lo mantenga, que es un riesgo distinto y más manejable si el código y la documentación son tuyos.',
          },
        ],
      },
      {
        title: 'Cuándo no conviene un sistema a medida',
        body: [
          'Lo decimos aunque nos quite proyectos: hay escenarios donde construir es la peor opción. El primero es cuando el proceso no está definido. Si tres personas hacen lo mismo de tres maneras distintas, primero se estandariza; automatizar la confusión solo la vuelve más cara de arreglar.',
          'El segundo es cuando el problema ya está resuelto por un producto maduro y regulado. Contabilidad, nómina y timbrado fiscal son buenos ejemplos: el cumplimiento cambia con frecuencia, mantenerlo al día es un trabajo permanente y no hay ventaja competitiva en hacerlo tú. Lo mismo aplica a correo, videollamadas o almacenamiento.',
          'El tercero es cuando la empresa no tiene quién sea dueño del proyecto por dentro. Un sistema a medida exige decisiones constantes sobre el negocio, y esas no las puede tomar el proveedor. Sin un responsable con autoridad para decidir, el proyecto se alarga hasta volverse inviable.',
        ],
      },
      {
        title: 'El punto intermedio: catálogo con una capa a medida',
        body: [
          'La mayoría de nuestros proyectos no son «todo a medida». Son una capa propia sobre lo que la empresa ya usa: se conserva el sistema de facturación, el punto de venta o el CRM, y se construye encima lo que ninguno resuelve —la integración entre ellos, un panel que consolide la información, un flujo específico del negocio.',
          'Esta ruta baja el riesgo de forma notable. La inversión es menor, la puesta en marcha es más rápida y no hay que migrar años de información de golpe. Además deja una salida: si mañana cambias de proveedor de facturación, se ajusta la capa de integración en lugar de reconstruir todo.',
          'El criterio para decidir qué va en cada lado es sencillo: lo que es igual en todas las empresas se compra; lo que hace distinta a la tuya se construye. Aplicado con honestidad, ese criterio reduce el tamaño del desarrollo a la mitad en casi todos los casos.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Boxes',
        title: 'Operación que ya no cabe en hojas de cálculo',
        description:
          'Varios archivos compartidos, versiones que no coinciden y nadie seguro de cuál es la buena: el momento típico en que un sistema propio empieza a justificarse.',
      },
      {
        icon: 'Workflow',
        title: 'Conectar sistemas que no se hablan',
        description:
          'Punto de venta, facturación y CRM que hoy se sincronizan a mano; una capa a medida los conecta sin reemplazar ninguno de los tres.',
      },
      {
        icon: 'LayoutDashboard',
        title: 'Panel con la información consolidada',
        description:
          'Una sola pantalla que reúne datos que hoy viven en tres plataformas distintas, con el mismo criterio de cálculo todos los días.',
      },
      {
        icon: 'Route',
        title: 'Proceso que ningún producto cubre',
        description:
          'Flujos propios del giro —cupos, temporadas, aprobaciones en cadena, reglas de comisión— que en un SaaS terminan resolviéndose fuera del sistema.',
      },
    ],
    faq: [
      {
        q: '¿Qué son los sistemas a medida?',
        a: 'Software construido para el proceso de una empresa concreta en lugar de un producto genérico al que la empresa se adapta. Las reglas las define tu operación, no el fabricante, y por eso solo aportan valor cuando tu proceso realmente se distingue del estándar del mercado.',
      },
      {
        q: '¿Cuándo conviene un sistema a medida y cuándo un software de catálogo?',
        a: 'El catálogo gana en urgencia, costo inicial y en procesos estándar como contabilidad o nómina. Lo a medida gana cuando el proceso es el diferenciador del negocio, cuando ningún producto cubre la combinación que necesitas o cuando hay que integrar sistemas que no se hablan.',
      },
      {
        q: '¿Es más caro un sistema propio que pagar una suscripción?',
        a: 'Al inicio sí, casi siempre. La comparación útil es a tres años e incluye suscripciones por usuario, módulos adicionales y el costo de trabajar fuera del sistema en lo que el producto no cubre. En operaciones con muchos usuarios, la cuenta suele cambiar de lado.',
      },
      {
        q: '¿Puedo empezar con algo pequeño en lugar de todo el sistema?',
        a: 'Sí, y es lo que recomendamos. Se elige el proceso que más duele, se construye ese módulo y se pone a operar. Con eso funcionando se decide el siguiente, con información real en lugar de con supuestos de la fase de diseño.',
      },
      {
        q: '¿Qué pasa si mi empresa cambia de proceso después?',
        a: 'Un sistema propio se modifica; ese es justamente su punto fuerte. Lo que hay que prever es quién lo hace: por eso el proyecto se entrega documentado y con el código en poder de la empresa, para que el cambio no dependa de un solo proveedor.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Economía (gob.mx)', href: 'https://www.gob.mx/se' },
      { label: 'INEGI — Censos Económicos', href: 'https://www.inegi.org.mx/programas/dce/' },
    ],
    relatedSlugs: [
      'sistemas-a-medida-puerto-vallarta',
      'software-a-medida-para-empresas',
      'sistema-personalizado-para-empresas',
      'empresas-de-desarrollo-de-software',
      'programador-de-software',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/diagnostico',
    ctaVerb: 'decidir si un sistema a medida te conviene',
  },

  // ─────────────────────────────── A3 · PV ─────────────────────────────────
  {
    slug: 'sistemas-a-medida-puerto-vallarta',
    keyword: 'sistemas a medida',
    h1: 'Sistemas a medida en Puerto Vallarta',
    metaTitle: 'Sistemas a medida en Puerto Vallarta',
    metaDescription:
      'Sistemas a medida en Puerto Vallarta: procesos de hotelería, restaurantes e inmobiliaria que ningún software de catálogo cubre, y cómo se resuelven.',
    intro:
      'La razón por la que un negocio de la bahía termina necesitando software propio casi siempre es la misma: compró un producto pensado para una operación estable y su operación no lo es. Temporadas, cupos, personal rotativo, propiedades de terceros y clientes en varios idiomas son restricciones que los catálogos genéricos no contemplan.',
    sections: [
      {
        title: 'Qué tiene de particular la operación de la bahía',
        body: [
          'La primera particularidad es la estacionalidad extrema. Un sistema diseñado para volumen constante se comporta distinto cuando en tres meses concentra buena parte del movimiento del año: reportes que dejan de servir, límites de usuarios que estorban justo en el peor momento y suscripciones que se pagan doce meses para usarse con intensidad en cuatro.',
          'La segunda es la operación de terceros. En Vallarta es habitual administrar lo que no es tuyo: departamentos de propietarios, cupos de tours de otros operadores, habitaciones vendidas por varios canales al mismo tiempo. Eso implica llevar cuentas separadas, liquidaciones y reglas de comisión que casi ningún producto de catálogo maneja tal como se necesita.',
          'La tercera es la mezcla de canales e idiomas. La misma reservación puede llegar por un portal internacional, por teléfono o por mensaje directo, en español o en inglés, y termina capturada tres veces en tres lugares distintos. El trabajo de reconciliar eso a mano es exactamente lo que un sistema propio elimina.',
        ],
      },
      {
        title: 'Procesos locales que el catálogo no cubre',
        body: [
          'Estos son los casos donde vemos que el software genérico se queda corto en negocios del destino. Son escenarios de operación típicos de la bahía, no casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Liquidación a propietarios de renta vacacional',
            description:
              'Ingresos por unidad, descuento de comisiones, gastos de mantenimiento y limpieza, y estado de cuenta mensual por propietario. Un cálculo que suele armarse a mano en hojas distintas cada mes.',
          },
          {
            title: 'Cupos y salidas de tours',
            description:
              'Disponibilidad por horario y embarcación, listas de pasajeros, cancelaciones por clima y reasignación a otra salida, con el aviso correspondiente a cada cliente.',
          },
          {
            title: 'Costeo y mermas en restaurantes',
            description:
              'Costo por platillo con precios de insumo que se mueven, control de mermas por turno y comparación entre sucursales, sin depender del criterio del encargado en turno.',
          },
          {
            title: 'Comisiones de venta inmobiliaria',
            description:
              'Reglas de reparto entre asesores, referidos y la agencia, con etapas del proceso de venta y documentación asociada a cada operación.',
          },
        ],
      },
      {
        title: 'Cómo lo construimos sin frenar la operación',
        body: [
          'Trabajamos por módulos y empezamos por el proceso que más duele, no por el más grande. En un negocio de temporada eso significa poner a operar algo útil en semanas y aprender de su uso real antes de decidir el siguiente módulo. Un proyecto de un año que solo se ve al final es incompatible con la forma en que aquí se toman las decisiones.',
          'Respetamos lo que ya funciona. Si el negocio tiene un sistema de reservaciones, un punto de venta o un sistema de facturación que le sirve, se integra y no se toca. Lo a medida se construye alrededor de esos sistemas, no encima de sus ruinas, y eso reduce el riesgo de romper una operación que estaba dando resultados.',
          'El calendario también importa: proponemos construir y liberar en temporada baja, cuando el equipo tiene tiempo para probar y capacitarse, para llegar al pico con el sistema estable. Cambiar la herramienta central de trabajo en plena temporada alta es el escenario que menos recomendamos.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta concentra actividad de hospedaje, alimentos y bebidas, servicios inmobiliarios y comercio ligado al visitante. El Ayuntamiento publica la información oficial del municipio y sus dependencias, y la Secretaría de Desarrollo Económico de Jalisco difunde los programas estatales de apoyo a las empresas del estado.',
        'Ese perfil económico produce operaciones con dos características poco comunes: dependencia de terceros —propietarios, operadores, canales de venta— y una curva de demanda que cambia por completo entre temporadas. Ambas son justamente las que un software de catálogo modela mal.',
        'Trabajamos desde Puerto Vallarta, así que el diseño del sistema parte de observar la operación en sitio: cómo se toma una reservación, cómo se cierra un turno y cómo se arma hoy el reporte que alguien hace a mano cada semana.',
      ],
    },
    useCases: [
      {
        icon: 'BedDouble',
        title: 'Estado de cuenta por propietario',
        description:
          'Cálculo automático de ingresos, comisiones y gastos por unidad, con el estado de cuenta mensual listo para enviar sin rehacerlo en una hoja cada vez.',
      },
      {
        icon: 'Ticket',
        title: 'Control de cupos y salidas',
        description:
          'Disponibilidad por horario, listas de pasajeros y reasignación cuando el clima obliga a cancelar, con aviso a los clientes afectados.',
      },
      {
        icon: 'UtensilsCrossed',
        title: 'Costeo real de cocina y barra',
        description:
          'Costo por platillo con insumos que cambian de precio, control de mermas por turno y comparación entre sucursales con el mismo criterio.',
      },
      {
        icon: 'TrendingUp',
        title: 'Reporte de temporada consolidado',
        description:
          'Ocupación, ventas y comisiones de todos los canales en un solo reporte comparable entre temporadas, en lugar de tres exportaciones pegadas a mano.',
      },
    ],
    faq: [
      {
        q: '¿Por qué un negocio de Puerto Vallarta necesitaría un sistema a medida?',
        a: 'Normalmente por tres razones locales: la estacionalidad extrema, la administración de bienes de terceros —propiedades, cupos, inventarios ajenos— y la venta por varios canales al mismo tiempo. Son escenarios que los productos de catálogo modelan mal y que terminan resolviéndose en hojas de cálculo.',
      },
      {
        q: '¿Se puede integrar con el sistema de reservaciones que ya usamos?',
        a: 'Si permite integración por API o exportación de datos, sí, y es lo que recomendamos: se conserva lo que funciona y se construye alrededor. Cuando el sistema no lo permite, lo decimos desde el diagnóstico en lugar de prometer una conexión que no existe.',
      },
      {
        q: '¿Cuándo conviene desarrollarlo si el negocio tiene temporadas?',
        a: 'En temporada baja. Ahí el equipo tiene tiempo para revisar entregas, probar con casos reales y capacitarse, de modo que se llega al pico de demanda con el sistema estable y sin sorpresas.',
      },
      {
        q: '¿Tenemos que dejar de usar lo que ya tenemos?',
        a: 'No necesariamente. En la mayoría de los proyectos locales se conserva el punto de venta, la facturación o el canal de reservaciones y se construye la capa que hoy falta. Reemplazar todo de golpe es más caro y más riesgoso que integrar.',
      },
      {
        q: '¿Trabajan con negocios de Bahía de Banderas y la zona conurbada?',
        a: 'Sí. Operamos desde Puerto Vallarta y atendemos presencialmente la zona de la bahía; para el resto de México el trabajo se hace de forma remota con visitas puntuales cuando el proyecto lo justifica.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Desarrollo Económico de Jalisco', href: 'https://sedeco.jalisco.gob.mx/' },
      { label: 'Ayuntamiento de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/gobierno' },
    ],
    relatedSlugs: [
      'sistemas-a-medida',
      'software-a-medida-para-empresas-puerto-vallarta',
      'sistema-personalizado-para-empresas-puerto-vallarta',
      'empresas-de-desarrollo-de-software-puerto-vallarta',
      'programador-de-software-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/diagnostico',
    ctaVerb: 'diseñar el sistema que tu operación necesita',
  },

  // ───────────────────────────── A4 · genérica ─────────────────────────────
  {
    slug: 'software-a-medida-para-empresas',
    keyword: 'software a medida para empresas',
    h1: 'Software a medida para empresas: retorno, proceso y costo',
    metaTitle: 'Software a medida para empresas: retorno y proceso',
    metaDescription:
      'Software a medida para empresas medianas: de dónde sale el retorno, cómo se calcula, fase por fase el proceso y qué factores mueven el costo del proyecto.',
    intro:
      'Esta página está escrita para quien ya decidió que necesita software propio y ahora tiene que justificarlo hacia adentro. Trata tres cosas concretas: de dónde sale el retorno de un proyecto de software a medida para empresas, cómo se calcula sin inventar cifras, y qué factores hacen que un proyecto cueste el doble que otro que parecía igual.',
    sections: [
      {
        title: 'De dónde sale el retorno',
        body: [
          'El retorno de un sistema propio viene de cuatro fuentes, y conviene identificar cuál aplica a tu caso antes de estimar nada. La primera es tiempo de personas: horas que hoy se van en capturar dos veces, conciliar archivos o armar reportes a mano. Es la más fácil de medir porque basta cronometrar el proceso actual durante una semana.',
          'La segunda es error evitado: pedidos mal capturados, facturas con datos incorrectos, inventario que no coincide, cobros que se olvidan. Cada uno tiene un costo que la empresa ya está pagando aunque no aparezca en ninguna cuenta. Contarlos durante un mes suele ser suficiente para dimensionarlo.',
          'La tercera es capacidad: atender más volumen con el mismo equipo. Es especialmente relevante en negocios con picos de demanda, donde la alternativa es contratar personal temporal. La cuarta, y la más difícil de medir, es decisión: tener el dato correcto a tiempo. No siempre se puede cuantificar, y cuando no se puede, lo decimos en lugar de inventar un porcentaje.',
        ],
      },
      {
        title: 'Cómo se calcula sin inventar cifras',
        body: [
          'El cálculo honesto es aritmética simple con datos que tu empresa ya tiene. No hace falta un modelo financiero complejo; hace falta medir antes, no después.',
          'Se toman los procesos que el sistema va a tocar y se mide su estado actual: cuántas veces al mes ocurre cada uno, cuánto tarda, cuántas personas intervienen y cuántos errores se detectan. Ese es el punto de partida, y sin él cualquier resultado posterior es una anécdota. Después se estima el estado objetivo con el sistema operando —de forma conservadora— y se compara contra la inversión más el mantenimiento anual.',
          'Dos advertencias sobre este ejercicio. La primera: el ahorro en horas rara vez se convierte en reducción de personal, y presentarlo así suele ser deshonesto; lo normal es que esas horas se reasignen a trabajo que sí requiere criterio. La segunda: hay que incluir el costo interno del proyecto —reuniones, pruebas, capacitación— porque el tiempo del equipo del cliente es parte real de la inversión.',
        ],
      },
      {
        title: 'El proceso, fase por fase',
        body: [
          'Así trabajamos un proyecto de software para empresa. Cada fase termina en algo revisable, no en un avance porcentual.',
        ],
        bullets: [
          {
            title: 'Descubrimiento',
            description:
              'Se observa la operación real, se documenta el proceso con sus excepciones y se define qué queda dentro y fuera del alcance. Aquí se decide también qué se compra y qué se construye.',
          },
          {
            title: 'Diseño funcional y técnico',
            description:
              'Pantallas, flujos, modelo de datos, roles y permisos, e integraciones necesarias. Se revisa con quien va a usar el sistema antes de programar, cuando cambiar todavía es barato.',
          },
          {
            title: 'Construcción por entregas',
            description:
              'Bloques de pocas semanas que terminan en funcionalidad usable. El cliente prueba con datos reales de su operación y comenta, y de ahí sale el ajuste del siguiente bloque.',
          },
          {
            title: 'Migración y puesta en marcha',
            description:
              'Carga de la información existente, pruebas con el equipo, capacitación y periodo de operación en paralelo con el proceso anterior. El sistema viejo no se apaga el primer día.',
          },
          {
            title: 'Mantenimiento y evolución',
            description:
              'Actualizaciones, respaldos, monitoreo y ajustes posteriores. Se cotiza aparte y con alcance definido para que se vea qué cuesta sostener el sistema a lo largo del año.',
          },
        ],
      },
      {
        title: 'Qué mueve el costo de un proyecto',
        body: [
          'No publicamos precios porque dos proyectos que se describen con la misma frase pueden diferir en un orden de magnitud. Lo que sí se puede explicar son los factores que mueven la cifra, para que al leer una cotización sepas qué estás pagando.',
        ],
        bullets: [
          {
            title: 'Número de integraciones',
            description:
              'Conectar con facturación, banca, comercio electrónico o mensajería es donde más varía el esfuerzo. Un sistema con API documentada es un trabajo previsible; uno sin ella puede duplicar la fase.',
          },
          {
            title: 'Roles y permisos',
            description:
              'Un sistema con un solo tipo de usuario es mucho más simple que uno con perfiles, aprobaciones en cadena y visibilidad distinta por sucursal o por área.',
          },
          {
            title: 'Migración de datos',
            description:
              'Cargar años de información dispersa en hojas de cálculo, con formatos inconsistentes y duplicados, suele ser una fase completa por sí sola y se subestima casi siempre.',
          },
          {
            title: 'Requisitos de cumplimiento',
            description:
              'Facturación electrónica, manejo de datos personales o trazabilidad de operaciones agregan validaciones y registros obligatorios que no son opcionales ni negociables.',
          },
          {
            title: 'Disponibilidad exigida',
            description:
              'No es lo mismo un sistema interno que puede detenerse una hora que uno del que depende la venta. Redundancia, respaldos y monitoreo se dimensionan según eso.',
          },
        ],
      },
    ],
    useCases: [
      {
        icon: 'Factory',
        title: 'Empresa mediana con operación en varias sedes',
        description:
          'Información consolidada entre sucursales, con permisos por sede y reportes comparables, en lugar de un archivo por lugar que alguien junta cada mes.',
      },
      {
        icon: 'CreditCard',
        title: 'De la cotización a la factura sin recapturar',
        description:
          'El dato se captura una vez y recorre el flujo comercial completo, reduciendo errores de transcripción entre el área de ventas y la administrativa.',
      },
      {
        icon: 'BarChart3',
        title: 'Indicadores con la misma definición para todos',
        description:
          'Reportes calculados por el sistema con un criterio único, para que dirección y operación discutan decisiones y no cuál de las dos versiones del número es la correcta.',
      },
      {
        icon: 'Database',
        title: 'Migrar de hojas de cálculo a un sistema',
        description:
          'Consolidación de años de información dispersa, con limpieza de duplicados y validaciones, como fase explícita del proyecto y no como un pendiente del final.',
      },
    ],
    faq: [
      {
        q: '¿Cuánto cuesta un software a medida para empresas?',
        a: 'Depende de factores concretos: número de integraciones, roles y permisos, volumen y desorden de los datos a migrar, requisitos de cumplimiento y disponibilidad exigida. Por eso no publicamos precios: una cifra sin alcance escrito no significa nada y suele terminar en discusión.',
      },
      {
        q: '¿Cómo justifico la inversión ante la dirección?',
        a: 'Midiendo antes. Se toman los procesos que el sistema va a tocar, se registra cuántas veces ocurren, cuánto tardan y cuántos errores generan hoy, y se compara contra el escenario con el sistema operando más su mantenimiento anual. Sin esa medición previa, cualquier retorno es una promesa.',
      },
      {
        q: '¿Cuánto tarda un proyecto de este tipo?',
        a: 'Un módulo acotado suele estar operando en semanas; un sistema que cubre varias áreas se entrega por partes a lo largo de meses. Lo que no recomendamos es un proyecto largo que solo se ve al final: sin entregas intermedias no hay forma de corregir a tiempo.',
      },
      {
        q: '¿Qué pasa con la información que tenemos hoy en Excel?',
        a: 'Se migra, y es una fase del proyecto con tiempo y esfuerzo propios. Se revisan formatos, se limpian duplicados y se validan los datos antes de cargarlos. Subestimar esta parte es una de las causas más frecuentes de retraso en proyectos de empresa.',
      },
      {
        q: '¿El proyecto termina cuando se entrega el sistema?',
        a: 'No. Todo sistema requiere actualizaciones, respaldos, monitoreo y ajustes conforme cambia la operación. Ese mantenimiento se cotiza aparte y con alcance definido; un proyecto entregado sin plan de mantenimiento empieza a degradarse desde el primer mes.',
      },
    ],
    externalSources: [
      { label: 'Nacional Financiera (gob.mx)', href: 'https://www.gob.mx/nafin' },
      { label: 'SAT — Servicio de Administración Tributaria', href: 'https://www.gob.mx/sat' },
    ],
    relatedSlugs: [
      'software-a-medida-para-empresas-puerto-vallarta',
      'sistemas-a-medida',
      'sistema-personalizado-para-empresas',
      'empresas-de-desarrollo-de-software',
      'programador-de-software',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'cotizar tu software a medida',
  },

  // ─────────────────────────────── A4 · PV ─────────────────────────────────
  {
    slug: 'software-a-medida-para-empresas-puerto-vallarta',
    keyword: 'software a medida para empresas',
    h1: 'Software a medida para empresas en Puerto Vallarta',
    metaTitle: 'Software a medida para empresas en Puerto Vallarta',
    metaDescription:
      'Software a medida para empresas en Puerto Vallarta: dónde está el retorno en una operación de temporada y cómo se planea el proyecto según el calendario.',
    intro:
      'En una empresa de la bahía el retorno de un sistema propio no se mide igual que en una operación estable: aquí el año no es plano. Lo que se gana no es tanto reducir costos fijos como aguantar el pico sin contratar de más, cerrar la temporada con números confiables y no perder ventas por no poder responder a tiempo.',
    sections: [
      {
        title: 'Dónde está el retorno en una operación de temporada',
        body: [
          'La cuenta que hace una empresa turística no se parece a la de una empresa industrial. Aquí una parte grande del resultado anual se juega en pocos meses, y el costo de un proceso lento no es solo el tiempo de una persona: es la reservación que se fue a otro lado porque nadie pudo responder, o la mesa que quedó vacía porque el cupo no estaba actualizado.',
          'El segundo frente es el personal de temporada. Contratar y capacitar gente que estará poco tiempo tiene un costo alto y una curva de aprendizaje que no se puede alargar. Un sistema que guía el proceso —que no deja capturar mal, que enseña el siguiente paso— reduce el tiempo que tarda una persona nueva en ser productiva, y ese es un retorno concreto que en otras ciudades pesa menos.',
          'El tercero es la información al cerrar la temporada. Cuando los números del año se arman a mano juntando exportaciones de tres plataformas, la decisión sobre el siguiente año se toma con datos que llegan tarde y que nadie termina de creerse. Tener el reporte confiable al cierre vale tanto como cualquier ahorro operativo.',
        ],
      },
      {
        title: 'Empresas de la bahía y lo que suelen necesitar',
        body: [
          'El giro define el sistema. Estos son los perfiles de empresa con los que más trabajamos en la zona, descritos como escenarios de operación del destino.',
        ],
        bullets: [
          {
            title: 'Grupos hoteleros y administradoras de renta',
            description:
              'Consolidar unidades, canales de venta y propietarios en un mismo sistema, con liquidaciones y reportes de ocupación que hoy se arman manualmente cada mes.',
          },
          {
            title: 'Restaurantes con varias sucursales',
            description:
              'Comparar desempeño entre locales con el mismo criterio, controlar insumos y mermas, y cerrar turnos sin depender de la libreta del encargado.',
          },
          {
            title: 'Operadores de tours y actividades',
            description:
              'Cupos por salida, listas de pasajeros, reasignación por clima y liquidación con los proveedores y las agencias que venden en su nombre.',
          },
          {
            title: 'Inmobiliarias y desarrolladoras',
            description:
              'Inventario de propiedades, seguimiento de prospectos por etapa, comisiones por asesor y documentación de cada operación en un solo expediente.',
          },
        ],
      },
      {
        title: 'Planear el proyecto según el calendario del destino',
        body: [
          'En un negocio de temporada el cuándo pesa tanto como el qué. Nuestra recomendación operativa es levantar requerimientos y construir en los meses de menor carga, liberar y capacitar con margen antes del inicio del pico, y dejar la temporada alta solo para acompañamiento y ajustes menores.',
          'El motivo es práctico: en temporada alta el personal que conoce el proceso —recepción, gerencia, cocina, ventas— es justamente el que no tiene tiempo para revisar entregas ni asistir a capacitación. Un proyecto que depende de su participación se atrasa solo, y el que se libera en ese momento se prueba en el peor escenario posible.',
          'Trabajamos por entregas cortas para que este calendario se pueda cumplir: en lugar de un sistema completo en doce meses, módulos que entran a operar uno por uno. Así, si la temporada llega antes de que todo esté listo, lo que ya está funcionando sigue trabajando y el resto espera al siguiente periodo de calma.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los destinos turísticos principales de Jalisco; la Secretaría de Turismo del estado publica la información oficial del destino y la Cámara Nacional de la Industria de Restaurantes y Alimentos Condimentados agrupa al sector restaurantero, uno de los más relevantes de la ciudad junto con el hospedaje.',
        'Ese entorno produce empresas con una estructura de costos muy sensible a la temporada y con equipos que crecen y se reducen a lo largo del año. Cualquier sistema pensado para esta plaza tiene que asumir personal rotativo, picos de carga y venta por múltiples canales como condiciones normales, no como excepciones.',
        'Operamos desde Puerto Vallarta, así que planeamos el proyecto contra el calendario real del destino: construcción y capacitación en los meses de menor carga, y acompañamiento durante el pico.',
      ],
    },
    useCases: [
      {
        icon: 'Building2',
        title: 'Varias unidades bajo una misma administración',
        description:
          'Propiedades, canales y propietarios distintos consolidados en un sistema, con reportes por unidad y liquidaciones calculadas en lugar de armadas a mano.',
      },
      {
        icon: 'Store',
        title: 'Comparar sucursales con el mismo criterio',
        description:
          'Ventas, insumos y mermas medidos igual en todos los locales, para que la comparación entre ellos signifique algo al cierre del mes.',
      },
      {
        icon: 'Rocket',
        title: 'Capacitar personal de temporada más rápido',
        description:
          'Sistemas que guían el proceso y validan la captura, reduciendo el tiempo que tarda una persona nueva en operar sin supervisión constante.',
      },
      {
        icon: 'BarChart3',
        title: 'Cierre de temporada con números confiables',
        description:
          'Un reporte consolidado de todos los canales al terminar el pico, disponible cuando sirve para decidir y no tres semanas después.',
      },
    ],
    faq: [
      {
        q: '¿Vale la pena invertir en software propio si el negocio es de temporada?',
        a: 'Suele valer más, no menos. El retorno está en aguantar el pico sin contratar de más, reducir el tiempo de capacitación del personal temporal y cerrar la temporada con información confiable. Lo que cambia es el calendario del proyecto, no la lógica de la inversión.',
      },
      {
        q: '¿En qué momento del año conviene desarrollar?',
        a: 'En los meses de menor carga. Ahí el equipo puede participar en el levantamiento, revisar entregas y capacitarse con calma. La meta es llegar al inicio de la temporada alta con el sistema estable y solo dar acompañamiento durante el pico.',
      },
      {
        q: '¿Pueden trabajar con una empresa que tiene varias unidades en la bahía?',
        a: 'Sí, y es un caso frecuente: hoteles con varias propiedades, restaurantes con sucursales o administradoras con unidades de distintos propietarios. El sistema se diseña con permisos por unidad y reportes comparables entre ellas.',
      },
      {
        q: '¿Cómo miden el resultado en un negocio con temporadas tan distintas?',
        a: 'Comparando periodos equivalentes, no meses consecutivos. Se toma la medición del mismo periodo del año anterior como línea base y se contrasta con el periodo equivalente ya con el sistema operando; comparar agosto contra diciembre no dice nada.',
      },
      {
        q: '¿Ofrecen acompañamiento durante la temporada alta?',
        a: 'Sí. Es parte del trabajo, no un extra: durante el pico aparecen los casos que ninguna prueba anticipó, y ese es el periodo en que el sistema más se ajusta. Estar en la ciudad permite atender presencialmente lo que no puede esperar.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Turismo de Jalisco', href: 'https://secturjal.jalisco.gob.mx/' },
      { label: 'CANIRAC', href: 'https://canirac.org.mx/' },
    ],
    relatedSlugs: [
      'software-a-medida-para-empresas',
      'sistemas-a-medida-puerto-vallarta',
      'sistema-personalizado-para-empresas-puerto-vallarta',
      'empresas-de-desarrollo-de-software-puerto-vallarta',
      'programador-de-software-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'planear tu proyecto con el calendario del destino',
  },

  // ───────────────────────────── A5 · genérica ─────────────────────────────
  {
    slug: 'sistema-personalizado-para-empresas',
    keyword: 'sistema personalizado para empresas',
    h1: 'Sistema personalizado para empresas: qué se construye en la práctica',
    metaTitle: 'Sistema personalizado para empresas: casos de uso',
    metaDescription:
      'Qué es un sistema personalizado para empresas en la práctica: inventario, cotizador, CRM y portal de clientes, integrados con lo que tu equipo ya usa.',
    intro:
      'Cuando alguien pide un sistema personalizado para empresas casi siempre está pensando en uno de cuatro casos concretos: controlar inventario, cotizar sin errores, ordenar el seguimiento comercial o darle a sus clientes una ventana a su propia información. Esta página describe qué se construye realmente en cada uno, cómo se conecta con lo que ya usas y qué se decide sobre datos y propiedad antes de empezar.',
    sections: [
      {
        title: 'Los cuatro sistemas que más nos piden',
        body: [
          'Cada uno resuelve un dolor distinto y ninguno requiere reemplazar la operación completa. Se describen como escenarios de uso frecuentes, no como casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Control de inventario',
            description:
              'Existencias por ubicación, entradas y salidas con responsable, mínimos que disparan aviso y conteos cíclicos. El objetivo no es saber cuánto hay: es que el número coincida con la realidad sin cerrar la operación para contarlo.',
          },
          {
            title: 'Cotizador con reglas propias',
            description:
              'Precios, descuentos, escalas por volumen y condiciones que hoy vive cada vendedor en su cabeza o en su archivo. El sistema aplica la regla igual siempre, deja registro de quién autorizó qué y evita la cotización que se envió mal.',
          },
          {
            title: 'CRM ajustado a tu proceso comercial',
            description:
              'Etapas que corresponden a cómo vende tu empresa, no a las de un producto genérico; recordatorios de seguimiento, historial de la conversación y visibilidad por vendedor, zona o línea de producto.',
          },
          {
            title: 'Portal para clientes o proveedores',
            description:
              'Una ventana donde el cliente consulta su estado de cuenta, sus pedidos o sus documentos sin llamar a administración, y donde el proveedor sube lo que se le pide con validación automática.',
          },
        ],
      },
      {
        title: 'Integrar con lo que ya usas, sin reemplazarlo todo',
        body: [
          'Casi ningún sistema personalizado empieza en una hoja en blanco. La empresa ya tiene facturación, punto de venta, contabilidad, tal vez un CRM, y todo eso funciona hasta cierto punto. Lo que falta no es reemplazarlos: es la pieza que hoy no existe y el puente entre las que sí.',
          'Técnicamente eso significa integración por API cuando el sistema la ofrece, importación y exportación programada cuando no, y un proceso manual asistido cuando ninguna de las dos es posible. Ese tercer caso hay que decirlo desde el diagnóstico: hay productos cerrados con los que no se puede conectar, y prometer lo contrario solo cambia el momento en que aparece el problema.',
          'El criterio de diseño que seguimos es que el dato se capture una sola vez y viaje. Si un pedido se toma en el sistema personalizado, la factura debería salir de ahí sin recapturar; si un cliente se registra en el portal, debería existir en el CRM. Cada recaptura eliminada es un error menos y un paso menos que explicar a la siguiente persona que entre al equipo.',
        ],
      },
      {
        title: 'Datos personales, roles y permisos',
        body: [
          'Un sistema con información de clientes implica obligaciones concretas. La legislación mexicana en materia de protección de datos personales exige, entre otras cosas, aviso de privacidad, tratar únicamente los datos necesarios para la finalidad declarada y medidas de seguridad razonables; el organismo garante publica la normativa y las guías aplicables.',
          'En la práctica eso se traduce en decisiones de diseño que se toman antes de programar: qué datos se guardan y cuáles no hacen falta, quién puede verlos, cuánto tiempo se conservan y qué queda registrado cuando alguien los consulta o los modifica. Un sistema donde todos ven todo es cómodo el primer mes y un problema el primer incidente.',
          'Los roles también resuelven un asunto operativo, no solo legal: permiten que el sistema crezca sin que cada nueva persona tenga acceso completo. Definir tres o cuatro perfiles al inicio cuesta una conversación; agregarlos después de que el sistema está en uso cuesta un rediseño.',
        ],
      },
      {
        title: 'De quién es el sistema cuando está terminado',
        body: [
          'Un sistema personalizado es un activo de la empresa que lo mandó construir, y conviene tratarlo como tal desde el contrato. El código en un repositorio a nombre de la empresa, los accesos a la infraestructura en su poder y la documentación entregada son las tres condiciones que hacen que ese activo exista de verdad y no solo en el papel.',
          'Hay además una capa de propiedad intelectual que vale la pena revisar según el caso: la marca del producto, los desarrollos que la empresa quiera proteger y los acuerdos de confidencialidad sobre la información del proyecto. El Instituto Mexicano de la Propiedad Industrial es la autoridad en materia de registro de marcas y patentes en México y publica los trámites aplicables.',
          'Nuestro criterio es simple: entregamos todo y no retenemos credenciales. Si el cliente sigue con nosotros después del proyecto, que sea porque el mantenimiento vale la pena, no porque no pueda irse a otro lado.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Boxes',
        title: 'Inventario que coincide con la realidad',
        description:
          'Existencias por ubicación con movimientos registrados y responsable, avisos de mínimos y conteos cíclicos sin detener la operación para contar todo.',
      },
      {
        icon: 'FileScan',
        title: 'Cotizaciones con la misma regla siempre',
        description:
          'Precios, descuentos y autorizaciones aplicados por el sistema, con registro de quién aprobó cada excepción y sin versiones distintas por vendedor.',
      },
      {
        icon: 'Users',
        title: 'Seguimiento comercial con tus etapas',
        description:
          'Un CRM con el proceso real de tu empresa, recordatorios de seguimiento y visibilidad por zona, vendedor o línea, en lugar de un embudo prestado.',
      },
      {
        icon: 'AppWindow',
        title: 'Portal de autoservicio para clientes',
        description:
          'Estado de cuenta, pedidos y documentos consultables en línea, con lo que baja la carga de llamadas y correos a administración.',
      },
    ],
    faq: [
      {
        q: '¿Qué es un sistema personalizado para empresas?',
        a: 'Software construido alrededor del proceso real de una empresa: inventario, cotizaciones, seguimiento comercial o portales para clientes, con las reglas y los permisos que esa empresa necesita, en lugar de las que trae un producto genérico de catálogo.',
      },
      {
        q: '¿Tengo que dejar de usar mi sistema de facturación o mi punto de venta?',
        a: 'No. En la mayoría de los proyectos se conservan y se integran: el sistema personalizado cubre lo que hoy no existe y se conecta con lo demás por API o por importación programada. Solo proponemos reemplazar algo cuando es la causa del problema.',
      },
      {
        q: '¿Se puede conectar con cualquier programa que ya tengamos?',
        a: 'Con la mayoría sí, pero no con todos. Si el producto ofrece API o permite exportar datos de forma programada, la integración es viable. Hay sistemas cerrados con los que no se puede, y lo decimos en el diagnóstico en lugar de descubrirlo a mitad del proyecto.',
      },
      {
        q: '¿Cómo se protegen los datos de nuestros clientes?',
        a: 'Se define desde el diseño qué datos se guardan, quién puede verlos, cuánto tiempo se conservan y qué queda registrado al consultarlos o modificarlos, además del aviso de privacidad y las medidas de seguridad que exige la normativa mexicana de protección de datos personales.',
      },
      {
        q: '¿Podemos empezar por un módulo y crecer después?',
        a: 'Sí, y es la ruta que recomendamos. Se construye primero el proceso que más duele, se pone a operar y con esa experiencia real se decide el siguiente módulo. Crecer así evita pagar por funcionalidad que resultó no ser necesaria.',
      },
    ],
    externalSources: [
      { label: 'INAI — protección de datos personales', href: 'https://home.inai.org.mx/' },
      { label: 'IMPI — Instituto Mexicano de la Propiedad Industrial', href: 'https://www.gob.mx/impi' },
    ],
    relatedSlugs: [
      'sistema-personalizado-para-empresas-puerto-vallarta',
      'sistemas-a-medida',
      'software-a-medida-para-empresas',
      'empresas-de-desarrollo-de-software',
      'programador-de-software',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'construir tu sistema personalizado',
  },

  // ─────────────────────────────── A5 · PV ─────────────────────────────────
  {
    slug: 'sistema-personalizado-para-empresas-puerto-vallarta',
    keyword: 'sistema personalizado para empresas',
    h1: 'Sistema personalizado para empresas en Puerto Vallarta',
    metaTitle: 'Sistema personalizado para empresas en Puerto Vallarta',
    metaDescription:
      'Sistema personalizado para empresas en Puerto Vallarta: inventario de barra y cocina, cotizador de tours y eventos, CRM inmobiliario y expediente clínico.',
    intro:
      'Los sistemas que nos piden en Puerto Vallarta tienen nombre propio: el inventario de la barra, el cotizador de tours con cupo, el CRM que sigue prospectos que compran desde otro país y el expediente del consultorio que atiende pacientes de temporada. Esta página describe esos cuatro casos concretos de la bahía y qué resuelve cada uno.',
    sections: [
      {
        title: 'Cuatro sistemas con nombre propio en la bahía',
        body: [
          'Son los encargos que más se repiten en la ciudad. Se describen como escenarios de operación del destino, no como casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Inventario de barra y cocina',
            description:
              'Control por botella y por insumo, mermas por turno, costo real del trago y del platillo, y conteos rápidos al cierre. Es el sistema que más piden los restaurantes y bares del destino, y el que más discrepancias saca a la luz.',
          },
          {
            title: 'Cotizador de tours, eventos y bodas',
            description:
              'Paquetes con opciones, cupo por salida o por fecha, temporadas con precios distintos y anticipos. Genera la propuesta con la misma regla siempre y deja registro de qué se ofreció y quién lo autorizó.',
          },
          {
            title: 'CRM inmobiliario con prospectos remotos',
            description:
              'Seguimiento de interesados que consultan desde otra ciudad o país, con fichas de propiedades, agenda de visitas presenciales o virtuales, y comisiones repartidas entre asesores y referidos.',
          },
          {
            title: 'Expediente y agenda de consultorio',
            description:
              'Citas, historial y recordatorios con el manejo de datos personales que exige la normativa, incluidos los pacientes que llegan por temporadas y regresan al año siguiente.',
          },
        ],
      },
      {
        title: 'Lo que cambia al diseñarlo para un negocio del destino',
        body: [
          'Un sistema pensado para la bahía asume tres condiciones que en otras plazas son excepción. La primera es el personal rotativo: hay que diseñar para que una persona nueva pueda operar el sistema con poca capacitación, porque en temporada no hay tiempo para curvas de aprendizaje largas.',
          'La segunda es el idioma. Documentos que salen del sistema —cotizaciones, confirmaciones, estados de cuenta— con frecuencia van a clientes que no leen español, y eso se resuelve en el diseño, no parcheando plantillas después. La tercera es la conectividad irregular en algunas zonas: conviene que el sistema sea utilizable desde el teléfono y tolere una conexión intermitente sin perder lo capturado.',
          'La cuarta condición, menos obvia, es la temporalidad de los datos. Una operación con picos necesita reportes que comparen periodos equivalentes del año anterior, no meses consecutivos. Si el sistema no guarda la información con esa comparación en mente, el reporte que sirve para decidir hay que armarlo a mano igual que antes.',
        ],
      },
      {
        title: 'Cómo arrancamos con un negocio local',
        body: [
          'Empezamos observando la operación durante un turno completo, en el lugar. En un restaurante eso significa ver el cierre de barra; en una inmobiliaria, cómo se atiende un prospecto que escribe desde otro país; en un consultorio, cómo se agenda y qué se pregunta antes de la consulta. De ahí sale el alcance del primer módulo.',
          'Después construimos ese primer módulo y lo ponemos a operar en paralelo con el proceso actual, sin apagar nada. El equipo lo usa con datos reales durante un periodo corto y lo que aparece ahí —los casos que nadie mencionó en la junta— es lo que ajusta el diseño del siguiente módulo.',
          'La capacitación se hace en sitio y en sesiones cortas con el personal que va a usar el sistema, no solo con la gerencia. En negocios con turnos partidos eso implica repetir la sesión dos o tres veces, y lo asumimos como parte del trabajo: un sistema que solo entiende quien lo autorizó no se usa.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta pertenece a Jalisco y su actividad económica se concentra en hospedaje, alimentos y bebidas, servicios inmobiliarios y comercio ligado al visitante. El Gobierno del Estado publica la información oficial de sus dependencias y programas, y el DENUE del INEGI permite consultar qué unidades económicas operan en la ciudad y en qué actividad se clasifican.',
        'Ese tejido de negocios explica los cuatro sistemas que más se piden aquí: inventario de barra y cocina, cotizador con cupo y temporadas, CRM inmobiliario con prospectos remotos y expediente de consultorio. Son procesos con reglas propias del destino que los productos genéricos resuelven a medias.',
        'Trabajamos desde Puerto Vallarta: el levantamiento se hace observando un turno real y la capacitación se da en sitio, en sesiones cortas y repetidas para cubrir a todo el personal por turnos.',
      ],
    },
    useCases: [
      {
        icon: 'UtensilsCrossed',
        title: 'Cierre de barra sin discrepancias',
        description:
          'Conteo por botella e insumo, mermas registradas por turno y costo real del trago, para que la diferencia del cierre deje de ser una discusión mensual.',
      },
      {
        icon: 'Ticket',
        title: 'Cotizador con cupo y temporada',
        description:
          'Paquetes con opciones, precio por temporada, disponibilidad por salida y anticipos, con la propuesta generada igual sin importar quién la envíe.',
      },
      {
        icon: 'Building2',
        title: 'CRM inmobiliario para compradores remotos',
        description:
          'Seguimiento de prospectos que consultan desde otro país, con fichas, visitas virtuales agendadas y comisiones repartidas por regla y no por memoria.',
      },
      {
        icon: 'HeartPulse',
        title: 'Agenda y expediente de consultorio',
        description:
          'Citas, historial y recordatorios con permisos por rol y el manejo de datos personales que exige la normativa aplicable.',
      },
    ],
    faq: [
      {
        q: '¿Qué sistemas personalizados piden más los negocios de Puerto Vallarta?',
        a: 'Cuatro se repiten: inventario de barra y cocina para restaurantes, cotizador con cupo y temporadas para tours y eventos, CRM inmobiliario para prospectos que compran a distancia, y agenda con expediente para consultorios.',
      },
      {
        q: '¿El sistema puede emitir documentos en inglés?',
        a: 'Sí, y conviene definirlo desde el diseño. Cotizaciones, confirmaciones y estados de cuenta pueden generarse en el idioma del cliente. Los textos se revisan con el negocio antes de publicarlos para que suenen a la marca y no a traducción automática.',
      },
      {
        q: '¿Funciona si el personal cambia cada temporada?',
        a: 'Debe funcionar, y por eso se diseña con esa condición: pantallas simples, validaciones que impiden capturar mal y flujos que guían el siguiente paso. La capacitación se da en sitio y en sesiones cortas repetidas por turno.',
      },
      {
        q: '¿Se puede usar desde el teléfono en zonas con mala señal?',
        a: 'Se diseña para eso cuando la operación lo exige: interfaz usable desde el celular y tolerancia a una conexión intermitente, de modo que lo capturado no se pierda. Es un requisito que se define al inicio, no un ajuste posterior.',
      },
      {
        q: '¿Cómo empieza un proyecto con un negocio de la bahía?',
        a: 'Observando un turno completo en el lugar para definir el alcance del primer módulo. Ese módulo se construye, se pone a operar en paralelo con el proceso actual y de su uso real sale el diseño del siguiente.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Jalisco', href: 'https://www.jalisco.gob.mx/' },
      { label: 'INEGI — DENUE, directorio de unidades económicas', href: 'https://www.inegi.org.mx/app/mapa/denue/' },
    ],
    relatedSlugs: [
      'sistema-personalizado-para-empresas',
      'sistemas-a-medida-puerto-vallarta',
      'software-a-medida-para-empresas-puerto-vallarta',
      'empresas-de-desarrollo-de-software-puerto-vallarta',
      'programador-de-software-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'construir el sistema que tu negocio necesita',
  },
];
