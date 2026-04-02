/**
 * @fileoverview PixelTEC OS — Demo Data Seeder
 *
 * Simulates a real 9-month-old digital agency operation.
 * Used by both the CLI script and the in-app admin seed panel.
 *
 * Safety: checks for existing data before inserting anything.
 */

import {
  Firestore,
  collection,
  doc,
  setDoc,
  addDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  Timestamp,
  limit,
  query,
} from 'firebase/firestore';

// ─── Timestamp helpers ────────────────────────────────────────────────────────

const ts = (date: Date) => Timestamp.fromDate(date);

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const monthsAgo = (n: number, dayOffset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(d.getDate() - dayOffset);
  return d;
};

// ─── Progress reporting ───────────────────────────────────────────────────────

export interface SeedProgress {
  step: string;
  done: number;
  total: number;
}

export type ProgressCallback = (p: SeedProgress) => void;

// ─── Client Definitions ───────────────────────────────────────────────────────

interface ClientSeed {
  companyName: string;
  contactName: string;
  contactEmail: string;
  whatsapp: string;
  website: string;
  techStack: string[];
  services: string[];
  status: 'Activo' | 'Inactivo' | 'Lead';
  clientValue: number;
  assignedTo: 'Miguel' | 'Asistente';
  location: string;
  initialNotes: string;
  color: string;
  tasks: { title: string; completed: boolean; daysAgoCreated: number }[];
  notes: { content: string; daysAgoCreated: number }[];
}

