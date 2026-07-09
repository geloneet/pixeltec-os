/**
 * Diagnóstico Inteligente — catálogos + motor de scoring/recomendación.
 *
 * Puro (sin 'use server' / sin acceso a DB): se importa tanto en el cliente
 * (para mostrar el resultado al instante al terminar el wizard) como en el
 * server action (`submitDiagnostic` en src/app/actions.ts), que RECALCULA el
 * resultado a partir de las mismas respuestas en vez de confiar en el score
 * que mandó el cliente — así el lead persistido siempre es consistente con
 * lo que se le mostró al visitante, sin depender de que el cliente no haya
 * manipulado el payload.
 *
 * Determinista a propósito: nada de Date.now()/Math.random() aquí — mismas
 * respuestas ⇒ mismo resultado siempre, en cliente y servidor.
 */

import {
  HardHat,
  Hotel,
  Stethoscope,
  ShoppingCart,
  Truck,
  UtensilsCrossed,
  Briefcase,
  Factory,
  Building2,
  type LucideIcon,
} from 'lucide-react';

// ─── Catálogos (opciones del wizard) ───────────────────────────────────────

export interface Option {
  value: string;
  label: string;
}

export interface CompanyTypeOption extends Option {
  icon: LucideIcon;
}

export const COMPANY_TYPES: CompanyTypeOption[] = [
  { value: 'constructora', label: 'Constructora', icon: HardHat },
  { value: 'hotel', label: 'Hotel', icon: Hotel },
  { value: 'clinica', label: 'Clínica', icon: Stethoscope },
  { value: 'ecommerce', label: 'Ecommerce', icon: ShoppingCart },
  { value: 'logistica', label: 'Logística', icon: Truck },
  { value: 'restaurante', label: 'Restaurante', icon: UtensilsCrossed },
  { value: 'servicios', label: 'Servicios', icon: Briefcase },
  { value: 'industria', label: 'Industria', icon: Factory },
  { value: 'otra', label: 'Otra', icon: Building2 },
];

export const PROBLEMS: Option[] = [
  { value: 'manual', label: 'Mucho trabajo manual' },
  { value: 'pierdo_clientes', label: 'Pierdo clientes' },
  { value: 'excel', label: 'Todo lo hago en Excel' },
  { value: 'no_sistema', label: 'No tengo sistema' },
  { value: 'pagina_no_vende', label: 'Mi página no vende' },
  { value: 'automatizar', label: 'Necesito automatizar' },
  { value: 'ia', label: 'Necesito IA' },
  { value: 'app', label: 'Quiero una App' },
  { value: 'otro', label: 'Otro' },
];

export const COMPANY_SIZES: Option[] = [
  { value: '1-5', label: '1-5 empleados' },
  { value: '6-20', label: '6-20 empleados' },
  { value: '20-50', label: '20-50 empleados' },
  { value: '50+', label: '50+ empleados' },
];

export const PRIORITIES: Option[] = [
  { value: 'vender_mas', label: 'Vender más' },
  { value: 'ahorrar_tiempo', label: 'Ahorrar tiempo' },
  { value: 'organizar', label: 'Organizar mi empresa' },
  { value: 'automatizar', label: 'Automatizar procesos' },
  { value: 'crear_software', label: 'Crear software' },
];

const SERVICE_LABELS: Record<string, string> = {
  crm: 'CRM personalizado',
  automation_ia: 'Automatización con IA',
  dashboard: 'Dashboard ejecutivo',
  ecommerce: 'Tienda en línea / E-commerce',
  web: 'Sitio web de alto rendimiento',
  app: 'App móvil a medida',
};

// ─── Respuestas del wizard ──────────────────────────────────────────────────

export interface DiagnosticAnswers {
  companyType: string;
  problems: string[];
  companySize: string;
  priority: string;
  name: string;
  email: string;
  phone?: string;
  empresa?: string;
}

export interface DiagnosticResult {
  score: number;
  strengths: string[];
  opportunities: string[];
  recommendedServices: string[];
  timeline: string;
}

const SIZE_BONUS: Record<string, number> = { '1-5': 0, '6-20': 5, '20-50': 10, '50+': 15 };

// Problems that signal LOW digital maturity (penalize score). "automatizar",
// "ia", "app" and "otro" are forward-looking asks, not immaturity signals —
// they don't penalize.
const IMMATURITY_PROBLEMS = new Set(['manual', 'pierdo_clientes', 'excel', 'no_sistema', 'pagina_no_vende']);

const OPPORTUNITY_BY_PROBLEM: Record<string, string> = {
  manual: 'Reducir tareas manuales repetitivas.',
  pierdo_clientes: 'Implementar seguimiento automático de leads y clientes.',
  excel: 'Centralizar información fuera de hojas de cálculo dispersas.',
  no_sistema: 'Adoptar un sistema central (CRM/ERP) para tu operación.',
  pagina_no_vende: 'Optimizar tu sitio web para conversión.',
  automatizar: 'Automatizar procesos clave con integraciones e IA.',
  ia: 'Incorporar IA en atención a clientes y operación.',
  app: 'Desarrollar una app a medida para tu operación.',
  otro: 'Diagnosticar a fondo tu necesidad específica.',
};

const DEFAULT_OPPORTUNITIES = [
  'Centralizar información.',
  'Reducir tareas manuales.',
  'Automatizar seguimiento de clientes.',
];

