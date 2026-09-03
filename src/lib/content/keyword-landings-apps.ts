/**
 * Clúster C — desarrollo de apps (WO-2026-00189).
 *
 * 8 landings: 4 keywords del plan §2 («desarrolladores de app», «desarrollo de
 * app», «desarrolladores de apps» y «desarrollo de aplicaciones moviles») ×
 * genérica + Puerto Vallarta. Hub: `ecosistemas-web`.
 *
 * Cada página tiene un ÁNGULO propio para no canibalizar dentro del clúster ni
 * con los clústeres A (software a medida) y B (WhatsApp/automatización):
 *   C1 · el EQUIPO: qué perfiles construyen una app y cómo se evalúan.
 *   C2 · el PROCESO: descubrimiento, diseño, construcción, publicación y
 *        mantenimiento, en ese orden y con lo que se decide en cada fase.
 *   C3 · el TIPO de app: web app, PWA o app móvil, y cuándo conviene cada una.
 *   C4 · la DECISIÓN TÉCNICA móvil: iOS, Android y PWA, requisitos de las
 *        tiendas y qué cuesta mantener una app publicada.
 *
 * Las variantes de Puerto Vallarta no repiten el texto de la genérica: tienen
 * contexto local propio (turismo, hotelería, restaurantes, operadoras de tours,
 * inmobiliaria y salud de la bahía), casos y FAQ distintos.
 *
 * Cero datos inventados: sin precios, sin clientes que no existan y sin cifras
 * sin fuente. Los ejemplos se redactan como escenarios de operación.
 *
 * Fuentes externas verificadas con `curl -sIL -m 20 <url> | head -1` = 200 el
 * 2026-09-02; todas `.gob.mx` o `.org.mx`.
 */

import type { KeywordLanding } from './keyword-landings';

const PUERTO_VALLARTA = { name: 'Puerto Vallarta', region: 'Jalisco' } as const;