const CLIENT_DEFINITIONS: ClientSeed[] = [
  {
    companyName: 'Velank Boutique',
    contactName: 'Ana Ramírez',
    contactEmail: 'ana@velankboutique.mx',
    whatsapp: '+52 33 1234 5678',
    website: 'https://velankboutique.mx',
    techStack: ['Next.js', 'Tailwind CSS', 'Firebase'],
    services: ['Página web', 'Marketing digital'],
    status: 'Activo',
    clientValue: 85000,
    assignedTo: 'Miguel',
    location: 'Guadalajara',
    color: '#f472b6',
    initialNotes: 'E-commerce de moda femenina. Requiere integración con Shopify y campaña de redes sociales mensual.',
    tasks: [
      { title: 'Integrar carrito de compras con Stripe', completed: true,  daysAgoCreated: 45 },
      { title: 'Optimizar imágenes del catálogo (WebP)',  completed: true,  daysAgoCreated: 30 },
      { title: 'Configurar Google Analytics 4',           completed: true,  daysAgoCreated: 20 },
      { title: 'Crear landing page de temporada otoño',   completed: false, daysAgoCreated: 10 },
      { title: 'Subir colección nueva al catálogo',       completed: false, daysAgoCreated: 3  },
    ],
    notes: [
      { content: 'Ana mencionó que quieren lanzar una app móvil para Q1 2025. Agendar reunión de alcance técnico.', daysAgoCreated: 5 },
      { content: 'Se aprobó presupuesto adicional de $15k para campaña de temporada navideña.', daysAgoCreated: 12 },
    ],
  },
  {
    companyName: 'Pipas Tondoroque',
    contactName: 'Carlos Tondoroque',
    contactEmail: 'ctondoroque@pipasbistro.mx',
    whatsapp: '+52 322 987 6543',
    website: 'https://pipasbistro.mx',
    techStack: ['Next.js', 'Firebase'],
    services: ['Página web', 'Automatización'],
    status: 'Activo',
    clientValue: 120000,
    assignedTo: 'Miguel',
    location: 'Puerto Vallarta',
    color: '#fb923c',
    initialNotes: 'Cadena de restaurantes con 3 sucursales. Necesitan sistema de reservas online y automatización de confirmaciones por WhatsApp.',
    tasks: [
      { title: 'Implementar sistema de reservas online',         completed: true,  daysAgoCreated: 60 },
      { title: 'Bot de WhatsApp para confirmación de reservas',  completed: true,  daysAgoCreated: 45 },
      { title: 'Dashboard de reportes de ventas diarias',        completed: true,  daysAgoCreated: 30 },
      { title: 'Módulo de menú digital con QR',                  completed: true,  daysAgoCreated: 20 },
      { title: 'Integrar sistema de pagos en línea',             completed: false, daysAgoCreated: 8  },
      { title: 'Capacitación al personal en el nuevo sistema',   completed: false, daysAgoCreated: 2  },
    ],
    notes: [
      { content: 'Carlos quiere expandir el sistema a su 4ta sucursal en Sayulita. Requiere licencia adicional.', daysAgoCreated: 3 },
      { content: 'El bot de WhatsApp está reduciendo no-shows en un 40%. Cliente muy satisfecho.', daysAgoCreated: 18 },
      { content: 'Solicitan integración con Uber Eats y Rappi para Q4.', daysAgoCreated: 25 },
    ],
  },
  {
    companyName: 'Smile More Dental',
    contactName: 'Dra. Laura Mendoza',
    contactEmail: 'laura@smilemore.mx',
    whatsapp: '+52 55 3456 7890',
    website: 'https://smilemore.mx',
    techStack: ['Next.js', 'Tailwind CSS'],
    services: ['Página web', 'Marketing digital'],
    status: 'Activo',
    clientValue: 65000,
    assignedTo: 'Asistente',
    location: 'Ciudad de México',
    color: '#34d399',
    initialNotes: 'Clínica dental premium en CDMX. Enfoque en SEO local y captación de nuevos pacientes por redes sociales.',
    tasks: [
      { title: 'Rediseño del sitio web con nuevo branding',        completed: true,  daysAgoCreated: 90 },
      { title: 'SEO on-page: optimizar 10 páginas principales',    completed: true,  daysAgoCreated: 75 },
      { title: 'Configurar Google My Business y reseñas',          completed: true,  daysAgoCreated: 60 },
      { title: 'Crear 4 posts para Instagram del mes de noviembre', completed: false, daysAgoCreated: 5 },
      { title: 'Reporte mensual de métricas SEO',                  completed: false, daysAgoCreated: 1 },
    ],
    notes: [
      { content: 'Solicitan agregar sección de blog para mejorar posicionamiento orgánico.', daysAgoCreated: 7 },
    ],
  },
  {
    companyName: 'Torres & Asociados',
    contactName: 'Lic. Roberto Torres',
    contactEmail: 'rtorres@torresasociados.mx',
    whatsapp: '+52 81 2345 6789',
    website: 'https://torresasociados.mx',
    techStack: ['Next.js', 'Firebase'],
    services: ['Página web', 'Soporte técnico'],
    status: 'Activo',
    clientValue: 95000,
    assignedTo: 'Miguel',
    location: 'Monterrey',
    color: '#818cf8',
    initialNotes: 'Despacho legal corporativo. Página institucional de alto perfil + sistema interno de gestión de expedientes.',
    tasks: [
      { title: 'Portal de clientes con acceso a expedientes',  completed: true,  daysAgoCreated: 120 },
      { title: 'Sistema de firma digital de contratos',         completed: true,  daysAgoCreated: 90  },
      { title: 'Migración de datos del sistema anterior',       completed: true,  daysAgoCreated: 75  },
      { title: 'Capacitación equipo jurídico (8 personas)',     completed: true,  daysAgoCreated: 60  },
      { title: 'Módulo de facturación electrónica CFDI',        completed: false, daysAgoCreated: 15  },
      { title: 'Backup automático diario en la nube',           completed: false, daysAgoCreated: 4   },
      { title: 'Revisión de seguridad trimestral',              completed: false, daysAgoCreated: 1   },
    ],
    notes: [
      { content: 'Roberto solicitó agregar módulo de agenda con recordatorios para audiencias. Presupuestar.', daysAgoCreated: 9 },
      { content: 'El portal de clientes fue bien recibido. Quieren agregar 2 usuarios más al plan.', daysAgoCreated: 22 },
    ],
  },
  {
    companyName: 'NovaTech Solutions',
    contactName: 'Diego Herrera',
    contactEmail: 'diego@novatech.io',
    whatsapp: '+52 33 8765 4321',
    website: 'https://novatech.io',
    techStack: ['Next.js', 'Firebase', 'Python'],
    services: ['Automatización', 'Soporte técnico'],
    status: 'Activo',
    clientValue: 150000,
    assignedTo: 'Miguel',
    location: 'Guadalajara',
    color: '#22d3ee',
    initialNotes: 'Startup de software B2B. Necesitan automatización de procesos internos y dashboards de analytics para su producto.',
    tasks: [
      { title: 'Pipeline de datos ETL con Python',                 completed: true,  daysAgoCreated: 50 },
      { title: 'Dashboard de métricas en tiempo real',             completed: true,  daysAgoCreated: 35 },
      { title: 'API de integración con Salesforce',                completed: false, daysAgoCreated: 20 },
      { title: 'Automatizar reportes semanales via email',         completed: false, daysAgoCreated: 12 },
      { title: 'Documentación técnica de la API',                  completed: false, daysAgoCreated: 3  },
    ],
    notes: [
      { content: 'Diego necesita la integración con Salesforce lista para el 15. Es bloqueante para su demo con inversores.', daysAgoCreated: 2 },
      { content: 'Aprobaron presupuesto extra de $50k para fase 2 del proyecto de automatización.', daysAgoCreated: 10 },
    ],
  },
  {
    companyName: 'Horizonte Inmobiliario',
    contactName: 'Fernanda Castro',
    contactEmail: 'fcastro@horizonteinmob.mx',
    whatsapp: '+52 998 456 7890',
    website: 'https://horizonteinmob.mx',
    techStack: ['Next.js', 'Tailwind CSS'],
    services: ['Página web', 'Marketing digital'],
    status: 'Activo',
    clientValue: 75000,
    assignedTo: 'Asistente',
    location: 'Cancún',
    color: '#a78bfa',
    initialNotes: 'Inmobiliaria en zona turística. Página de propiedades con filtros avanzados y formularios de contacto.',
    tasks: [
      { title: 'Listado de propiedades con filtros de búsqueda', completed: true,  daysAgoCreated: 40 },
      { title: 'Formularios de contacto y visitas',              completed: true,  daysAgoCreated: 28 },
      { title: 'Integración con MLS inmobiliario',               completed: false, daysAgoCreated: 14 },
      { title: 'Tour virtual 360° para propiedades premium',     completed: false, daysAgoCreated: 5  },
    ],
    notes: [
      { content: 'Fernanda quiere agregar chat en vivo en la página. Evaluar Intercom vs Tidio.', daysAgoCreated: 6 },
    ],
  },
  {
    companyName: 'Café Montaña Verde',
    contactName: 'Manuel Suárez',
    contactEmail: 'manuel@montanaverde.mx',
    whatsapp: '+52 951 234 5678',
    website: 'https://montanaverde.mx',
    techStack: ['Next.js'],
    services: ['Página web'],
    status: 'Inactivo',
    clientValue: 25000,
    assignedTo: 'Asistente',
    location: 'Oaxaca',
    color: '#6b7280',
    initialNotes: 'Cafetería artesanal. Proyecto completado. Contrato mensual no renovado. Posible retoma en enero.',
    tasks: [
      { title: 'Página web con menú y ubicación', completed: true, daysAgoCreated: 180 },
      { title: 'Sección de tienda online de café',  completed: true, daysAgoCreated: 160 },
      { title: 'Manual de actualización de contenido', completed: true, daysAgoCreated: 140 },
    ],
    notes: [
      { content: 'Manuel indicó que pausan el proyecto por temporada baja. Contactar en enero para renovar contrato.', daysAgoCreated: 45 },
    ],
  },
  {
    companyName: 'FitLife Gym',
    contactName: 'Andrea Villanueva',
    contactEmail: 'andrea@fitlifegym.mx',
    whatsapp: '+52 55 9876 5432',
    website: 'https://fitlifegym.mx',
    techStack: ['Next.js', 'Firebase', 'Tailwind CSS'],
    services: ['Página web', 'Automatización'],
    status: 'Activo',
    clientValue: 55000,
    assignedTo: 'Miguel',
    location: 'Ciudad de México',
    color: '#f87171',
    initialNotes: 'Cadena de 2 gimnasios. Sistema de membresías, control de acceso y clases en línea.',
    tasks: [
      { title: 'Sistema de membresías con pagos recurrentes', completed: true,  daysAgoCreated: 70 },
      { title: 'Control de asistencia con QR',                completed: true,  daysAgoCreated: 55 },
      { title: 'Módulo de clases en línea (Zoom embebido)',   completed: false, daysAgoCreated: 18 },
      { title: 'App móvil para ver rutinas',                  completed: false, daysAgoCreated: 6  },
    ],
    notes: [
      { content: 'Andrea quiere lanzar clases en línea para enero. Confirmar integración con Zoom.', daysAgoCreated: 4 },
      { content: 'Sistema de membresías procesó $85k en diciembre. Cliente muy satisfecho con el ROI.', daysAgoCreated: 15 },
    ],
  },
  {
    companyName: 'Constructora Arco',
    contactName: 'Ing. Luis Armenta',
    contactEmail: 'larmenta@constructoraarco.mx',
    whatsapp: '+52 81 5678 9012',
    website: 'https://constructoraarco.mx',
    techStack: ['Next.js'],
    services: ['Página web', 'Soporte técnico'],
    status: 'Activo',
    clientValue: 40000,
    assignedTo: 'Asistente',
    location: 'Monterrey',
    color: '#fbbf24',
    initialNotes: 'Constructora mediana. Página corporativa con portafolio de obras y cotizador en línea.',
    tasks: [
      { title: 'Portafolio de proyectos con galería',     completed: true,  daysAgoCreated: 80 },
      { title: 'Formulario de cotización en línea',        completed: true,  daysAgoCreated: 65 },
      { title: 'Actualizar 8 proyectos en el portafolio', completed: false, daysAgoCreated: 7  },
    ],
    notes: [
      { content: 'Luis solicita que actualicemos el portafolio con los proyectos de 2024 antes de fin de mes.', daysAgoCreated: 3 },
    ],
  },
  {
    companyName: 'MarketMind Agency',
    contactName: 'Sofía Guerrero',
    contactEmail: 'sofia@marketmind.mx',
    whatsapp: '+52 55 1122 3344',
    website: 'https://marketmind.mx',
    techStack: ['Next.js', 'Python', 'Firebase'],
    services: ['Automatización', 'Marketing digital'],
    status: 'Activo',
    clientValue: 200000,
    assignedTo: 'Miguel',
    location: 'Ciudad de México',
    color: '#a3e635',
    initialNotes: 'Agencia de marketing digital. Son partner estratégico — nos refieren clientes. Requieren stack completo de automatización.',
    tasks: [
      { title: 'Plataforma de reportes multi-cliente',         completed: true,  daysAgoCreated: 100 },
      { title: 'Automatización de publicación en redes',        completed: true,  daysAgoCreated: 80  },
      { title: 'Integración con Meta Ads API',                  completed: true,  daysAgoCreated: 60  },
      { title: 'Integración con Google Ads API',                completed: false, daysAgoCreated: 25  },
      { title: 'Dashboard de ROI por campaña',                  completed: false, daysAgoCreated: 10  },
      { title: 'Módulo de generación de reportes PDF',          completed: false, daysAgoCreated: 4   },
      { title: 'Capacitación avanzada al equipo (6 personas)',  completed: false, daysAgoCreated: 1   },
      { title: 'Documentación de integraciones',               completed: false, daysAgoCreated: 0   },
    ],
    notes: [
      { content: 'Sofía confirmó que nos referirán a Banco Azteca si entregamos la integración con Google Ads a tiempo.', daysAgoCreated: 1 },
      { content: 'Presupuesto aprobado para fase 3: $80k adicionales. Formalizar con contrato.', daysAgoCreated: 8 },
      { content: 'Reunión trimestral exitosa. Quieren escalar el plan a Enterprise.', daysAgoCreated: 30 },
    ],
  },
];