/** Deterministic scoring + recommendation engine. Same input ⇒ same output. */
export function computeDiagnostic(answers: DiagnosticAnswers): DiagnosticResult {
  const problems = answers.problems ?? [];

  // ── Score (0-100, "madurez digital") ──
  let score = 70;
  for (const p of problems) {
    if (IMMATURITY_PROBLEMS.has(p)) score -= 8;
  }
  score += SIZE_BONUS[answers.companySize] ?? 0;
  score = Math.max(5, Math.min(95, score));

  // ── Strengths ──
  const strengths: string[] = [];
  if (!problems.includes('no_sistema')) {
    strengths.push('Ya utilizas herramientas digitales.');
  }
  if (!problems.includes('excel')) {
    strengths.push('No dependes por completo de hojas de cálculo dispersas.');
  }
  if (answers.companySize === '20-50' || answers.companySize === '50+') {
    strengths.push('Tu equipo tiene el tamaño suficiente para justificar automatización a escala.');
  }
  if (answers.priority === 'automatizar' || answers.priority === 'crear_software') {
    strengths.push('Ya identificas con claridad hacia dónde quieres llevar tu operación.');
  }
  if (strengths.length === 0) {
    strengths.push('Diste el primer paso al evaluar la madurez digital de tu empresa.');
  }
  if (strengths.length === 1) {
    strengths.push('Existe una oportunidad clara de automatización en tu operación.');
  }

  // ── Opportunities ──
  const opportunities = Array.from(
    new Set(problems.filter((p) => p !== 'otro').map((p) => OPPORTUNITY_BY_PROBLEM[p]).filter(Boolean))
  ).slice(0, 4);
  if (opportunities.length === 0) opportunities.push(...DEFAULT_OPPORTUNITIES);

  // ── Recommended services ──
  const services = new Set<string>();
  if (problems.includes('pierdo_clientes') || problems.includes('no_sistema')) services.add('crm');
  if (problems.includes('manual') || problems.includes('automatizar') || problems.includes('ia')) {
    services.add('automation_ia');
  }
  if (problems.includes('excel') || problems.includes('no_sistema')) services.add('dashboard');
  if (answers.companyType === 'ecommerce') services.add('ecommerce');
  if (problems.includes('pagina_no_vende')) services.add('web');
  if (problems.includes('app') || answers.priority === 'crear_software') services.add('app');
  if (services.size === 0) {
    services.add('crm');
    services.add('automation_ia');
    services.add('dashboard');
  }
  const recommendedServices = Array.from(services)
    .slice(0, 4)
    .map((key) => SERVICE_LABELS[key]);

  // ── Timeline ──
  let timeline = '6-8 semanas';
  if (recommendedServices.length >= 4 || answers.companySize === '50+') {
    timeline = '8-12 semanas';
  } else if (recommendedServices.length <= 2 && (answers.companySize === '1-5' || answers.companySize === '6-20')) {
    timeline = '4-6 semanas';
  }

  return { score, strengths, opportunities, recommendedServices, timeline };
}

// ─── CTA de agendado (WhatsApp / llamada / email prellenados) ─────────────

const TEAM_PHONE = '523221378336';
export const TEL_HREF = 'tel:+523221378336';

export function buildDiagnosticSummary(result: DiagnosticResult, answers: DiagnosticAnswers): string {
  const companyLabel = COMPANY_TYPES.find((c) => c.value === answers.companyType)?.label ?? answers.companyType;
  const sizeLabel = COMPANY_SIZES.find((s) => s.value === answers.companySize)?.label ?? answers.companySize;
  const priorityLabel = PRIORITIES.find((p) => p.value === answers.priority)?.label ?? answers.priority;
  const problemLabels = answers.problems
    .map((p) => PROBLEMS.find((o) => o.value === p)?.label ?? p)
    .join(', ');

  const lines = [
    `Diagnóstico Estratégico PixelTEC`,
    ``,
    `Nombre: ${answers.name}`,
    answers.empresa ? `Empresa: ${answers.empresa}` : null,
    `Industria: ${companyLabel}`,
    `Tamaño: ${sizeLabel}`,
    `Problemas: ${problemLabels}`,
    `Prioridad: ${priorityLabel}`,
    `Madurez digital: ${result.score}%`,
    `Servicios recomendados: ${result.recommendedServices.join(', ')}`,
    `Tiempo estimado: ${result.timeline}`,
  ].filter((l): l is string => l !== null);

  return lines.join('\n');
}

export function buildWhatsappLink(summary: string): string {
  return `https://api.whatsapp.com/send?phone=${TEAM_PHONE}&text=${encodeURIComponent(summary)}`;
}

export function buildMailtoLink(summary: string): string {
  const subject = encodeURIComponent('Diagnóstico Estratégico PixelTEC');
  const body = encodeURIComponent(summary);
  return `mailto:contacto@pixeltec.mx?subject=${subject}&body=${body}`;
}

/**
 * Fase 2 (no bloquea v1): si se define, muestra un botón adicional "Agendar
 * en calendario" apuntando a un link externo (Calendly / Google Calendar
 * Appointment Schedule). Debe ser NEXT_PUBLIC_* porque se lee en el cliente.
 */
export const SCHEDULING_URL = process.env.NEXT_PUBLIC_SCHEDULING_URL;