export const KEYWORD_LANDINGS_APPS: KeywordLanding[] = [
  // ───────────────────────────── C1 · genérica ─────────────────────────────
  {
    slug: 'desarrolladores-de-app',
    keyword: 'desarrolladores de app',
    h1: 'Desarrolladores de app: quién construye realmente una aplicación',
    metaTitle: 'Desarrolladores de app: el equipo detrás del proyecto',
    metaDescription:
      'Qué perfiles integran un equipo de desarrolladores de app, cómo se reparten los roles y qué preguntar antes de contratar. Guía sin humo técnico.',
    intro:
      'Quien busca desarrolladores de app casi nunca busca un programador suelto: busca que alguien se haga cargo de que la aplicación exista, funcione y siga funcionando el año que viene. Esta página explica qué perfiles intervienen de verdad en una app, qué hace cada uno, cuándo alcanza con una persona y cuándo hace falta un equipo, y qué preguntas conviene hacer antes de firmar.',
    sections: [
      {
        title: 'Los perfiles que intervienen en una app y qué hace cada uno',
        body: [
          'Una app terminada es el resultado de varias disciplinas que no siempre viven en la misma persona. Cuando alguien dice «necesito un desarrollador de app» normalmente necesita que ese conjunto de tareas quede cubierto, no que una sola persona sepa hacerlas todas. En proyectos pequeños los roles se concentran; en proyectos con más de una pantalla crítica, se separan.',
          'Conocer los perfiles sirve para dos cosas: leer una propuesta y entender por qué cuesta lo que cuesta, y detectar qué le falta a un equipo que ya está trabajando en tu app.',
        ],
        bullets: [
          {
            title: 'Análisis de producto',
            description:
              'Traduce lo que el negocio quiere lograr en funcionalidad concreta y en un orden de construcción. Es quien decide qué entra en la primera versión y qué espera, y quien defiende que la app resuelva un problema y no una lista de ideas.',
          },
          {
            title: 'Diseño de producto e interfaz',
            description:
              'Define los flujos, las pantallas y el comportamiento de cada elemento antes de programar nada. Cambiar una pantalla en el diseño cuesta horas; cambiarla cuando ya está construida y probada cuesta días.',
          },
          {
            title: 'Desarrollo del cliente (lo que el usuario toca)',
            description:
              'Construye la app que corre en el teléfono o en el navegador: pantallas, navegación, estados de carga, funcionamiento sin señal y comportamiento en tamaños de pantalla distintos.',
          },
          {
            title: 'Desarrollo del backend',
            description:
              'Construye lo que la app no muestra: base de datos, autenticación, permisos, integraciones con otros sistemas y la capa de servicios que la app consume. La mayoría de las apps de negocio son mayormente backend.',
          },
          {
            title: 'Pruebas y control de calidad',
            description:
              'Verifica que lo construido haga lo que debe también cuando el usuario hace lo que no debe: datos incompletos, conexión intermitente, dos personas editando lo mismo, sesiones vencidas.',
          },
          {
            title: 'Infraestructura y publicación',
            description:
              'Servidores, respaldos, monitoreo, cuentas de desarrollador y el trámite de subir la app a las tiendas. Es la parte que casi nunca se cotiza y la que detiene la entrega cuando nadie la previó.',
          },
        ],
      },
      {
        title: 'Una persona, un equipo o una fábrica de horas',
        body: [
          'Un desarrollador independiente funciona bien cuando el alcance es acotado, cuando del lado del cliente hay alguien capaz de coordinar y tomar decisiones técnicas, y cuando la app no sostiene todavía operación crítica. Es la opción más ágil para validar una idea. El riesgo es la continuidad: si esa persona cambia de trabajo, se enferma o simplemente deja de responder, el conocimiento del proyecto se va con ella.',
          'Un equipo de desarrolladores de app cubre los perfiles anteriores y, sobre todo, cubre la ausencia de cualquiera de ellos. Cuesta más por hora, pero incluye lo que el precio por hora suele esconder: alguien que decide arquitectura, alguien que revisa el trabajo de otro y alguien que responde cuando algo falla en producción. Para una app de la que dependen ventas, reservaciones o pacientes, esa redundancia no es un lujo.',
          'La tercera opción es rentar perfiles por hora a una fábrica de software. Tiene sentido cuando ya tienes dirección técnica propia y solo te falta capacidad de ejecución: tú pones el rumbo y ellos las manos. Si no tienes esa dirección, terminas administrando programadores sin nadie que sostenga las decisiones de fondo, que es el escenario en el que más apps se quedan a medio camino.',
        ],
      },
      {
        title: 'Cómo evaluar desarrolladores de app antes de firmar',
        body: [
          'Todo lo que sigue se puede verificar en la conversación de venta, sin conocimiento técnico y antes de pagar un anticipo. No son pruebas definitivas por separado; dos o tres respuestas malas juntas sí son motivo para pedir una segunda opinión.',
        ],
        bullets: [
          {
            title: 'Pide ver una app suya funcionando hoy',
            description:
              'No capturas de pantalla: una app que puedas descargar o abrir y usar, o hablar con alguien que la use a diario. Un equipo con trabajo real hecho no tiene problema en conectarte con quien lo opera.',
          },
          {
            title: 'Pregunta de quién quedan las cuentas de desarrollador',
            description:
              'Las cuentas de App Store y Google Play, el repositorio, los dominios y los servidores deben quedar a nombre de tu empresa. Si el proveedor los conserva, la app publicada deja de ser tuya en la práctica.',
          },
          {
            title: 'Pregunta cómo prueban antes de entregar',
            description:
              'Debe haber una respuesta concreta: pruebas automatizadas, una lista de verificación por versión, dispositivos reales. «Lo probamos entre todos» significa que nadie es responsable de que funcione.',
          },
          {
            title: 'Pide una entrega intermedia que puedas usar',
            description:
              'Cada pocas semanas debería existir algo instalable o abrible, aunque esté incompleto. Un proyecto que solo se ve el último día es un proyecto sin control y con la corrección más cara posible.',
          },
          {
            title: 'Pregunta qué pasa después de publicar',
            description:
              'Los sistemas operativos y las tiendas cambian sus requisitos cada año. Quien no menciona mantenimiento en la propuesta o no piensa quedarse, o lo va a cobrar después como si fuera una sorpresa.',
          },
        ],
      },
      {
        title: 'Cómo trabajamos en PixelTEC',
        body: [
          'Empezamos por el problema, no por la app. En la primera etapa acordamos qué tiene que lograr el negocio y qué es la versión más pequeña que ya sirve para algo; muchas veces esa versión no es una app en la tienda, sino una aplicación web que resuelve lo mismo en menos tiempo y sin trámite de publicación. Lo decimos aunque implique un proyecto más corto.',
          'Trabajamos por entregas revisables: cada bloque termina en algo que se puede abrir y usar, no en un porcentaje de avance. Del lado del cliente designamos con quién se valida cada entrega, porque una app que nadie del negocio prueba hasta el final termina siendo la app que alguien imaginó, no la que se necesitaba.',
          'Al cierre entregamos el código en un repositorio a nombre del cliente, las cuentas de tiendas e infraestructura, la documentación y una capacitación con el equipo que va a operar la app. Después ofrecemos mantenimiento con alcance definido —actualizaciones de sistema operativo, cambios de requisitos de las tiendas, respaldos, monitoreo y ajustes— cotizado aparte, para que se vea qué cuesta sostener la app y no aparezca como sorpresa el segundo año.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Users',
        title: 'Equipo completo sin contratar plantilla',
        description:
          'Empresas que necesitan producto, diseño, desarrollo y publicación sin abrir un área de tecnología propia ni coordinar a cuatro proveedores distintos.',
      },
      {
        icon: 'Search',
        title: 'Segunda opinión sobre una app en curso',
        description:
          'Revisión del código, la arquitectura y el proceso de un proyecto que ya está corriendo, para saber si el rumbo se sostiene antes de invertir otra etapa.',
      },
      {
        icon: 'Wrench',
        title: 'Retomar una app abandonada',
        description:
          'Aplicaciones sin documentación y con el desarrollador anterior fuera de contacto: se audita lo que existe, se decide qué se conserva y se continúa desde ahí.',
      },
      {
        icon: 'Rocket',
        title: 'Del prototipo a la primera versión pública',
        description:
          'Ideas validadas con una maqueta o una hoja de cálculo que necesitan convertirse en una app real, con datos seguros, usuarios y soporte.',
      },
    ],
    faq: [
      {
        q: '¿Cuántas personas hacen falta para desarrollar una app?',
        a: 'Depende del alcance, pero los roles a cubrir son siempre los mismos: análisis de producto, diseño de interfaz, desarrollo del cliente, desarrollo del backend, pruebas y publicación. En proyectos pequeños una o dos personas cubren varios roles; en proyectos con operación crítica conviene separarlos.',
      },
      {
        q: '¿Es mejor contratar desarrolladores de app internos o externos?',
        a: 'Un equipo interno tiene sentido cuando la app es el producto principal de la empresa y va a evolucionar todos los meses. Cuando la app apoya a un negocio que vive de otra cosa, un equipo externo con mantenimiento contratado suele costar menos y arrancar antes.',
      },
      {
        q: '¿Qué pasa si el desarrollador que hizo mi app ya no responde?',
        a: 'Se puede retomar si conservas el código y los accesos. Se audita lo que existe —repositorio, base de datos, cuentas de tiendas e infraestructura— y se decide qué se aprovecha. Cuando no hay repositorio ni cuentas a tu nombre, a veces rehacer sale más barato que recuperar.',
      },
      {
        q: '¿Los desarrolladores de app también se encargan de publicarla en las tiendas?',
        a: 'Debe estar incluido y por escrito. Publicar implica cuentas de desarrollador, fichas de tienda, política de privacidad, capturas y responder a la revisión de la tienda si pide cambios. Es trabajo real y conviene saber quién lo hace antes de empezar.',
      },
      {
        q: '¿Puedo empezar con algo más chico que una app completa?',
        a: 'Sí, y suele ser lo recomendable. Una primera versión con el flujo esencial permite ponerla en manos de usuarios reales y decidir el resto con información en vez de suposiciones. Muchas veces esa primera versión es web y la app móvil llega después.',
      },
    ],
    externalSources: [
      { label: 'Secretaría del Trabajo y Previsión Social', href: 'https://www.gob.mx/stps' },
      { label: 'COPARMEX', href: 'https://coparmex.org.mx/' },
    ],
    relatedSlugs: [
      'desarrolladores-de-app-puerto-vallarta',
      'desarrollo-de-app',
      'desarrolladores-de-apps',
      'desarrollo-de-aplicaciones-moviles',
      'empresas-de-desarrollo-de-software',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'armar el equipo de tu app',
  },

  // ─────────────────────────────── C1 · PV ─────────────────────────────────
  {
    slug: 'desarrolladores-de-app-puerto-vallarta',
    keyword: 'desarrolladores de app',
    h1: 'Desarrolladores de app en Puerto Vallarta',
    metaTitle: 'Desarrolladores de app en Puerto Vallarta',
    metaDescription:
      'Desarrolladores de app en Puerto Vallarta: cómo verificar al proveedor, qué aporta trabajar en sitio y qué apps piden hotelería, restaurantes y tours.',
    intro:
      'PixelTEC tiene su sede en Puerto Vallarta y construye aplicaciones para negocios de la bahía. Si buscas quién desarrolle tu app en la ciudad, aquí encontrarás dos cosas: cómo comprobar que quien te cotiza existe y opera formalmente, y qué cambia cuando el equipo puede pasar una mañana en tu recepción, tu cocina o tu muelle antes de escribir la primera línea.',
    sections: [
      {
        title: 'Por qué en la bahía conviene levantar la app en sitio',
        body: [
          'Programar se puede hacer a distancia y lo hacemos todos los días con clientes de otras ciudades. La fase que pierde información por videollamada es la primera: entender el proceso real, el que nadie tiene escrito y que solo se ve mirando cómo trabaja el personal durante un rato. En Puerto Vallarta esa fase pesa más porque los procesos del destino no se parecen a los de una empresa de oficina.',
          'Aquí la operación sigue viva sábado y domingo, el personal entra en turnos partidos, buena parte del equipo es de temporada y la carga cambia radicalmente entre el invierno y el final del verano. Una app diseñada suponiendo horario de oficina y plantilla estable falla en la primera semana de temporada alta, y falla justo cuando menos tiempo hay para arreglarla.',
          'Hay además un detalle que casi siempre aparece en sitio y casi nunca en una junta remota: dónde se usará la app. En un restaurante se usa de pie y con las manos ocupadas; en un tour, con el teléfono al sol y sin señal; en una recepción, con un huésped esperando enfrente. Esas tres condiciones cambian el diseño de la interfaz más que cualquier preferencia de marca.',
        ],
      },
      {
        title: 'Cómo verificar a un proveedor de apps en la ciudad',
        body: [
          'En un destino turístico circulan proveedores de paso: alguien que llega por temporada, cobra un anticipo y desaparece. En una app el daño es peor que en un sitio web, porque las cuentas de tienda y el código quedan del lado de quien las abrió. Verificar antes de contratar toma poco tiempo.',
        ],
        bullets: [
          {
            title: 'Búscalo en el directorio de unidades económicas',
            description:
              'El DENUE del INEGI permite consultar qué establecimientos están registrados por actividad y ubicación. No aparecer no prueba nada por sí solo, pero una empresa formal con domicilio en la ciudad suele estar ahí.',
          },
          {
            title: 'Exige que las cuentas de tienda estén a tu nombre',
            description:
              'La cuenta de desarrollador de App Store y de Google Play debe abrirse con los datos de tu empresa. Si queda a nombre del proveedor, la app publicada y sus reseñas dejan de estar bajo tu control.',
          },
          {
            title: 'Pide datos fiscales, factura y un domicilio real',
            description:
              'Constancia de situación fiscal, disposición a facturar el anticipo y un lugar al que puedas ir. Un contacto que solo existe como número de teléfono es difícil de encontrar en plena temporada.',
          },
          {
            title: 'Pregunta quién atiende una falla en fin de semana',
            description:
              'En la bahía el pico de operación es sábado y domingo. Conviene saber, antes de firmar, si hay alguien de guardia o si el reporte espera al lunes junto con la fila de huéspedes.',
          },
        ],
      },
      {
        title: 'Qué apps nos piden los negocios de la bahía',
        body: [
          'El perfil económico del destino define el tipo de aplicación que se necesita aquí. Lo que sigue son escenarios de operación frecuentes en la ciudad, no casos de clientes concretos.',
        ],
        bullets: [
          {
            title: 'Operación hotelera y renta vacacional',
            description:
              'Apps internas para housekeeping y mantenimiento: estado de cada unidad, incidencias con foto y tiempos entre estancias, funcionando también en pasillos donde el wifi no llega bien.',
          },
          {
            title: 'Restaurantes y bares',
            description:
              'Toma de comanda, control de inventario y cierre de turno desde el teléfono, pensados para usarse de pie, con prisa y sin depender de que el encargado recuerde el corte.',
          },
          {
            title: 'Operadoras de tours y actividades',
            description:
              'Listas de pasajeros, check-in en el muelle, control de cupo y liberación de embarque con la información disponible aunque el dispositivo pierda señal en la bahía.',
          },
          {
            title: 'Inmobiliaria y administración de condominios',
            description:
              'Consulta de propiedades con fichas y fotos para asesores en calle, y apps para condóminos con estado de cuenta, avisos y reportes de mantenimiento.',
          },
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los municipios con mayor actividad turística de Jalisco. El Ayuntamiento publica la información oficial del municipio y sus trámites, y el Instituto de Información Estadística y Geográfica de Jalisco (IIEG) publica las fichas estadísticas municipales del estado: son dos referencias públicas útiles para entender el contexto en el que va a operar tu app antes de diseñarla.',
        'Ese perfil —hospedaje, alimentos y bebidas, servicios turísticos, inmobiliaria y comercio ligado al visitante— explica por qué las apps que se piden aquí son en su mayoría de operación y no de escaparate: sirven para que el personal haga su trabajo más rápido en el piso, no para lucir en una presentación.',
        'Somos de aquí y operamos desde aquí. Cuando el proyecto lo justifica levantamos requerimientos en sitio y probamos la app en el lugar donde se va a usar, porque media hora en la operación real ahorra semanas de supuestos equivocados.',
      ],
    },
    useCases: [
      {
        icon: 'BedDouble',
        title: 'App de housekeeping y mantenimiento',
        description:
          'Estado de habitaciones, incidencias con evidencia fotográfica y prioridades del día en el teléfono del personal, sin depender de la radio ni de la libreta.',
      },
      {
        icon: 'Ticket',
        title: 'Check-in de tours en el muelle',
        description:
          'Lista de pasajeros, validación de reservación y control de cupo desde una tablet o un teléfono, con la información cargada antes de perder señal.',
      },
      {
        icon: 'UtensilsCrossed',
        title: 'Comanda e inventario para restaurantes',
        description:
          'Captura rápida en piso, control de insumos y cierre de turno que deja el corte listo sin que dependa de la memoria del encargado.',
      },
      {
        icon: 'MapPin',
        title: 'Soporte presencial en temporada alta',
        description:
          'Atención en sitio cuando un incidente no puede esperar, con el equipo que construyó la app y no con una mesa de ayuda que la ve por primera vez.',
      },
    ],
    faq: [
      {
        q: '¿Hay desarrolladores de app establecidos en Puerto Vallarta?',
        a: 'Sí. PixelTEC tiene su sede en la ciudad y trabaja presencialmente con negocios de la bahía. Antes de contratar a cualquier proveedor local conviene verificar su registro en el DENUE del INEGI, pedir constancia fiscal y confirmar un domicilio al que puedas ir.',
      },
      {
        q: '¿La app va a funcionar donde no hay buena señal?',
        a: 'Se diseña para eso cuando el caso lo pide. En muelles, sótanos, cocinas y pasillos de hotel la señal es intermitente, así que la app guarda lo capturado en el dispositivo y lo sincroniza al recuperar conexión. Es una decisión de arquitectura que hay que tomar al inicio, no al final.',
      },
      {
        q: '¿Pueden hacer la app en español e inglés?',
        a: 'Sí. En un destino con visitantes y residentes extranjeros lo habitual es que la app interna esté en español para el personal y la parte visible para el huésped o cliente esté en los dos idiomas. Conviene decidirlo desde el diseño, porque los textos afectan el espacio de cada pantalla.',
      },
      {
        q: '¿Cómo trabajan con personal que rota cada temporada?',
        a: 'Con dos decisiones: interfaces que se aprendan sin capacitación larga y una capacitación grabada que sirva para cada nueva entrada de personal. También ayuda dejar los permisos por rol bien definidos, para que dar de alta a alguien nuevo sea un trámite de minutos.',
      },
      {
        q: '¿Atienden a negocios de Bahía de Banderas y la zona conurbada?',
        a: 'Sí. Trabajamos con negocios de Puerto Vallarta y su zona de influencia, y de forma remota con clientes del resto de México. Lo que se coordina es cuándo conviene una visita presencial, normalmente al levantar requerimientos y al capacitar.',
      },
    ],
    externalSources: [
      { label: 'IIEG Jalisco — información estadística municipal', href: 'https://iieg.gob.mx/' },
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
    ],
    relatedSlugs: [
      'desarrolladores-de-app',
      'desarrollo-de-app-puerto-vallarta',
      'desarrolladores-de-apps-puerto-vallarta',
      'desarrollo-de-aplicaciones-moviles-puerto-vallarta',
      'empresas-de-desarrollo-de-software-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'desarrollar tu app en Puerto Vallarta',
  },

  // ───────────────────────────── C2 · genérica ─────────────────────────────
  {
    slug: 'desarrollo-de-app',
    keyword: 'desarrollo de app',
    h1: 'Desarrollo de app: el proceso completo, fase por fase',
    metaTitle: 'Desarrollo de app: el proceso completo, fase por fase',
    metaDescription:
      'Cómo es un proyecto de desarrollo de app de principio a fin: descubrimiento, diseño, construcción, publicación en tiendas y mantenimiento posterior.',
    intro:
      'La mayoría de los proyectos de desarrollo de app no fracasan por el código: fracasan porque nadie acordó qué se iba a construir, en qué orden y quién decide. Esta página describe el proceso completo, fase por fase, con lo que se decide en cada una, lo que se entrega y los errores que hacen que un proyecto se alargue el doble de lo previsto.',
    sections: [
      {
        title: 'Descubrimiento: definir el problema antes que la app',
        body: [
          'La primera fase no produce pantallas, produce acuerdos. Se responde qué problema resuelve la app, quién la va a usar y en qué circunstancias, qué se considera un éxito medible y qué queda explícitamente fuera de la primera versión. Ese último punto es el que más discusión ahorra después: un alcance escrito con lo que no incluye protege a las dos partes.',
          'También se levanta lo que ya existe. Casi ningún negocio parte de cero: hay un sistema de facturación, una hoja de cálculo que alguien mantiene, un punto de venta, un CRM. La app tendrá que convivir con eso o reemplazarlo, y saber cuál de las dos cosas desde el principio cambia la arquitectura completa.',
          'De aquí sale un alcance, una lista priorizada de funcionalidad y una estimación con supuestos explícitos. Una estimación sin supuestos escritos no es una estimación: es un número que alguien va a tener que defender más adelante sin argumentos.',
        ],
      },
      {
        title: 'Diseño y construcción: de los flujos a la app funcionando',
        body: [
          'El diseño define los flujos y las pantallas antes de programar. No se trata de decidir colores: se trata de recorrer, pantalla por pantalla, qué ve el usuario, qué puede hacer, qué pasa si se equivoca y qué pasa si no hay conexión. Mover un botón en el diseño cuesta minutos; moverlo cuando ya está construido, probado y conectado al backend cuesta días.',
          'La construcción avanza por entregas cortas y revisables. Cada bloque termina en algo instalable o abrible que el cliente puede usar, no en un porcentaje de avance. Esto tiene un costo —hay que preparar cada entrega— y una ventaja que lo compensa: los desvíos se detectan cuando corregirlos todavía es barato, y el equipo del cliente participa en decisiones que le tocan a él.',
          'En paralelo se construye el backend: base de datos, autenticación, permisos por rol e integraciones. En las apps de negocio esta parte suele ser mayor que la visible, y es la que determina si la app aguanta el crecimiento o hay que rehacerla en dos años.',
        ],
        bullets: [
          {
            title: 'Errores que alargan un proyecto',
            description:
              'Agregar funcionalidad a mitad de camino sin quitar nada de la lista, dejar la validación del cliente para el final, no definir quién aprueba cada entrega y descubrir en la última semana que había que integrarse con un sistema que nadie mencionó.',
          },
          {
            title: 'Qué acelera un proyecto de verdad',
            description:
              'Una primera versión deliberadamente pequeña, una persona del negocio disponible para resolver dudas en el día, acceso temprano a los sistemas con los que hay que integrarse y decisiones tomadas por escrito.',
          },
        ],
      },
      {
        title: 'Publicación y mantenimiento: lo que empieza el día de la entrega',
        body: [
          'Publicar una app no es subir un archivo. Implica cuentas de desarrollador a nombre de la empresa, ficha de tienda con capturas y descripción, política de privacidad publicada y accesible, declaración de qué datos recolecta la app y una revisión por parte de la tienda que puede pedir cambios. Ese trámite tiene tiempos propios y conviene contemplarlo en el calendario, no descubrirlo la semana de la entrega.',
          'Si la app usa una marca o un nombre comercial propio, conviene revisar el registro marcario antes de imprimirlo en la ficha de tienda y en el ícono. El IMPI concentra la información de propiedad industrial en México y permite consultar antes de invertir en una identidad que quizá haya que cambiar.',
          'Después de publicar empieza el mantenimiento, que no es opcional: los sistemas operativos cambian cada año, las tiendas actualizan sus requisitos y las bibliotecas que usa la app reciben parches de seguridad. Una app sin mantenimiento no se queda igual, se degrada hasta que un día deja de instalarse. Por eso lo cotizamos aparte y con alcance definido, para que se vea qué cuesta sostenerla.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Route',
        title: 'Primera versión con alcance acotado',
        description:
          'Proyectos que necesitan salir a producción con lo esencial para aprender de usuarios reales y decidir el resto con información en lugar de suposiciones.',
      },
      {
        icon: 'Layers',
        title: 'App conectada a los sistemas que ya usas',
        description:
          'Aplicaciones que leen y escriben en el ERP, el punto de venta o el sistema de reservaciones existentes, en vez de crear una isla de datos nueva.',
      },
      {
        icon: 'ClipboardList',
        title: 'Rescate de un proyecto con alcance descontrolado',
        description:
          'Desarrollos que llevan meses sin liberar nada: se congela el alcance, se define una versión publicable y se retoma el ritmo de entregas.',
      },
      {
        icon: 'Rocket',
        title: 'Publicación y trámite en tiendas',
        description:
          'Preparación de cuentas, fichas, políticas de privacidad y respuesta a la revisión de App Store y Google Play hasta que la app queda disponible.',
      },
    ],
    faq: [
      {
        q: '¿Cuánto tarda el desarrollo de una app?',
        a: 'Depende del alcance, de cuántos sistemas haya que integrar y de la disponibilidad del equipo del cliente para validar entregas. Lo que sí se puede fijar desde el inicio es el ritmo: entregas revisables cada pocas semanas, para que el avance sea verificable y no una promesa.',
      },
      {
        q: '¿Qué influye en el costo de una app?',
        a: 'El número de flujos distintos, los perfiles de usuario y sus permisos, las integraciones con sistemas externos, si necesita funcionar sin conexión, si va a una o a varias plataformas, y el nivel de pruebas exigido. La complejidad del backend suele pesar más que el número de pantallas.',
      },
      {
        q: '¿Qué se entrega al terminar el desarrollo de una app?',
        a: 'El código en un repositorio a nombre del cliente, las cuentas de tiendas e infraestructura, la documentación de arquitectura y despliegue, y una capacitación con el equipo que va a operarla. Sin eso, el siguiente proveedor cobrará por volver a entender lo que ya pagaste.',
      },
      {
        q: '¿Puedo cambiar requisitos a mitad del proyecto?',
        a: 'Sí, y es normal que aparezcan cosas al ver la app funcionando. La regla sana es que agregar implica decidir qué sale o qué se mueve de fecha. El problema no son los cambios, es acumularlos sin ajustar alcance ni calendario.',
      },
      {
        q: '¿Qué pasa si la tienda rechaza la app?',
        a: 'Es parte del proceso y suele resolverse. Las tiendas piden cambios por motivos concretos —permisos mal justificados, política de privacidad ausente, contenido de la ficha— y se corrige para volver a enviarla. Conviene contemplar ese ida y vuelta en el calendario de lanzamiento.',
      },
    ],
    externalSources: [
      { label: 'IMPI — Instituto Mexicano de la Propiedad Industrial', href: 'https://www.gob.mx/impi' },
      { label: 'Secretaría de Economía', href: 'https://www.gob.mx/se' },
    ],
    relatedSlugs: [
      'desarrollo-de-app-puerto-vallarta',
      'desarrolladores-de-app',
      'desarrolladores-de-apps',
      'desarrollo-de-aplicaciones-moviles',
      'sistemas-a-medida',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'arrancar el desarrollo de tu app',
  },

  // ─────────────────────────────── C2 · PV ─────────────────────────────────
  {
    slug: 'desarrollo-de-app-puerto-vallarta',
    keyword: 'desarrollo de app',
    h1: 'Desarrollo de app en Puerto Vallarta',
    metaTitle: 'Desarrollo de app en Puerto Vallarta',
    metaDescription:
      'Desarrollo de app en Puerto Vallarta: cómo se planea el proyecto alrededor de la temporada alta, con pruebas reales y equipo que rota cada temporada.',
    intro:
      'Un proyecto de app en Puerto Vallarta se planea distinto que en una ciudad de oficinas, y no por la tecnología: por el calendario. El destino tiene una temporada en la que nadie del negocio tiene media hora libre y otra en la que sí. Esta página explica cómo ordenamos el proyecto alrededor de ese calendario y qué condiciones locales cambian el diseño de la app.',
    sections: [
      {
        title: 'El calendario del proyecto se planea alrededor de la temporada',
        body: [
          'La parte del proyecto que más depende del cliente es la primera y la última: levantar el proceso real y probar la app con quien la va a usar. Ambas exigen tiempo del personal que conoce la operación, y ese tiempo no existe en el pico de la temporada. Por eso proponemos levantar requerimientos y capacitar fuera del pico, y llegar a la temporada alta con la app estable y el equipo entrenado.',
          'La consecuencia práctica es que el arranque de un proyecto en la bahía se decide con meses de anticipación. Empezar en el pico es posible —el desarrollo tarda lo mismo— pero las validaciones se retrasan, las dudas tardan días en resolverse y el proyecto se alarga por espera, no por trabajo.',
          'Hay una excepción que aprovechamos cuando aplica: la temporada alta es el mejor momento para observar el problema. A veces conviene ir a mirar la operación saturada, tomar notas y construir después, cuando el negocio pueda participar sin sacrificar servicio.',
        ],
      },
      {
        title: 'Condiciones locales que cambian el diseño de la app',
        body: [
          'Estas restricciones aparecen una y otra vez en proyectos del destino. No son detalles de acabado: son decisiones de arquitectura que hay que tomar al principio, porque cambiarlas después implica rehacer.',
        ],
        bullets: [
          {
            title: 'Conectividad que se cae donde más se usa',
            description:
              'Cocinas, sótanos de hotel, muelles, lanchas y zonas de sierra tienen señal intermitente. La app guarda lo capturado en el dispositivo y sincroniza al recuperar conexión, con reglas claras para cuando dos dispositivos editaron lo mismo.',
          },
          {
            title: 'Uso de pie y con las manos ocupadas',
            description:
              'Botones grandes, pocos pasos por tarea y confirmaciones visibles a un metro. Una interfaz pensada para escritorio se vuelve inutilizable en un pasillo con un huésped esperando.',
          },
          {
            title: 'Personal que rota cada temporada',
            description:
              'La app tiene que aprenderse sin capacitación larga y los permisos por rol deben permitir dar de alta a alguien en minutos. Toda función que requiera explicación previa es una función que fallará en el primer relevo.',
          },
          {
            title: 'Dos idiomas y visitantes extranjeros',
            description:
              'Lo que ve el personal suele ir en español y lo que ve el huésped o cliente, en español e inglés. Definirlo desde el diseño evita rehacer pantallas donde el texto traducido ya no cabe.',
          },
          {
            title: 'Picos de carga concentrados',
            description:
              'La operación de un fin de semana de temporada no se parece al promedio anual. La infraestructura y las pruebas se dimensionan para el pico, no para el día tranquilo en que se hizo la demo.',
          },
        ],
      },
      {
        title: 'Cómo probamos la app en la operación real',
        body: [
          'Antes de liberar, la app se prueba donde se va a usar: en la recepción, en la cocina, en el muelle o en el recorrido del asesor inmobiliario, con el personal que la va a operar y no solo con el gerente que la pidió. Ahí aparecen los problemas que ninguna revisión de escritorio detecta: el brillo del sol, el guante, la prisa, la pregunta que el sistema no permite responder.',
          'Cuando el proyecto lo justifica hacemos una liberación por etapas: primero un área o una sucursal, se corrige con lo aprendido y luego el resto. Es más lento en el papel y más rápido en la práctica, porque evita que un error se multiplique por todo el negocio en plena temporada.',
          'La capacitación queda grabada y en español claro, con el nivel de detalle que necesita alguien que entra en mitad de la temporada sin haber visto nunca el sistema. Es la diferencia entre una app que sobrevive al relevo de personal y una que se abandona en diciembre.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta es uno de los destinos turísticos principales de Jalisco. La Secretaría de Turismo del Estado de Jalisco publica información oficial de los destinos y su actividad, y el Gobierno de Jalisco mantiene la ficha del municipio con sus datos generales: son referencias públicas útiles para dimensionar el contexto en el que va a operar la aplicación.',
        'La estacionalidad de ese contexto es el dato que más influye en un proyecto de app aquí: define cuándo hay tiempo para levantar el proceso, cuándo se puede probar sin arriesgar servicio y cuándo la app tiene que estar estable sí o sí.',
        'Trabajamos desde la ciudad, así que las visitas de levantamiento, prueba y capacitación no dependen de un viaje: se agendan según la operación del negocio, incluidos fines de semana cuando ahí está el pico.',
      ],
    },
    useCases: [
      {
        icon: 'CalendarCheck',
        title: 'Proyecto planeado por temporada',
        description:
          'Levantamiento y capacitación fuera del pico, liberación antes de que empiece: el calendario del proyecto se ajusta al del negocio, no al revés.',
      },
      {
        icon: 'Repeat',
        title: 'App que funciona sin conexión estable',
        description:
          'Captura local y sincronización posterior para muelles, cocinas y pasillos donde la señal se pierde justo cuando hay más trabajo.',
      },
      {
        icon: 'Users',
        title: 'Alta rápida de personal de temporada',
        description:
          'Permisos por rol y capacitación grabada para que sumar a alguien nuevo sea un trámite de minutos y no una explicación de dos horas.',
      },
      {
        icon: 'PlaneTakeoff',
        title: 'Interfaz bilingüe para huésped y visitante',
        description:
          'Lo que usa el personal en español y lo que ve el cliente en español e inglés, decidido desde el diseño para que cada texto quepa en pantalla.',
      },
    ],
    faq: [
      {
        q: '¿Cuándo conviene arrancar un proyecto de app en Puerto Vallarta?',
        a: 'Idealmente cuando tu equipo tenga tiempo para participar, es decir fuera del pico de temporada. El desarrollo tarda lo mismo en cualquier mes, pero las validaciones y las pruebas dependen del personal que conoce la operación, y en temporada alta ese tiempo no existe.',
      },
      {
        q: '¿Prueban la app en el lugar donde se va a usar?',
        a: 'Sí, cuando el proyecto lo justifica. Probamos en recepción, cocina, muelle o en recorrido con el personal que la va a operar. Ahí aparecen el sol, la prisa y las excepciones que ninguna revisión de escritorio detecta.',
      },
      {
        q: '¿Se puede liberar la app por etapas?',
        a: 'Sí, y en negocios con varias áreas o sucursales suele ser lo más seguro. Se libera en un área, se corrige con lo aprendido y luego se extiende. Evita que un error se multiplique por toda la operación en plena temporada.',
      },
      {
        q: '¿Qué pasa con la app cuando cambia todo el personal de temporada?',
        a: 'Debe estar preparada para eso: interfaz que se aprenda sin capacitación larga, permisos por rol para dar de alta en minutos y capacitación grabada disponible todo el año. Si cada relevo exige volver a capacitar en vivo, la app se abandona sola.',
      },
      {
        q: '¿Trabajan también con negocios pequeños de la bahía?',
        a: 'Sí. Un negocio pequeño no necesita menos rigor, necesita menos alcance: una primera versión con el flujo que más duele y el resto después. Lo decimos incluso cuando la respuesta honesta es que no hace falta una app, sino una herramienta más simple.',
      },
    ],
    externalSources: [
      { label: 'Secretaría de Turismo de Jalisco', href: 'https://secturjal.jalisco.gob.mx/' },
      {
        label: 'Gobierno de Jalisco — municipio de Puerto Vallarta',
        href: 'https://www.jalisco.gob.mx/es/jalisco/municipios/puerto-vallarta',
      },
    ],
    relatedSlugs: [
      'desarrollo-de-app',
      'desarrolladores-de-app-puerto-vallarta',
      'desarrolladores-de-apps-puerto-vallarta',
      'desarrollo-de-aplicaciones-moviles-puerto-vallarta',
      'sistemas-a-medida-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'planear tu app en Puerto Vallarta',
  },

  // ───────────────────────────── C3 · genérica ─────────────────────────────
  {
    slug: 'desarrolladores-de-apps',
    keyword: 'desarrolladores de apps',
    h1: 'Desarrolladores de apps: web app, PWA o app móvil',
    metaTitle: 'Desarrolladores de apps: web app, PWA o móvil',
    metaDescription:
      'Web app, PWA o app móvil: qué tipo construyen los desarrolladores de apps según tu caso, con las ventajas y los costos reales de cada camino.',
    intro:
      'La palabra «app» significa cosas muy distintas según quién la use: puede ser una aplicación web que se abre en el navegador, una PWA que se instala desde el sitio o una app nativa descargada de una tienda. Elegir mal el tipo es el error más caro de un proyecto, porque no se corrige con más horas de programación. Esta página explica qué construimos los desarrolladores de apps en cada caso y cómo se decide.',
    sections: [
      {
        title: 'Los tres tipos de app y en qué se diferencian de verdad',
        body: [
          'La diferencia no es estética: es cómo llega la app al usuario, qué puede hacer con el dispositivo y qué implica actualizarla. Todo lo demás —diseño, calidad, velocidad— depende de cómo se construya, no del tipo elegido.',
        ],
        bullets: [
          {
            title: 'Aplicación web',
            description:
              'Corre en el navegador y se accede con una dirección. No requiere instalación ni tienda, se actualiza para todos al instante y funciona igual en computadora, tablet y teléfono. Es la opción natural para sistemas internos que se usan sentado o con teclado.',
          },
          {
            title: 'PWA (aplicación web instalable)',
            description:
              'Es una aplicación web que el usuario puede agregar a la pantalla de inicio: se abre a pantalla completa, con ícono propio, y puede funcionar sin conexión. Da la sensación de app sin trámite de tienda, con acceso limitado a algunas funciones del dispositivo.',
          },
          {
            title: 'App móvil de tienda',
            description:
              'Se descarga de App Store o Google Play. Es la única vía cuando hace falta uso intensivo de cámara, sensores, notificaciones push confiables en todos los casos, funcionamiento prolongado sin red o presencia en la tienda como canal de descubrimiento.',
          },
        ],
      },
      {
        title: 'Cómo se decide cuál conviene',
        body: [
          'La decisión se toma con cuatro preguntas, en este orden. Primero: ¿quién la va a usar? Si son empleados de tu propia empresa, la tienda es un obstáculo, no un beneficio: una web app o una PWA se distribuye con un enlace y se actualiza sin esperar revisión. Si son clientes finales que esperan encontrarte en la tienda, esa presencia sí cuenta.',
          'Segundo: ¿qué necesita del dispositivo? Escanear códigos de forma constante, usar sensores, mantener la app corriendo en segundo plano o funcionar horas sin señal empuja hacia la app de tienda. Consultar, capturar formularios, aprobar y reportar se resuelve perfectamente en web.',
          'Tercero: ¿con qué frecuencia va a cambiar? Una app de tienda pasa por revisión en cada actualización y por la voluntad del usuario de actualizar; una web app cambia para todos en el momento en que se publica. En sistemas que evolucionan cada mes, esa diferencia se nota mucho.',
          'Cuarto: ¿qué se puede sostener? Cada plataforma adicional es código, pruebas y mantenimiento adicionales para siempre. Publicar en dos tiendas y además tener versión web triplica la superficie que hay que cuidar. Empezar por una sola y crecer con demanda comprobada es casi siempre la decisión correcta.',
        ],
      },
      {
        title: 'Qué construimos en PixelTEC y con qué criterio',
        body: [
          'Construimos aplicaciones web y PWA como opción por defecto para sistemas de operación: llegan antes a producción, se actualizan sin trámite y se distribuyen con un enlace. Cuando el caso lo exige —cámara intensiva, sensores, uso prolongado sin red o distribución en tienda— construimos la app móvil, y lo decimos con la razón por delante, no como venta adicional.',
          'En todos los casos el backend es el mismo activo: base de datos, permisos por rol, integraciones y servicios que la app consume. Eso permite que, si mañana hace falta una app de tienda además de la web, no se empiece de cero: se construye otro cliente sobre la misma base ya probada.',
          'Y decimos que no cuando aplica. Hay problemas que se resuelven mejor con un flujo automatizado, un panel web o una integración entre los sistemas que ya usas que con una app nueva que alguien tendría que instalar y aprender. Preferimos ese diagnóstico a un proyecto más grande.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Globe',
        title: 'Aplicación web para operación interna',
        description:
          'Sistemas que el equipo usa desde computadora o tablet: inventarios, cotizadores, seguimiento de pedidos y paneles de control, sin instalar nada.',
      },
      {
        icon: 'Smartphone',
        title: 'PWA instalable para personal en piso',
        description:
          'Aplicación que se agrega a la pantalla de inicio, abre a pantalla completa y sigue capturando cuando la señal falla, sin pasar por la tienda.',
      },
      {
        icon: 'AppWindow',
        title: 'App de tienda para clientes finales',
        description:
          'Cuando la presencia en App Store o Google Play es parte del canal, o cuando el uso de cámara, sensores y notificaciones lo hace necesario.',
      },
      {
        icon: 'Database',
        title: 'Un backend, varios clientes',
        description:
          'Una base común de datos, permisos e integraciones sobre la que pueden convivir la versión web y la móvil sin duplicar reglas de negocio.',
      },
    ],
    faq: [
      {
        q: '¿Cuál es la diferencia entre una web app y una app nativa?',
        a: 'La web app se abre en el navegador con una dirección, no se instala desde una tienda y se actualiza para todos al publicarla. La app nativa se descarga de App Store o Google Play, tiene acceso completo al dispositivo y cada actualización pasa por la revisión de la tienda.',
      },
      {
        q: '¿Qué es una PWA y cuándo conviene?',
        a: 'Es una aplicación web que el usuario puede instalar en la pantalla de inicio: abre a pantalla completa, con ícono propio, y puede seguir funcionando sin conexión. Conviene cuando se quiere experiencia de app y actualización inmediata sin el trámite de publicar en tiendas.',
      },
      {
        q: '¿Necesito una app o me sirve una aplicación web?',
        a: 'Si quien la usa es tu propio equipo y el trabajo es consultar, capturar y aprobar, una aplicación web suele bastar y llega antes a producción. Si hace falta cámara intensiva, sensores, uso prolongado sin señal o presencia en tienda, entonces la app móvil se justifica.',
      },
      {
        q: '¿Puedo tener la misma app en web, iOS y Android?',
        a: 'Sí, y lo habitual es compartir el backend entre todas las versiones para no duplicar reglas de negocio. Lo que hay que dimensionar es el mantenimiento: cada plataforma adicional es código y pruebas que hay que sostener durante toda la vida del sistema.',
      },
      {
        q: '¿Los desarrolladores de apps pueden reutilizar mi sistema actual?',
        a: 'En muchos casos sí. Si tu sistema ya expone datos o permite integración, la app se construye encima en lugar de duplicar información. Cuando no la permite, se evalúa si conviene abrir esa capa o si sale mejor reemplazar el sistema; ambas respuestas son legítimas según el caso.',
      },
    ],
    externalSources: [
      { label: 'INEGI — Tecnologías de la información y comunicaciones', href: 'https://www.inegi.org.mx/temas/tic/' },
      { label: 'CANACINTRA', href: 'https://canacintra.org.mx/' },
    ],
    relatedSlugs: [
      'desarrolladores-de-apps-puerto-vallarta',
      'desarrolladores-de-app',
      'desarrollo-de-app',
      'desarrollo-de-aplicaciones-moviles',
      'sistema-personalizado-para-empresas',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'elegir el tipo de app que necesitas',
  },

  // ─────────────────────────────── C3 · PV ─────────────────────────────────
  {
    slug: 'desarrolladores-de-apps-puerto-vallarta',
    keyword: 'desarrolladores de apps',
    h1: 'Desarrolladores de apps en Puerto Vallarta',
    metaTitle: 'Desarrolladores de apps en Puerto Vallarta',
    metaDescription:
      'Desarrolladores de apps en Puerto Vallarta: qué tipo de app conviene a un restaurante, un hotel, una operadora de tours o una inmobiliaria local.',
    intro:
      'La pregunta que más recibimos de negocios de la bahía no es «cuánto cuesta una app», sino «qué tipo de app necesito». La respuesta cambia por completo según el giro: lo que le sirve a un restaurante no es lo que le sirve a una operadora de tours, y en varios casos la respuesta honesta es que no hace falta una app de tienda. Aquí lo desglosamos por giro.',
    sections: [
      {
        title: 'Qué tipo de app conviene según el giro del negocio',
        body: [
          'Lo que sigue son escenarios de operación frecuentes en Puerto Vallarta, no casos de clientes concretos. La recomendación cambia con el detalle de cada negocio, pero el criterio de fondo se mantiene: la app de tienda solo se justifica cuando hay una razón técnica o de canal que la exija.',
        ],
        bullets: [
          {
            title: 'Restaurantes y bares',
            description:
              'Casi siempre una PWA instalable: comanda, inventario y cierre de turno desde el teléfono del personal, sin trámite de tienda y actualizable el mismo día en que se corrige algo a mitad de la temporada.',
          },
          {
            title: 'Hoteles y renta vacacional',
            description:
              'PWA para housekeeping y mantenimiento con captura sin conexión, y panel web para gerencia. La app de tienda se justifica cuando el huésped es el usuario final y la marca quiere presencia descargable.',
          },
          {
            title: 'Operadoras de tours y actividades',
            description:
              'Aquí la app de tienda sí suele tener sentido para el operador en campo: check-in en el muelle, listas de pasajeros y control de cupo que deben funcionar horas sin señal y con la batería justa.',
          },
          {
            title: 'Inmobiliaria y administración de condominios',
            description:
              'Web app para el equipo de ventas y administración, y portal o app ligera para el propietario que consulta estado de cuenta y avisos sin llamar a la oficina.',
          },
          {
            title: 'Consultorios y servicios de salud',
            description:
              'Aplicación web con control de acceso estricto para el expediente y la agenda, y recordatorios por canales que el paciente ya usa. El manejo de datos personales pesa más que el tipo de app.',
          },
        ],
      },
      {
        title: 'Restricciones del destino que empujan la decisión',
        body: [
          'Tres condiciones locales inclinan la balanza en la bahía. La primera es la conectividad: muelles, lanchas, cocinas y sótanos de hotel pierden señal justo en las horas de más trabajo. Cuando la operación depende de capturar ahí, la app tiene que guardar en el dispositivo y sincronizar después, y eso se puede resolver tanto en PWA como en app de tienda —pero hay que decidirlo desde el diseño.',
          'La segunda es la rotación de personal por temporada. Toda instalación desde tienda es una fricción más para cada persona nueva: descargar, iniciar sesión, dar permisos. Una PWA que se abre con un enlace y se agrega a la pantalla de inicio reduce ese trámite a un paso, lo que importa mucho cuando entran varias personas por semana.',
          'La tercera es el usuario final. Si la app la va a usar el visitante, hay que competir por espacio en un teléfono que ya está lleno de aplicaciones de viaje: descargar una app para una estancia de cuatro días es una barrera real. En esos casos suele rendir más una experiencia web bien hecha, y reservar la app de tienda para el personal o para clientes recurrentes.',
        ],
      },
      {
        title: 'Cómo lo definimos contigo',
        body: [
          'Empezamos por observar el trabajo, no por elegir tecnología. Media hora viendo cómo se toma una comanda, cómo se sube un grupo a la lancha o cómo se entrega una habitación aporta más criterio que una junta de requisitos, y es la parte que podemos hacer en persona porque estamos en la ciudad.',
          'De ahí sale una recomendación con su razón: qué tipo de app conviene, qué queda en la primera versión y qué se puede posponer sin lastimar la operación. Si el resultado es que no necesitas una app —sino un panel web, una automatización o arreglar una integración— lo decimos, aunque el proyecto sea más chico.',
          'Cuando arrancamos, dejamos el backend preparado para que la decisión no sea irreversible: si el próximo año la operación exige una app de tienda además de la web, se construye otro cliente sobre la misma base en lugar de empezar de nuevo.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'La actividad económica de Puerto Vallarta está concentrada en hospedaje, alimentos y bebidas, servicios turísticos y comercio ligado al visitante. El DENUE del INEGI permite consultar qué unidades económicas están registradas en la ciudad y en qué actividad, lo que ayuda a dimensionar el sector antes de decidir a quién va dirigida una app.',
        'En el caso de restaurantes y bares, la CANIRAC agrupa a la industria restaurantera del país y publica información del sector; es una referencia útil para entender el contexto en el que opera un establecimiento antes de diseñar herramientas para su piso.',
        'Nuestra sede está aquí, así que la observación en operación y las pruebas con el personal se agendan según el ritmo del negocio, incluidos fines de semana y horarios de servicio.',
      ],
    },
    useCases: [
      {
        icon: 'UtensilsCrossed',
        title: 'PWA de piso para restaurantes',
        description:
          'Comanda, inventario y cierre de turno desde el teléfono, instalable con un enlace y corregible el mismo día sin esperar la revisión de una tienda.',
      },
      {
        icon: 'Ticket',
        title: 'App de campo para operadoras de tours',
        description:
          'Check-in, listas de pasajeros y control de cupo diseñados para trabajar horas sin señal y sincronizar al volver a puerto.',
      },
      {
        icon: 'Building2',
        title: 'Portal para propietarios y condóminos',
        description:
          'Estados de cuenta, avisos y reportes de mantenimiento en línea, sin obligar al propietario a instalar nada ni a llamar a la administración.',
      },
      {
        icon: 'HeartPulse',
        title: 'Agenda y expediente para consultorios',
        description:
          'Aplicación web con control de acceso por rol y trazabilidad, con el manejo de datos personales resuelto desde el diseño.',
      },
    ],
    faq: [
      {
        q: '¿Un restaurante de Puerto Vallarta necesita una app de tienda?',
        a: 'Rara vez. Para el trabajo de piso —comanda, inventario, cierre de turno— una PWA instalable suele rendir más: se distribuye con un enlace, se corrige el mismo día y evita que cada persona nueva tenga que descargar e iniciar sesión desde una tienda.',
      },
      {
        q: '¿Sirve una app para que el huésped la descargue durante su estancia?',
        a: 'Depende de cuánto tiempo se queda y de qué gana con ella. Pedirle a alguien que instale una app para cuatro días es una barrera real; en esos casos una experiencia web bien hecha suele funcionar mejor, y la app se reserva para el personal o para clientes recurrentes.',
      },
      {
        q: '¿Qué tipo de app conviene a una operadora de tours de la bahía?',
        a: 'Normalmente una que funcione sin señal durante horas: check-in de pasajeros, control de cupo y evidencia de embarque guardados en el dispositivo y sincronizados al volver. Ese requisito es el que más empuja hacia una app de tienda frente a una web app.',
      },
      {
        q: '¿Pueden empezar con una versión web y agregar la app móvil después?',
        a: 'Sí, y es el camino que más recomendamos aquí. Se construye el backend una sola vez y el primer cliente es web; si la operación después exige una app de tienda, se agrega otro cliente sobre la misma base sin rehacer las reglas de negocio.',
      },
      {
        q: '¿Trabajan con negocios de varios giros a la vez?',
        a: 'Sí. Los giros del destino comparten más de lo que parece: turnos, personal rotativo, picos de temporada y conectividad irregular. Lo que cambia es el contenido del sistema, no la forma de levantarlo, probarlo y sostenerlo.',
      },
    ],
    externalSources: [
      { label: 'INEGI — DENUE, directorio de unidades económicas', href: 'https://www.inegi.org.mx/app/mapa/denue/' },
      { label: 'CANIRAC — Cámara Nacional de la Industria Restaurantera', href: 'https://canirac.org.mx/' },
    ],
    relatedSlugs: [
      'desarrolladores-de-apps',
      'desarrolladores-de-app-puerto-vallarta',
      'desarrollo-de-app-puerto-vallarta',
      'desarrollo-de-aplicaciones-moviles-puerto-vallarta',
      'sistema-personalizado-para-empresas-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'definir el tipo de app para tu negocio',
  },

  // ───────────────────────────── C4 · genérica ─────────────────────────────
  {
    slug: 'desarrollo-de-aplicaciones-moviles',
    keyword: 'desarrollo de aplicaciones moviles',
    h1: 'Desarrollo de aplicaciones móviles: iOS, Android y PWA',
    metaTitle: 'Desarrollo de aplicaciones móviles: iOS, Android y PWA',
    metaDescription:
      'Desarrollo de aplicaciones móviles para iOS, Android y PWA: cómo se elige la tecnología, qué exigen las tiendas y qué cuesta mantener la app publicada.',
    intro:
      'El desarrollo de aplicaciones móviles tiene tres decisiones que definen el costo y la vida del proyecto: a qué plataformas se va, cómo se construye para ellas y qué implica sostener la app una vez publicada. Esta página explica cada una con sus consecuencias reales, incluida la parte que casi nunca aparece en las propuestas: lo que cuesta mantener una app viva en las tiendas.',
    sections: [
      {
        title: 'A qué plataformas ir y con qué tecnología construir',
        body: [
          'La primera decisión es a cuántas plataformas ir. Cada una adicional es código, pruebas, publicaciones y mantenimiento para siempre, así que la pregunta correcta no es «¿podemos hacer las dos?» sino «¿nuestros usuarios están en las dos?». En apps internas la respuesta suele ser conocida: se sabe qué teléfonos usa el personal. En apps para público general normalmente hay que cubrir ambas.',
          'La segunda decisión es cómo construir. Hay tres caminos habituales y ninguno es superior en abstracto: se elige según el uso que la app hace del dispositivo, el equipo que la va a mantener y el tiempo disponible para salir.',
        ],
        bullets: [
          {
            title: 'Desarrollo nativo por plataforma',
            description:
              'Una base de código para iOS y otra para Android. Da el mejor acceso a las capacidades del dispositivo y el rendimiento más fino, a cambio de dos desarrollos y dos mantenimientos en paralelo.',
          },
          {
            title: 'Multiplataforma con una sola base',
            description:
              'Una base de código que genera ambas apps. Reduce mucho el trabajo duplicado y funciona bien en la mayoría de las apps de negocio; se complica cuando se depende de funciones muy específicas de una plataforma.',
          },
          {
            title: 'PWA instalable',
            description:
              'Aplicación web que se agrega a la pantalla de inicio, abre a pantalla completa y puede funcionar sin conexión. Evita el trámite de tiendas y actualiza al instante, con acceso más limitado a las funciones del dispositivo.',
          },
        ],
      },
      {
        title: 'Publicar en las tiendas: lo que hay que preparar',
        body: [
          'Publicar una app móvil implica trámite además de programación, y ese trámite tiene tiempos propios. Hace falta una cuenta de desarrollador a nombre de la empresa, la ficha de tienda con capturas y descripción, un ícono, una política de privacidad publicada y accesible, y la declaración de qué datos recolecta la app y para qué. Después viene la revisión de la tienda, que puede pedir cambios antes de aprobar.',
          'La parte de datos personales no es un formulismo. Si la app recolecta información de personas, corresponde publicar un aviso de privacidad y tratar esos datos conforme a la normativa mexicana en la materia; el INAI concentra la información oficial sobre protección de datos personales. Conviene resolverlo durante el diseño y no la semana del lanzamiento, porque a veces obliga a cambiar qué se guarda y dónde.',
          'Si la app vende, cobra o intermedia una compra, también aplica lo que corresponde al comercio electrónico y a los derechos del consumidor: información clara de precio y condiciones, comprobante y un canal de aclaraciones. PROFECO publica la información oficial en esa materia. No es un detalle legal aislado: cambia pantallas concretas de la app.',
        ],
      },
      {
        title: 'Qué cuesta mantener una app publicada',
        body: [
          'Una app publicada no se queda quieta. iOS y Android liberan versiones nuevas cada año y periódicamente exigen que las apps se compilen contra versiones recientes para seguir aceptando actualizaciones; las bibliotecas que usa la app reciben parches de seguridad; y los dispositivos que usan tus usuarios cambian de tamaño y de capacidades. Sin trabajo de mantenimiento, una app no se mantiene igual: se degrada hasta que deja de instalarse o de pasar la revisión.',
          'A eso se suman los costos recurrentes que conviene tener claros desde el principio: las cuentas de desarrollador de las tiendas, la infraestructura donde vive el backend, los respaldos y el monitoreo, y las horas de soporte para atender reportes de usuarios. Ninguno es enorme por separado; juntos son el presupuesto anual real de tener una app.',
          'Por eso cotizamos el mantenimiento aparte y con alcance definido en vez de mezclarlo en el precio del desarrollo. Un cliente que sabe qué cuesta sostener su app puede decidir con datos si le conviene una, dos o ninguna plataforma; uno que no lo sabe se entera el segundo año, que es el peor momento para enterarse.',
        ],
      },
    ],
    useCases: [
      {
        icon: 'Smartphone',
        title: 'App móvil para personal en campo',
        description:
          'Captura, evidencia fotográfica y consulta desde el teléfono para equipos que trabajan fuera de la oficina, con sincronización al recuperar señal.',
      },
      {
        icon: 'Cpu',
        title: 'Una sola base para iOS y Android',
        description:
          'Desarrollo multiplataforma cuando la app no depende de funciones exclusivas de un sistema, para reducir el trabajo duplicado y el mantenimiento.',
      },
      {
        icon: 'ShieldCheck',
        title: 'App que maneja datos personales',
        description:
          'Aviso de privacidad, permisos por rol, cifrado y control de acceso resueltos desde el diseño, no agregados la semana previa a publicar.',
      },
      {
        icon: 'Timer',
        title: 'Mantenimiento de una app ya publicada',
        description:
          'Actualizaciones por cambios de sistema operativo y de requisitos de tienda, parches de seguridad, monitoreo y atención de reportes de usuarios.',
      },
    ],
    faq: [
      {
        q: '¿Conviene desarrollar para iOS y Android al mismo tiempo?',
        a: 'Solo si tus usuarios están en ambas. En apps internas se sabe qué dispositivos usa el personal y muchas veces basta una plataforma. En apps para público general suele haber que cubrir las dos, y ahí un desarrollo multiplataforma reduce el trabajo duplicado.',
      },
      {
        q: '¿Qué se necesita para publicar una app en App Store y Google Play?',
        a: 'Una cuenta de desarrollador a nombre de la empresa, la ficha de tienda con capturas y descripción, un ícono, una política de privacidad publicada y la declaración de qué datos recolecta la app. Después viene la revisión de la tienda, que puede pedir cambios antes de aprobar.',
      },
      {
        q: '¿Cuánto cuesta mantener una aplicación móvil publicada?',
        a: 'Varía con el alcance, pero el presupuesto anual incluye siempre lo mismo: cuentas de desarrollador, infraestructura del backend, respaldos y monitoreo, actualizaciones por cambios de sistema operativo o de requisitos de tienda, y horas de soporte. Lo cotizamos aparte para que sea visible.',
      },
      {
        q: '¿Qué obligaciones tengo si mi app recolecta datos de usuarios?',
        a: 'Publicar un aviso de privacidad accesible, informar qué datos se recaban y para qué, y tratarlos conforme a la normativa mexicana de protección de datos personales, cuya información oficial concentra el INAI. Es una decisión de diseño: afecta qué se guarda, dónde y por cuánto tiempo.',
      },
      {
        q: '¿Puedo evitar las tiendas con una PWA?',
        a: 'En muchos casos sí. Una PWA se instala desde el sitio, abre a pantalla completa y puede funcionar sin conexión, sin trámite ni revisión. Los límites están en el acceso a algunas funciones del dispositivo y en que no aparece en la tienda como canal de descubrimiento.',
      },
    ],
    externalSources: [
      { label: 'INAI — protección de datos personales', href: 'https://home.inai.org.mx/' },
      { label: 'PROFECO — Procuraduría Federal del Consumidor', href: 'https://www.gob.mx/profeco' },
    ],
    relatedSlugs: [
      'desarrollo-de-aplicaciones-moviles-puerto-vallarta',
      'desarrolladores-de-apps',
      'desarrollo-de-app',
      'desarrolladores-de-app',
      'software-a-medida-para-empresas',
    ],
    hub: 'ecosistemas-web',
    ctaHref: '/contact',
    ctaVerb: 'desarrollar tu aplicación móvil',
  },

  // ─────────────────────────────── C4 · PV ─────────────────────────────────
  {
    slug: 'desarrollo-de-aplicaciones-moviles-puerto-vallarta',
    keyword: 'desarrollo de aplicaciones moviles',
    h1: 'Desarrollo de aplicaciones móviles en Puerto Vallarta',
    metaTitle: 'Desarrollo de aplicaciones móviles en Puerto Vallarta',
    metaDescription:
      'Desarrollo de aplicaciones móviles en Puerto Vallarta: apps para visitantes y para la operación local, con publicación en tiendas y soporte en sitio.',
    intro:
      'En Puerto Vallarta el teléfono es la herramienta de trabajo de buena parte del personal y el único dispositivo que trae el visitante. Eso divide los proyectos móviles de la bahía en dos familias muy distintas: apps para que el equipo opere mejor y apps dirigidas al visitante. Se diseñan, se prueban y se mantienen de forma diferente, y aquí explicamos cómo abordamos cada una.',
    sections: [
      {
        title: 'Dos familias de app móvil en el destino',
        body: [
          'La primera familia es la app de operación: la usa el personal del hotel, del restaurante, de la operadora de tours o de la administración de condominios. Se instala una vez, se usa todos los días y su éxito se mide en tiempo ahorrado y errores evitados. Aquí la prioridad es que funcione con señal irregular, que se aprenda rápido y que la instalación no sea un obstáculo para el personal que entra en temporada.',
          'La segunda familia es la app dirigida al visitante, y tiene una dificultad propia: competir por espacio en un teléfono que ya viene con aplicaciones de aerolínea, de hospedaje y de mapas. Pedirle a alguien que descargue una app para una estancia corta es una barrera real, así que la app de tienda solo se justifica cuando hay una relación recurrente —un club, una membresía, un cliente que vuelve— o una función que la web no puede dar.',
          'Cuando el proyecto es para el visitante y no hay recurrencia, solemos recomendar resolverlo con una experiencia web bien hecha y reservar la inversión móvil para el personal. Lo decimos incluso cuando implica un proyecto más chico, porque una app que nadie descarga cuesta lo mismo que una que sí.',
        ],
      },
      {
        title: 'Condiciones de la bahía que cambian el desarrollo móvil',
        body: [
          'Estas condiciones aparecen en casi todos los proyectos móviles del destino y hay que resolverlas en el diseño, no al final.',
        ],
        bullets: [
          {
            title: 'Horas sin señal en operación',
            description:
              'Lanchas, muelles, cocinas y sótanos de hotel. La app guarda en el dispositivo y sincroniza al recuperar conexión, con reglas explícitas para resolver conflictos cuando dos personas capturaron lo mismo.',
          },
          {
            title: 'Sol, humedad y manos ocupadas',
            description:
              'Contraste alto, tipografía legible a un metro, botones grandes y pocos pasos por tarea. Una interfaz probada solo en escritorio es ilegible en el muelle a mediodía.',
          },
          {
            title: 'Batería que tiene que durar el turno',
            description:
              'Uso continuo de cámara, escaneo y ubicación consume batería. Se mide el consumo real en el dispositivo del cliente antes de liberar, no en el simulador.',
          },
          {
            title: 'Dispositivos heredados y de gama variada',
            description:
              'El personal no usa todos el último modelo. Se define desde el inicio la versión mínima de sistema operativo soportada y se prueba en equipos reales de esa gama.',
          },
          {
            title: 'Español e inglés en la misma app',
            description:
              'Lo que ve el personal en español y lo que ve el visitante en ambos idiomas. Definirlo desde el diseño evita rehacer pantallas donde el texto traducido ya no cabe.',
          },
        ],
      },
      {
        title: 'Publicación, soporte y mantenimiento desde la ciudad',
        body: [
          'Nos encargamos del trámite de publicación con las cuentas de desarrollador a nombre del cliente: ficha de tienda, capturas, política de privacidad y la respuesta a la revisión si la tienda pide cambios. Esa parte tiene tiempos propios que se agendan con el calendario de temporada del negocio, para no quedar esperando una aprobación en la semana de más trabajo del año.',
          'El soporte lo damos desde aquí, y cuando un incidente no puede esperar podemos ir. En una app de operación el valor de eso se nota en temporada: la diferencia entre «mandamos un correo y esperamos» y «alguien llega y lo ve en el equipo donde falla» es un turno completo.',
          'El mantenimiento se cotiza aparte y con alcance definido: actualizaciones por cambios de iOS y Android, requisitos nuevos de las tiendas, parches de seguridad, respaldos, monitoreo y atención de reportes. Es el costo anual real de tener una app publicada, y preferimos que se vea desde el principio.',
        ],
      },
    ],
    localContext: {
      title: 'En Puerto Vallarta',
      body: [
        'Puerto Vallarta concentra hospedaje, alimentos y bebidas, servicios turísticos e inmobiliaria, con una operación que no se detiene en fin de semana. El Ayuntamiento publica la información oficial del municipio, y la Secretaría de Desarrollo Económico de Jalisco difunde los programas e información de apoyo a la actividad económica del estado: dos referencias públicas útiles al planear una inversión tecnológica en la ciudad.',
        'Ese contexto define el uso móvil aquí: personal en movimiento durante todo el turno, visitantes con dispositivos de otros países y ciclos de trabajo marcados por la temporada. Son restricciones de diseño, no matices.',
        'Trabajamos desde Puerto Vallarta, así que las pruebas en dispositivo real, la capacitación del personal y el soporte en temporada se hacen en sitio cuando hace falta, con el mismo equipo que construyó la app.',
      ],
    },
    useCases: [
      {
        icon: 'Tablet',
        title: 'App de operación para personal en movimiento',
        description:
          'Housekeeping, mantenimiento, embarque o inventario desde el teléfono, con captura sin conexión y sincronización al volver a tener señal.',
      },
      {
        icon: 'PlaneTakeoff',
        title: 'App bilingüe para clientes recurrentes',
        description:
          'Cuando hay membresía, club o cliente que vuelve, la app de tienda se justifica: reservas, avisos y beneficios en español e inglés.',
      },
      {
        icon: 'ShieldCheck',
        title: 'Publicación en tiendas a nombre de tu empresa',
        description:
          'Cuentas de desarrollador, ficha, política de privacidad y respuesta a la revisión, con todo quedando bajo el control del cliente.',
      },
      {
        icon: 'Wrench',
        title: 'Mantenimiento con soporte en sitio',
        description:
          'Actualizaciones por cambios de iOS y Android, monitoreo y atención presencial cuando un incidente en temporada no puede esperar.',
      },
    ],
    faq: [
      {
        q: '¿Conviene una app móvil para huéspedes o visitantes en Puerto Vallarta?',
        a: 'Solo si hay recurrencia. Pedir una descarga para una estancia de pocos días es una barrera alta; con membresía, club o cliente que regresa, la app se justifica. Cuando no la hay, suele rendir más una experiencia web y reservar la inversión móvil para el personal.',
      },
      {
        q: '¿Cómo prueban que la app aguanta un turno completo?',
        a: 'Midiendo consumo de batería y comportamiento en los dispositivos reales del cliente, no en simulador, con el uso que tendrá en operación: cámara, escaneo y ubicación durante horas. También se define la versión mínima de sistema operativo soportada desde el inicio.',
      },
      {
        q: '¿Quién queda como dueño de las cuentas de App Store y Google Play?',
        a: 'Tu empresa. Las cuentas de desarrollador se abren con tus datos y quedan bajo tu control, igual que el repositorio y la infraestructura. Si un proveedor propone lo contrario, la app publicada y sus reseñas dejan de ser tuyas en la práctica.',
      },
      {
        q: '¿Dan soporte presencial si la app falla en temporada alta?',
        a: 'Sí. Estamos en la ciudad y podemos ir cuando un incidente no puede esperar al siguiente día hábil. No todo se resuelve en sitio, pero poder revisar el problema en el equipo donde ocurre acorta mucho el diagnóstico.',
      },
      {
        q: '¿La app puede funcionar en una lancha o en un tour sin señal?',
        a: 'Sí, si se diseña para eso desde el principio: la información necesaria se descarga antes de salir, la captura se guarda en el dispositivo y todo sincroniza al volver a puerto, con reglas para resolver conflictos si dos personas registraron lo mismo.',
      },
    ],
    externalSources: [
      { label: 'Gobierno de Puerto Vallarta', href: 'https://www.puertovallarta.gob.mx/' },
      { label: 'SEDECO Jalisco — Secretaría de Desarrollo Económico', href: 'https://sedeco.jalisco.gob.mx/' },
    ],
    relatedSlugs: [
      'desarrollo-de-aplicaciones-moviles',
      'desarrolladores-de-apps-puerto-vallarta',
      'desarrollo-de-app-puerto-vallarta',
      'desarrolladores-de-app-puerto-vallarta',
      'software-a-medida-para-empresas-puerto-vallarta',
    ],
    hub: 'ecosistemas-web',
    city: PUERTO_VALLARTA,
    ctaHref: '/contact',
    ctaVerb: 'desarrollar tu aplicación móvil en Puerto Vallarta',
  },
];