// ─── Global Tasks ─────────────────────────────────────────────────────────────

const GLOBAL_TASKS = [
  { title: 'Renovar certificado SSL del servidor de staging',    responsible: 'Miguel',    status: 'Completada', daysAgoCreated: 20, daysUntilDue: -5  },
  { title: 'Actualizar dependencias npm en proyectos activos',   responsible: 'Miguel',    status: 'En proceso', daysAgoCreated: 10, daysUntilDue: 3   },
  { title: 'Revisar alertas de seguridad de Firestore',          responsible: 'Miguel',    status: 'Pendiente',  daysAgoCreated: 5,  daysUntilDue: -2  },
  { title: 'Presentación de propuesta Q1 2025',                  responsible: 'Miguel',    status: 'En proceso', daysAgoCreated: 8,  daysUntilDue: 7   },
  { title: 'Facturar clientes del mes de noviembre',             responsible: 'Asistente', status: 'Completada', daysAgoCreated: 15, daysUntilDue: -3  },
  { title: 'Reunión de kickoff NovaTech — Fase 3',               responsible: 'Miguel',    status: 'Pendiente',  daysAgoCreated: 2,  daysUntilDue: 5   },
  { title: 'Documentar arquitectura de APIs internas',           responsible: 'Miguel',    status: 'Pendiente',  daysAgoCreated: 7,  daysUntilDue: 14  },
  { title: 'Configurar alertas de monitoreo en producción',      responsible: 'Miguel',    status: 'Pendiente',  daysAgoCreated: 3,  daysUntilDue: -1  },
  { title: 'Hacer backup de bases de datos de todos los clientes', responsible: 'Asistente', status: 'Completada', daysAgoCreated: 30, daysUntilDue: -25 },
  { title: 'Preparar propuesta para lead Banco Azteca',          responsible: 'Miguel',    status: 'En proceso', daysAgoCreated: 1,  daysUntilDue: 4   },
  { title: 'Auditoría de Firestore rules en proyectos activos',  responsible: 'Miguel',    status: 'Pendiente',  daysAgoCreated: 4,  daysUntilDue: -3  },
  { title: 'Actualizar plantilla de contratos con cláusula CFDI', responsible: 'Asistente', status: 'Pendiente', daysAgoCreated: 6,  daysUntilDue: 2   },
  { title: 'Grabar demos de funcionalidades para NovaTech',      responsible: 'Miguel',    status: 'En proceso', daysAgoCreated: 3,  daysUntilDue: 6   },
  { title: 'Cobrar facturas pendientes de Velank y FitLife',     responsible: 'Asistente', status: 'Pendiente',  daysAgoCreated: 2,  daysUntilDue: -1  },
  { title: 'Revisar y responder tickets críticos de soporte',    responsible: 'Miguel',    status: 'Completada', daysAgoCreated: 1,  daysUntilDue: 0   },
] as const;

