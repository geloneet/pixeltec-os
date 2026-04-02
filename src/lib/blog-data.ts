export interface Post {
  id: string;
  slug: string;
  title: string;
  category: 'Desarrollo Web' | 'Automatización' | 'Inteligencia Artificial' | 'Consultoría' | 'Transformación Digital' | 'Rendimiento Web' | 'Arquitectura de Software';
  date: string;
  readTime: string;
  imageId: string;
  author: string;
  role: string;
  excerpt: string;
  content: string;
}

export const blogPosts: Post[] = [
  {
    id: '1',
    slug: 'escalabilidad-en-la-nube-con-nextjs-y-firebase',
    title: 'Escalabilidad en la Nube con Next.js y Firebase',
    category: 'Desarrollo Web',
    date: '25 Febrero, 2026',
    readTime: '9 min de lectura',
    imageId: 'blog-figma-nextjs', // Re-using an existing relevant image
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Analizamos cómo la combinación de Next.js para el frontend y Firebase para el backend permite crear arquitecturas serverless que escalan automáticamente.',
    content: `En el competitivo ecosistema digital actual, la capacidad de una aplicación para manejar picos de tráfico sin degradar el rendimiento es crucial. La arquitectura monolítica tradicional a menudo enfrenta desafíos de escalabilidad y altos costos de mantenimiento. Aquí es donde una arquitectura serverless, combinando el poder de Next.js en el frontend y los servicios gestionados de Firebase en el backend, se convierte en un cambio de juego.

Next.js, con su renderizado híbrido (SSR, SSG, ISR), permite entregar contenido estático ultrarrápido desde una CDN global, mientras que las partes dinámicas de la aplicación se renderizan en el servidor solo cuando es necesario. Esto reduce drásticamente la carga en el servidor de origen. Al combinar esto con Firebase (específicamente Firestore para la base de datos en tiempo real y Cloud Functions para la lógica de backend), se obtiene un sistema que escala de cero a millones de usuarios de forma automática. El modelo de precios de pago por uso de Firebase asegura que solo pagues por los recursos que consumes, optimizando los costos operativos de manera significativa.`
  },
  {
    id: '2',
    slug: 'automatizacion-de-procesos-logisticos-con-python-y-apis',
    title: 'Automatización de Procesos Logísticos con Python y APIs',
    category: 'Automatización',
    date: '18 Febrero, 2026',
    readTime: '7 min de lectura',
    imageId: 'blog-automation', // Re-using an existing relevant image
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Descubre cómo scripts de Python pueden actuar como "pegamento digital" para conectar sistemas de inventario, proveedores y facturación, eliminando errores manuales.',
    content: `La logística es el corazón de muchas empresas, pero también es un área propensa a errores manuales y procesos repetitivos que consumen tiempo valioso. La sincronización del inventario entre el e-commerce y el almacén, la generación de guías de envío o la notificación a proveedores son tareas que pueden y deben ser automatizadas. Python, gracias a su simplicidad y su vasto ecosistema de librerías, es la herramienta perfecta para esta tarea.

Utilizando librerías como 'requests' para comunicarnos con las APIs de transportistas (ej. FedEx, DHL), 'pandas' para procesar archivos CSV de inventario y 'smtplib' para enviar notificaciones por correo, podemos construir un "pegamento digital" robusto. Un script puede, por ejemplo, ejecutarse cada 15 minutos, leer las nuevas órdenes de una base de datos, consultar la API del transportista para cotizar y generar una guía, actualizar el estado del pedido y notificar al cliente, todo sin intervención humana. Este nivel de automatización no solo reduce costos y errores, sino que libera al equipo para que se enfoque en tareas de mayor valor estratégico.`
  },
  {
    id: '3',
    slug: 'agentes-ia-soporte-b2b',
    title: 'Integración de Agentes de IA para Soporte B2B 24/7',
    category: 'Inteligencia Artificial',
    date: '12 Febrero, 2026',
    readTime: '8 min de lectura',
    imageId: 'blog-ai-agents',
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Exploramos la arquitectura detrás de agentes inteligentes avanzados y cómo integrarlos en tus flujos de trabajo para reducir costos operativos sin perder el toque humano.',
    content: 'Exploramos la arquitectura detrás de agentes inteligentes avanzados y cómo integrarlos en tus flujos de trabajo para reducir costos operativos sin perder el toque humano. La clave está en usar modelos de lenguaje (LLMs) entrenados con la base de conocimiento de tu empresa, permitiéndoles responder preguntas complejas y escalar conversaciones con una precisión casi humana, reservando a los agentes humanos solo para los casos más críticos.'
  },
  {
    id: '4',
    slug: 'de-excel-a-saas-roi',
    title: 'De Excel a SaaS: El ROI oculto de digitalizar tu operación',
    category: 'Transformación Digital',
    date: '05 Febrero, 2026',
    readTime: '10 min de lectura',
    imageId: 'blog-saas-roi',
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Analizamos el costo real de mantener procesos manuales obsoletos y cómo una migración estructurada a un ecosistema web a medida multiplica la rentabilidad y el control.',
    content: 'Analizamos el costo real de mantener procesos manuales obsoletos y cómo una migración estructurada a un ecosistema web a medida multiplica la rentabilidad y el control. Más allá de eliminar errores, la centralización de datos en una plataforma SaaS propia abre la puerta a análisis predictivos, automatización de reportes y una visión 360° del negocio que es imposible de lograr con hojas de cálculo dispersas.'
  },
  {
    id: '5',
    slug: 'optimizacion-extrema-nextjs',
    title: 'Optimización Extrema: Next.js y el impacto en tus ventas',
    category: 'Rendimiento Web',
    date: '28 Enero, 2026',
    readTime: '6 min de lectura',
    imageId: 'blog-nextjs-perf',
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Por qué lograr métricas perfectas en Core Web Vitals no es solo una cuestión técnica de código, sino una estrategia de negocio directa para aumentar tus tasas de conversión.',
    content: 'Por qué lograr métricas perfectas en Core Web Vitals no es solo una cuestión técnica de código, sino una estrategia de negocio directa para aumentar tus tasas de conversión. Cada milisegundo de mejora en el tiempo de carga se correlaciona directamente con una menor tasa de rebote y un aumento en las ventas. En este artículo, desglosamos técnicas avanzadas en Next.js, como la optimización de imágenes, el code-splitting y el renderizado híbrido, para llevar el rendimiento al límite.'
  },
  {
    id: '6',
    slug: 'arquitecturas-multi-tenant',
    title: 'Arquitecturas Multi-Tenant: El secreto de un SaaS escalable',
    category: 'Arquitectura de Software',
    date: '21 Enero, 2026',
    readTime: '12 min de lectura',
    imageId: 'blog-multi-tenant',
    author: 'Miguel Robles',
    role: 'PixelTec Team',
    excerpt: 'Profundizamos en los modelos de aislamiento de datos y seguridad en bases de datos NoSQL para construir plataformas multi-cliente sin comprometer el rendimiento.',
    content: 'Profundizamos en los modelos de aislamiento de datos y seguridad en bases de datos NoSQL para construir plataformas multi-cliente sin comprometer el rendimiento. Abordamos estrategias como el aislamiento por esquema, por base de datos o a nivel de aplicación con discriminadores, analizando las ventajas y desventajas de cada uno en términos de costo, seguridad y complejidad de implementación, especialmente en entornos como Firebase Firestore.'
  }
];