// ─── Leads ────────────────────────────────────────────────────────────────────

const LEADS_DATA = [
  { companyName: 'Banco Azteca Digital',    contactName: 'Mtro. Alejandro Ríos',    stage: 'Negociación',       estimatedValue: 480000, closeProbability: 70, interestedService: 'Automatización + Dashboard Analytics',  notes: 'Referido por MarketMind. Proceso de compra largo por ser banco.', daysAgo: 8  },
  { companyName: 'Clínica Bienestar Total', contactName: 'Dr. Ernesto Vega',        stage: 'Propuesta enviada', estimatedValue: 95000,  closeProbability: 55, interestedService: 'Página web + Sistema de citas',           notes: 'Interesados en automatización de citas médicas por WhatsApp.',   daysAgo: 15 },
  { companyName: 'Inmobiliaria Pacífico',   contactName: 'Jorge Salinas',           stage: 'Reunión agendada',  estimatedValue: 120000, closeProbability: 40, interestedService: 'Plataforma de propiedades',              notes: 'Reunión el martes a las 10am. Llevar caso de éxito de Horizonte.', daysAgo: 5 },
  { companyName: 'Restaurante El Fogón',    contactName: 'Patricia Lozano',         stage: 'Contactado',        estimatedValue: 45000,  closeProbability: 30, interestedService: 'Página web + Reservas online',            notes: 'Conocen a Pipas Tondoroque. Quieren algo similar.',             daysAgo: 20 },
  { companyName: 'Farmacias MediPlus',      contactName: 'Ing. Samuel Ortega',      stage: 'Lead nuevo',        estimatedValue: 250000, closeProbability: 20, interestedService: 'E-commerce + Automatización de inventario', notes: 'Llenó formulario desde web. Pendiente primer contacto.',       daysAgo: 2  },
  { companyName: 'Estudio Jurídico Rojas',  contactName: 'Lic. Carmen Rojas',       stage: 'Contactado',        estimatedValue: 75000,  closeProbability: 35, interestedService: 'Página web + Portal de clientes',          notes: 'Compiten con Torres & Asociados. No mencionarlo.',             daysAgo: 12 },
  { companyName: 'Tech Academy MX',         contactName: 'Ramón Castellanos',       stage: 'Propuesta enviada', estimatedValue: 180000, closeProbability: 60, interestedService: 'Plataforma de cursos online (LMS)',        notes: 'Urgente — tienen 500 alumnos esperando la plataforma.',        daysAgo: 18 },
  { companyName: 'Grupo Hotelero Bahía',    contactName: 'Gabriela Montes',         stage: 'Lead nuevo',        estimatedValue: 320000, closeProbability: 15, interestedService: 'Sistema de reservas + Marketing digital',   notes: 'Conocieron el trabajo en Horizonte Inmobiliario.',             daysAgo: 1  },
  { companyName: 'AutoPartes Norteño',      contactName: 'Eduardo Carranza',        stage: 'Ganado',            estimatedValue: 65000,  closeProbability: 100, interestedService: 'Catálogo digital + cotizador online',      notes: '¡Cerrado! Inicio de proyecto el 15 de enero.',                daysAgo: 25 },
  { companyName: 'Spa Tranquilidad',        contactName: 'Valeria Medina',          stage: 'Ganado',            estimatedValue: 38000,  closeProbability: 100, interestedService: 'Página web + Sistema de citas',           notes: '¡Cerrado! Proyecto pequeño pero referido estratégico.',        daysAgo: 30 },
  { companyName: 'Logística RapidMax',      contactName: 'Héctor Fuentes',          stage: 'Perdido',           estimatedValue: 200000, closeProbability: 0,  interestedService: 'Sistema de tracking en tiempo real',        notes: 'Eligieron a una empresa local. Precio fue factor determinante.', daysAgo: 40 },
  { companyName: 'Tienda Naturista Vida',   contactName: 'Isabel Bravo',            stage: 'Perdido',           estimatedValue: 30000,  closeProbability: 0,  interestedService: 'E-commerce básico',                        notes: 'Sin presupuesto. Decidieron usar Wix gratuito.',               daysAgo: 55 },
] as const;

// ─── Finance Transactions ─────────────────────────────────────────────────────

// Will be generated dynamically once we have client IDs
const getFinanceData = (clientMap: Record<string, string>) => {
  // clientMap: { 'NombreCliente': 'firestoreId', ... }
  const entries = [
    // ── Month 5 ago ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual nov',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 5, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual nov',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 5, dayOfMonth: 2  },
    { clientName: 'MarketMind Agency',   projectName: 'Fase 1 — Plataforma multi',  amount: 45000, type: 'Único',   status: 'Pagado',   method: 'Transferencia', monthsBack: 5, dayOfMonth: 5  },
    { clientName: 'Velank Boutique',     projectName: 'Retainer mensual nov',       amount: 9500,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 5, dayOfMonth: 3  },
    { clientName: 'Torres & Asociados',  projectName: 'Retainer mensual nov',       amount: 11000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 5, dayOfMonth: 4  },
    // ── Month 4 ago ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual dic',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 4, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual dic',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 4, dayOfMonth: 2  },
    { clientName: 'Velank Boutique',     projectName: 'Retainer mensual dic',       amount: 9500,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 4, dayOfMonth: 3  },
    { clientName: 'Torres & Asociados',  projectName: 'Módulo firma digital',       amount: 22000, type: 'Único',   status: 'Pagado',   method: 'Transferencia', monthsBack: 4, dayOfMonth: 10 },
    { clientName: 'Smile More Dental',   projectName: 'Retainer mensual dic',       amount: 7000,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 4, dayOfMonth: 5  },
    // ── Month 3 ago ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual ene',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 3, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual ene',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 3, dayOfMonth: 2  },
    { clientName: 'MarketMind Agency',   projectName: 'Fase 2 — Integraciones',    amount: 38000, type: 'Único',   status: 'Pagado',   method: 'Transferencia', monthsBack: 3, dayOfMonth: 8  },
    { clientName: 'Velank Boutique',     projectName: 'Retainer mensual ene',       amount: 9500,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 3, dayOfMonth: 3  },
    { clientName: 'FitLife Gym',         projectName: 'Desarrollo sistema membresías', amount: 28000, type: 'Único', status: 'Pagado', method: 'Transferencia', monthsBack: 3, dayOfMonth: 15 },
    // ── Month 2 ago ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual feb',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 2, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual feb',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 2, dayOfMonth: 2  },
    { clientName: 'Torres & Asociados',  projectName: 'Retainer mensual feb',       amount: 11000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 2, dayOfMonth: 4  },
    { clientName: 'Smile More Dental',   projectName: 'Retainer mensual feb',       amount: 7000,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 2, dayOfMonth: 5  },
    { clientName: 'Horizonte Inmobiliario', projectName: 'Diseño y desarrollo web', amount: 35000, type: 'Único',  status: 'Pagado',   method: 'Transferencia', monthsBack: 2, dayOfMonth: 12 },
    // ── Month 1 ago ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual mar',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 1, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual mar',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 1, dayOfMonth: 2  },
    { clientName: 'MarketMind Agency',   projectName: 'Retainer mensual mar',       amount: 22000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 1, dayOfMonth: 3  },
    { clientName: 'Velank Boutique',     projectName: 'Retainer mensual mar',       amount: 9500,  type: 'Mensual', status: 'Pagado',   method: 'Stripe',        monthsBack: 1, dayOfMonth: 3  },
    { clientName: 'FitLife Gym',         projectName: 'Retainer mensual mar',       amount: 6000,  type: 'Mensual', status: 'Pagado',   method: 'MercadoPago',   monthsBack: 1, dayOfMonth: 5  },
    // ── Current month (mix Pagado / Pendiente) ──
    { clientName: 'Pipas Tondoroque',    projectName: 'Retainer mensual abr',       amount: 12000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 0, dayOfMonth: 1  },
    { clientName: 'NovaTech Solutions',  projectName: 'Retainer mensual abr',       amount: 18000, type: 'Mensual', status: 'Pagado',   method: 'Transferencia', monthsBack: 0, dayOfMonth: 2  },
    { clientName: 'MarketMind Agency',   projectName: 'Retainer mensual abr',       amount: 22000, type: 'Mensual', status: 'Pendiente', method: 'Transferencia', monthsBack: 0, dayOfMonth: 3 },
    { clientName: 'Velank Boutique',     projectName: 'Retainer mensual abr',       amount: 9500,  type: 'Mensual', status: 'Pendiente', method: 'Stripe',        monthsBack: 0, dayOfMonth: 3 },
    { clientName: 'Torres & Asociados',  projectName: 'Retainer mensual abr',       amount: 11000, type: 'Mensual', status: 'Pendiente', method: 'Transferencia', monthsBack: 0, dayOfMonth: 4 },
    { clientName: 'Smile More Dental',   projectName: 'Retainer mensual abr',       amount: 7000,  type: 'Mensual', status: 'Pendiente', method: 'Stripe',        monthsBack: 0, dayOfMonth: 5 },
    { clientName: 'FitLife Gym',         projectName: 'Retainer mensual abr',       amount: 6000,  type: 'Mensual', status: 'Pendiente', method: 'MercadoPago',   monthsBack: 0, dayOfMonth: 5 },
    { clientName: 'NovaTech Solutions',  projectName: 'Módulo Salesforce integration', amount: 32000, type: 'Único', status: 'Pendiente', method: 'Transferencia', monthsBack: 0, dayOfMonth: 10},
  ];

  return entries.map(e => {
    const d = new Date();
    d.setMonth(d.getMonth() - e.monthsBack);
    d.setDate(e.dayOfMonth);
    return {
      clientName: e.clientName,
      projectName: e.projectName,
      amount: e.amount,
      type: e.type,
      status: e.status,
      method: e.method,
      date: ts(d),
    };
  });
};

// ─── Tickets ──────────────────────────────────────────────────────────────────

const TICKETS_DATA = [
  { ticketId: 'TKT-001', cliente: 'NovaTech Solutions',    problema: 'La integración con Salesforce devuelve error 401 en producción',          categoría: 'Automatización', prioridad: 'Alta',  estado: 'Abierto',           daysAgoCreated: 2,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-002', cliente: 'Pipas Tondoroque',      problema: 'El bot de WhatsApp no envía confirmaciones después de las 10pm',          categoría: 'Automatización', prioridad: 'Alta',  estado: 'En proceso',        daysAgoCreated: 3,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-003', cliente: 'Velank Boutique',       problema: 'Página de checkout lenta en móviles (>6s de carga)',                      categoría: 'Página web',     prioridad: 'Alta',  estado: 'En proceso',        daysAgoCreated: 5,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-004', cliente: 'Torres & Asociados',    problema: 'El portal de clientes no carga en Safari iOS 17',                         categoría: 'Página web',     prioridad: 'Media', estado: 'Abierto',           daysAgoCreated: 4,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-005', cliente: 'Smile More Dental',     problema: 'Formulario de contacto no envía correos de confirmación al cliente',      categoría: 'Correo',         prioridad: 'Media', estado: 'Esperando cliente', daysAgoCreated: 7,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-006', cliente: 'FitLife Gym',           problema: 'Los pagos de MercadoPago no actualizan el estado de membresía en Firebase', categoría: 'Automatización', prioridad: 'Alta', estado: 'Abierto',           daysAgoCreated: 1,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-007', cliente: 'Horizonte Inmobiliario', problema: 'Las imágenes de propiedades no cargan desde Firebase Storage en LATAM',  categoría: 'Hosting',        prioridad: 'Media', estado: 'En proceso',        daysAgoCreated: 6,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-008', cliente: 'Constructora Arco',     problema: 'El cotizador en línea no guarda correctamente los datos del formulario',   categoría: 'Página web',     prioridad: 'Baja',  estado: 'Abierto',           daysAgoCreated: 8,  resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-009', cliente: 'MarketMind Agency',     problema: 'Tokens de acceso de Meta Ads expiran cada 60 días sin refresh automático', categoría: 'Automatización', prioridad: 'Alta',  estado: 'En proceso',        daysAgoCreated: 10, resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-010', cliente: 'NovaTech Solutions',    problema: 'Pipeline ETL falla silenciosamente cuando la API fuente devuelve 429',    categoría: 'Automatización', prioridad: 'Media', estado: 'Esperando cliente', daysAgoCreated: 12, resolvedDaysAgo: null, solucionAplicada: null },
  { ticketId: 'TKT-011', cliente: 'Velank Boutique',       problema: 'Correos de seguimiento de carrito abandonado van a spam',                 categoría: 'Correo',         prioridad: 'Media', estado: 'Resuelto',          daysAgoCreated: 20, resolvedDaysAgo: 5,    solucionAplicada: 'Configurado DKIM y SPF en dominio. Verificado en Mail-Tester con score 9/10.' },
  { ticketId: 'TKT-012', cliente: 'Pipas Tondoroque',      problema: 'Dashboard de reportes no filtra correctamente por sucursal',              categoría: 'Página web',     prioridad: 'Baja',  estado: 'Resuelto',          daysAgoCreated: 25, resolvedDaysAgo: 8,    solucionAplicada: 'Bug en query de Firestore corregido. Ahora filtra por campo sucursalId.' },
] as const;

// ─── Activity entries ─────────────────────────────────────────────────────────

const ACTIVITY_DATA = [
  { type: 'finance',  message: 'Pago recibido de Pipas Tondoroque — $12,000 MXN',                           link: '/dashboard/finance',  daysAgo: 0  },
  { type: 'finance',  message: 'Pago recibido de NovaTech Solutions — $18,000 MXN',                          link: '/dashboard/finance',  daysAgo: 1  },
  { type: 'support',  message: 'Nuevo ticket crítico #TKT-006: FitLife Gym — Pagos MercadoPago',             link: '/dashboard/support',  daysAgo: 1  },
  { type: 'project',  message: 'Tarea completada: "Integración con Meta Ads API" — MarketMind Agency',       link: '/dashboard/tasks',    daysAgo: 2  },
  { type: 'support',  message: 'Nuevo ticket #TKT-001: NovaTech Solutions — Salesforce 401 error',          link: '/dashboard/support',  daysAgo: 2  },
  { type: 'sale',     message: 'Lead cerrado: AutoPartes Norteño — $65,000 MXN ¡Ganado!',                   link: '/dashboard/pipeline', daysAgo: 3  },
  { type: 'project',  message: 'Tarea completada: "Bot WhatsApp para confirmaciones" — Pipas Tondoroque',    link: '/dashboard/tasks',    daysAgo: 4  },
  { type: 'finance',  message: 'Pago recibido de MarketMind Agency — $22,000 MXN (retainer)',                link: '/dashboard/finance',  daysAgo: 5  },
  { type: 'support',  message: 'Ticket #TKT-011 resuelto: correos de Velank Boutique ya no van a spam',      link: '/dashboard/support',  daysAgo: 5  },
  { type: 'sale',     message: 'Nuevo lead: Banco Azteca Digital — $480,000 MXN en negociación',             link: '/dashboard/pipeline', daysAgo: 8  },
  { type: 'project',  message: 'Tarea completada: "Dashboard de métricas en tiempo real" — NovaTech',        link: '/dashboard/tasks',    daysAgo: 9  },
  { type: 'finance',  message: 'Pago recibido de Horizonte Inmobiliario — $35,000 MXN (proyecto web)',       link: '/dashboard/finance',  daysAgo: 12 },
] as const;

// ─── Clear helper (used when force=true) ─────────────────────────────────────

const TOP_LEVEL_COLLECTIONS = ['tasks', 'leads', 'finances', 'tickets', 'activity'];

async function clearCollections(db: Firestore, onProgress?: ProgressCallback): Promise<void> {
  // Delete client subcollections first, then the client doc itself
  onProgress?.({ step: 'Limpiando clientes existentes...', done: 0, total: 1 });
  const clientSnap = await getDocs(collection(db, 'clients'));
  for (const clientDoc of clientSnap.docs) {
    const [taskSnap, noteSnap] = await Promise.all([
      getDocs(collection(db, `clients/${clientDoc.id}/tasks`)),
      getDocs(collection(db, `clients/${clientDoc.id}/notes`)),
    ]);
    const subBatch = writeBatch(db);
    taskSnap.docs.forEach(d => subBatch.delete(d.ref));
    noteSnap.docs.forEach(d => subBatch.delete(d.ref));
    if (taskSnap.size + noteSnap.size > 0) await subBatch.commit();
    await deleteDoc(clientDoc.ref);
  }
  onProgress?.({ step: 'Limpiando clientes existentes...', done: 1, total: 1 });

  // Delete top-level collections in batches of 500
  for (const col of TOP_LEVEL_COLLECTIONS) {
    onProgress?.({ step: `Limpiando ${col}...`, done: 0, total: 1 });
    const snap = await getDocs(collection(db, col));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    onProgress?.({ step: `Limpiando ${col}...`, done: 1, total: 1 });
  }
}

// ─── Main Seeder Function ─────────────────────────────────────────────────────

export async function seedDemoData(
  db: Firestore,
  onProgress?: ProgressCallback,
  options?: { force?: boolean }
): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
  const report = (step: string, done: number, total: number) =>
    onProgress?.({ step, done, total });

  const counts: Record<string, number> = {};

  // ── Safety check / force clear ─────────────────────────────────────────────
  const existingClients = await getDocs(query(collection(db, 'clients'), limit(1)));
  if (!existingClients.empty) {
    if (!options?.force) {
      return {
        success: false,
        message: 'La colección de clientes ya tiene datos. Activa "Sobreescribir datos" para limpiar e insertar de nuevo.',
        counts: {},
      };
    }
    await clearCollections(db, onProgress);
  }

  try {
    // ── STEP 1: Clients ────────────────────────────────────────────────────
    report('Creando clientes...', 0, CLIENT_DEFINITIONS.length);
    const clientIdMap: Record<string, string> = {};

    for (let i = 0; i < CLIENT_DEFINITIONS.length; i++) {
      const c = CLIENT_DEFINITIONS[i];
      const completedTasks = c.tasks.filter(t => t.completed).length;
      const totalTasks = c.tasks.length;

      const clientRef = doc(collection(db, 'clients'));
      await setDoc(clientRef, {
        companyName:   c.companyName,
        contactName:   c.contactName,
        contactEmail:  c.contactEmail,
        whatsapp:      c.whatsapp,
        website:       c.website,
        techStack:     c.techStack,
        services:      c.services,
        status:        c.status,
        clientValue:   c.clientValue,
        assignedTo:    c.assignedTo,
        location:      c.location,
        initialNotes:  c.initialNotes,
        color:         c.color,
        logoUrl:       `https://i.pravatar.cc/40?u=${encodeURIComponent(c.companyName)}`,
        createdAt:     ts(daysAgo(90 + i * 8)),
        taskProgress: {
          total:      totalTasks,
          completed:  completedTasks,
          percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
      });

      clientIdMap[c.companyName] = clientRef.id;

      // ── Client tasks (subcollection) ────────────────────────────────────
      for (const t of c.tasks) {
        const createdDate = daysAgo(t.daysAgoCreated);
        const completedDate = t.completed ? daysAgo(Math.max(0, t.daysAgoCreated - 3)) : undefined;
        await addDoc(collection(db, `clients/${clientRef.id}/tasks`), {
          title:       t.title,
          completed:   t.completed,
          createdAt:   ts(createdDate),
          ...(completedDate ? { completedAt: ts(completedDate) } : {}),
        });
      }

      // ── Client notes (subcollection) ────────────────────────────────────
      for (const n of c.notes) {
        await addDoc(collection(db, `clients/${clientRef.id}/notes`), {
          content:   n.content,
          author:    'Miguel Robles',
          createdAt: ts(daysAgo(n.daysAgoCreated)),
        });
      }

      report('Creando clientes...', i + 1, CLIENT_DEFINITIONS.length);
    }
    counts.clients = CLIENT_DEFINITIONS.length;

    // ── STEP 2: Global tasks ───────────────────────────────────────────────
    report('Creando tareas globales...', 0, GLOBAL_TASKS.length);
    const taskBatch = writeBatch(db);
    for (const t of GLOBAL_TASKS) {
      const taskRef = doc(collection(db, 'tasks'));
      taskBatch.set(taskRef, {
        title:       t.title,
        responsible: t.responsible,
        status:      t.status,
        createdAt:   ts(daysAgo(t.daysAgoCreated)),
        dueDate:     t.daysUntilDue !== 0 ? ts(daysFromNow(t.daysUntilDue)) : null,
      });
    }
    await taskBatch.commit();
    counts.globalTasks = GLOBAL_TASKS.length;
    report('Creando tareas globales...', GLOBAL_TASKS.length, GLOBAL_TASKS.length);

    // ── STEP 3: Leads ──────────────────────────────────────────────────────
    report('Creando leads del pipeline...', 0, LEADS_DATA.length);
    const leadBatch = writeBatch(db);
    for (const l of LEADS_DATA) {
      const leadRef = doc(collection(db, 'leads'));
      leadBatch.set(leadRef, {
        companyName:      l.companyName,
        contactName:      l.contactName,
        stage:            l.stage,
        estimatedValue:   l.estimatedValue,
        closeProbability: l.closeProbability,
        interestedService: l.interestedService,
        notes:            l.notes,
        createdAt:        ts(daysAgo(l.daysAgo)),
      });
    }
    await leadBatch.commit();
    counts.leads = LEADS_DATA.length;
    report('Creando leads del pipeline...', LEADS_DATA.length, LEADS_DATA.length);

    // ── STEP 4: Finances ───────────────────────────────────────────────────
    const financeEntries = getFinanceData(clientIdMap);
    report('Creando transacciones financieras...', 0, financeEntries.length);
    const financeBatch = writeBatch(db);
    for (const f of financeEntries) {
      const fRef = doc(collection(db, 'finances'));
      financeBatch.set(fRef, f);
    }
    await financeBatch.commit();
    counts.finances = financeEntries.length;
    report('Creando transacciones financieras...', financeEntries.length, financeEntries.length);

    // ── STEP 5: Support Tickets ────────────────────────────────────────────
    report('Creando tickets de soporte...', 0, TICKETS_DATA.length);
    const ticketBatch = writeBatch(db);
    for (const t of TICKETS_DATA) {
      const tRef = doc(collection(db, 'tickets'));
      ticketBatch.set(tRef, {
        ticketId:    t.ticketId,
        cliente:     t.cliente,
        problema:    t.problema,
        categoría:   t.categoría,
        prioridad:   t.prioridad,
        estado:      t.estado,
        createdAt:   ts(daysAgo(t.daysAgoCreated)),
        ...(t.resolvedDaysAgo != null ? { fechaCierre: ts(daysAgo(t.resolvedDaysAgo)) } : {}),
        ...(t.solucionAplicada ? { solucionAplicada: t.solucionAplicada } : {}),
      });
    }
    await ticketBatch.commit();
    counts.tickets = TICKETS_DATA.length;
    report('Creando tickets de soporte...', TICKETS_DATA.length, TICKETS_DATA.length);

    // ── STEP 6: Activity feed ──────────────────────────────────────────────
    report('Generando feed de actividad...', 0, ACTIVITY_DATA.length);
    const activityBatch = writeBatch(db);
    for (const a of ACTIVITY_DATA) {
      const aRef = doc(collection(db, 'activity'));
      activityBatch.set(aRef, {
        type:      a.type,
        message:   a.message,
        link:      a.link,
        timestamp: ts(daysAgo(a.daysAgo)),
      });
    }
    await activityBatch.commit();
    counts.activity = ACTIVITY_DATA.length;
    report('Feed de actividad generado...', ACTIVITY_DATA.length, ACTIVITY_DATA.length);

    return {
      success: true,
      message: '✓ Demo data insertada correctamente.',
      counts,
    };
  } catch (err) {
    return {
      success: false,
      message: `Error durante el seeding: ${err instanceof Error ? err.message : String(err)}`,
      counts,
    };
  }
}

export const SEED_SUMMARY = {
  clients:     CLIENT_DEFINITIONS.length,
  globalTasks: GLOBAL_TASKS.length,
  clientTasks: CLIENT_DEFINITIONS.reduce((s, c) => s + c.tasks.length, 0),
  clientNotes: CLIENT_DEFINITIONS.reduce((s, c) => s + c.notes.length, 0),
  leads:       LEADS_DATA.length,
  finances:    32, // approximate, generated dynamically
  tickets:     TICKETS_DATA.length,
  activity:    ACTIVITY_DATA.length,
};
