/**
 * Cuestionario "Corrección y Adaptación de Sistema" — Smile More.
 *
 * Transcripción fiel del PDF de levantamiento entregado al cliente
 * (Cuestionario_Correccion_Adaptacion_SmileMore_PixelTEC.pdf). La página
 * pública /smilemoreqa y la vista admin /smilemore-respuestas renderizan
 * ambas desde esta definición, así preguntas y respuestas nunca divergen.
 */

export const PRIORIDAD_OPTIONS = ['Crítica', 'Alta', 'Media', 'Baja', 'Sin cambio'] as const;
export const FRECUENCIA_OPTIONS = ['Siempre', 'A veces', 'Una vez'] as const;
export const IMPACTO_OPTIONS = ['Alto', 'Medio', 'Bajo'] as const;

export type SimpleItemType = 'textarea' | 'radio' | 'radio-other' | 'checkbox-group';

export interface SimpleItem {
  id: string;
  label: string;
  hint?: string;
  type: SimpleItemType;
  options?: readonly string[];
}

/** Bloque de módulo: nombre + "qué comprende" + observación + prioridad. */
export interface ModuleItem {
  id: string;
  type: 'module-block';
  module: string;
  scope: string;
  label: string;
  hint?: string;
}

export type SectionItem = SimpleItem | ModuleItem;

export interface Section {
  num: string;
  id: string;
  title: string;
  intro: string;
  items: readonly SectionItem[];
}

export const INTAKE_FIELDS = {
  puesto: {
    label: 'Puesto / rol',
    options: ['Dirección / Administración', 'Recepción / Staff', 'Doctor(a)'] as readonly string[],
  },
  sucursal: {
    label: 'Sucursal',
    options: ['Guadalajara', 'Guamúchil', 'Ambas'] as readonly string[],
  },
  uso: {
    label: 'Uso del sistema',
    options: ['Diario', 'Varias veces por semana', 'Ocasional'] as readonly string[],
  },
} as const;

export const HOW_TO_ANSWER = [
  'Describe lo que realmente sucede en la operación, incluso si parece un detalle pequeño.',
  'Cuando reportes un error, indica qué estabas haciendo y qué esperabas que ocurriera.',
  'No es necesario proponer la solución técnica: lo importante es explicar el problema y el resultado deseado.',
  'Marca la prioridad de cada cambio para diferenciar lo urgente de lo que puede quedar para una segunda etapa.',
] as const;

export const QUESTIONNAIRE_META = {
  title: 'Corrección y Adaptación de Sistema',
  subtitle: 'Cuestionario de levantamiento y mejora del sistema de citas',
  client: 'Smile More',
  objective:
    'Identificar errores, fricciones y cambios necesarios para adaptar el sistema a la operación diaria de la clínica antes del cierre de la siguiente etapa funcional.',
} as const;

export const SECTIONS: readonly Section[] = [
  {
    num: '01',
    id: 'diagnostico',
    title: 'Diagnóstico general',
    intro: 'Primero queremos entender cómo se siente el sistema en el trabajo diario, antes de revisar cada módulo.',
    items: [
      { id: '1_1', label: '1.1. ¿Qué errores has notado al usar el sistema?', hint: 'Incluye mensajes de error, acciones que no guardan, información incorrecta, pantallas que se traban o cualquier comportamiento inesperado.', type: 'textarea' },
      { id: '1_2', label: '1.2. ¿Hay alguna tarea que actualmente te tome más pasos de los necesarios?', hint: 'Ejemplo: crear una cita, encontrar un paciente, reprogramar, cobrar o consultar la agenda.', type: 'textarea' },
      { id: '1_3', label: '1.3. ¿Qué parte del sistema te resulta confusa o poco intuitiva?', type: 'textarea' },
      { id: '1_4', label: '1.4. ¿Qué proceso sigues haciendo fuera del sistema y te gustaría resolver dentro de él?', hint: 'Por ejemplo: WhatsApp, notas en papel, Excel, llamadas, calendarios personales u otro medio.', type: 'textarea' },
      { id: '1_5', label: '1.5. ¿Hay información que tengas que capturar dos veces o repetir en diferentes partes del sistema?', type: 'textarea' },
      { id: '1_6', label: '1.6. En general, ¿cómo calificarías el sistema hoy para trabajar diariamente?', type: 'radio', options: ['Muy cómodo', 'Cómodo', 'Regular', 'Difícil', 'Muy difícil'] },
      { id: '1_7', label: '1.7. ¿Qué tendría que cambiar para que sintieras que el sistema ya está listo para usarse como herramienta principal de la clínica?', type: 'textarea' },
    ],
  },
  {
    num: '02',
    id: 'citas',
    title: 'Flujo de citas',
    intro: 'Revisión específica del proceso de agenda: solicitud, creación, visualización, cambios y seguimiento. En cada bloque escribe el error, cambio o adaptación que deseas. Si todo funciona correctamente, marca “Sin cambio”.',
    items: [
      { id: '2_1', type: 'module-block', module: 'Nueva Cita', scope: 'Flujo utilizado por el personal para crear una cita: selección o registro de paciente, doctor(a), sucursal, fecha, hora y datos necesarios para guardar la cita.', label: '2.1. Observación / cambio solicitado', hint: '¿Qué dato falta, sobra, está en mal orden o hace más lento agendar?' },
      { id: '2_2', type: 'module-block', module: 'Mi Agenda', scope: 'Vista de las citas correspondientes al usuario o doctor(a), incluyendo navegación por fechas, visualización de horarios y acceso al detalle de cada cita.', label: '2.2. Observación / cambio solicitado', hint: 'Evalúa claridad, rapidez, filtros, colores, tamaño de tarjetas y facilidad para localizar citas.' },
      { id: '2_3', type: 'module-block', module: 'Agenda Clínica', scope: 'Vista consolidada para administración/recepción cuando el usuario tiene acceso, pensada para revisar la operación de varios doctores o la clínica en conjunto.', label: '2.3. Observación / cambio solicitado', hint: '¿Qué necesitas ver de inmediato para coordinar mejor la clínica?' },
      { id: '2_4', type: 'module-block', module: 'Solicitudes', scope: 'Bandeja donde se revisan las solicitudes de cita que llegan desde el sitio o flujo público y que requieren seguimiento por parte de la clínica.', label: '2.4. Observación / cambio solicitado', hint: '¿La información que llega es suficiente? ¿Qué debería poder hacerse desde esta pantalla?' },
      { id: '2_5', type: 'module-block', module: 'Detalle de Cita', scope: 'Pantalla o modal con la información de una cita y las acciones disponibles sobre ella.', label: '2.5. Observación / cambio solicitado', hint: 'Indica qué información debería verse primero y qué acciones deberían estar más accesibles.' },
      { id: '2_6', type: 'module-block', module: 'Reprogramación y Cancelación', scope: 'Proceso para cambiar fecha/hora o cancelar una cita sin perder la trazabilidad necesaria para la operación.', label: '2.6. Observación / cambio solicitado', hint: '¿Qué pasos o confirmaciones deberían cambiar? ¿Qué información debería conservarse?' },
      { id: '2_7', type: 'module-block', module: 'Estados de la Cita', scope: 'Uso de estados para distinguir citas pendientes, confirmadas, atendidas, canceladas, reprogramadas, no asistidas u otros estados que la clínica necesite.', label: '2.7. Observación / cambio solicitado', hint: '¿Los estados actuales representan la operación real? Escribe los estados que agregarías, eliminarías o renombrarías.' },
    ],
  },
  {
    num: '03',
    id: 'pacientes',
    title: 'Pacientes y comunicación',
    intro: 'La agenda funciona mejor cuando la información del paciente y la comunicación están alineadas con el proceso real de recepción.',
    items: [
      { id: '3_1', type: 'module-block', module: 'Pacientes', scope: 'Sección para localizar, registrar y consultar la información del paciente necesaria para la operación y su relación con citas.', label: '3.1. Observación / cambio solicitado', hint: '¿Qué datos necesitas encontrar más rápido? ¿Qué dato falta o no debería mostrarse?' },
      { id: '3_2', label: '3.2. Cuando buscas un paciente, ¿qué dato usas normalmente para encontrarlo?', type: 'radio-other', options: ['Nombre', 'Teléfono', 'Correo'] },
      { id: '3_3', label: '3.3. ¿Qué debería pasar si intentas crear una cita para un paciente que ya existe?', type: 'textarea' },
      { id: '3_4', label: '3.4. ¿Qué comunicaciones deberían enviarse automáticamente al paciente?', hint: 'Piensa en confirmación, recordatorios, reprogramación, cancelación o indicaciones previas.', type: 'textarea' },
      { id: '3_5', label: '3.5. ¿En qué momento deberían enviarse los recordatorios de cita?', type: 'radio-other', options: ['24 horas antes', '48 horas antes', 'El mismo día'] },
      { id: '3_6', label: '3.6. ¿Qué información debe incluir obligatoriamente un mensaje de confirmación o recordatorio?', type: 'textarea' },
      { id: '3_7', label: '3.7. ¿Hay mensajes, textos o nombres de botones que cambiarías para que sean más claros para el personal o para el paciente?', type: 'textarea' },
    ],
  },
  {
    num: '04',
    id: 'modulos',
    title: 'Módulos complementarios',
    intro: 'Aunque el objetivo principal es mejorar citas, estos módulos pueden afectar directamente la operación de recepción y administración.',
    items: [
      { id: '4_1', type: 'module-block', module: 'Resumen', scope: 'Pantalla inicial del dashboard con la información principal y accesos rápidos de la operación.', label: '4.1. Observación / cambio solicitado', hint: '¿Qué información debería verse al iniciar sesión y qué información no aporta valor?' },
      { id: '4_2', type: 'module-block', module: 'Presupuestos', scope: 'Sección utilizada para preparar o consultar presupuestos relacionados con la atención del paciente.', label: '4.2. Observación / cambio solicitado', hint: '¿Qué parte del flujo debería simplificarse o adaptarse?' },
      { id: '4_3', type: 'module-block', module: 'Caja', scope: 'Sección de cobros y registro de pagos vinculados a la operación de la clínica.', label: '4.3. Observación / cambio solicitado', hint: 'Evalúa rapidez para cobrar, conceptos, formas de pago, comprobantes y consulta de movimientos.' },
      { id: '4_4', type: 'module-block', module: 'Configuración', scope: 'Opciones administrativas que afectan el comportamiento o datos generales del sistema.', label: '4.4. Observación / cambio solicitado', hint: '¿Qué debería poder configurar la clínica sin solicitar un cambio técnico?' },
      { id: '4_5', type: 'module-block', module: 'Mi Perfil / Centro de Ayuda', scope: 'Opciones de cuenta personal y recursos para resolver dudas de uso.', label: '4.5. Observación / cambio solicitado', hint: '¿Qué información, guía o acceso hace falta?' },
    ],
  },
  {
    num: '05',
    id: 'roles',
    title: 'Roles, permisos y operación',
    intro: 'Queremos que cada persona vea lo que necesita y pueda hacer su trabajo sin acceder a funciones que no le corresponden.',
    items: [
      { id: '5_1', label: '5.1. ¿Qué personas o roles utilizan actualmente el sistema?', hint: 'Escribe el puesto y, si aplica, qué tareas realiza dentro del sistema.', type: 'textarea' },
      { id: '5_2', label: '5.2. ¿Hay alguna función que una persona debería poder usar y actualmente no puede?', type: 'textarea' },
      { id: '5_3', label: '5.3. ¿Hay alguna información o función que un rol no debería poder ver o modificar?', type: 'textarea' },
      { id: '5_4', label: '5.4. ¿Qué acciones deberían pedir una confirmación antes de ejecutarse?', hint: 'Ejemplo: cancelar una cita, eliminar información, modificar un pago o cambiar una fecha.', type: 'textarea' },
      { id: '5_5', label: '5.5. ¿Quién debería poder modificar horarios, disponibilidad o bloqueos de agenda?', type: 'checkbox-group', options: ['Administración', 'Recepción / Staff', 'Doctor(a)', 'Depende del caso'] },
    ],
  },
  {
    num: '06',
    id: 'usabilidad',
    title: 'Usabilidad y funcionamiento',
    intro: 'Adaptación visual y práctica para que el sistema funcione bien en el entorno real de la clínica.',
    items: [
      { id: '6_1', label: '6.1. ¿Desde qué dispositivos utilizas el sistema?', type: 'checkbox-group', options: ['Computadora', 'Tablet', 'Celular', 'Varios'] },
      { id: '6_2', label: '6.2. ¿Has notado pantallas lentas, botones que no responden o información que tarda en actualizarse?', type: 'textarea' },
      { id: '6_3', label: '6.3. ¿Qué elementos visuales cambiarías?', hint: 'Puedes mencionar tamaño de texto, colores, botones, orden de información, ventanas, calendario, espacios o navegación.', type: 'textarea' },
      { id: '6_4', label: '6.4. ¿Hay una acción que debería poder hacerse con uno o dos clics y hoy requiere demasiado tiempo?', type: 'textarea' },
    ],
  },
  {
    num: '07',
    id: 'priorizacion',
    title: 'Priorización final',
    intro: 'Con esta sección PixelTEC puede convertir las observaciones en un alcance de trabajo claro y ordenado. Ordena los cinco cambios más importantes: la prioridad 1 debe ser el cambio que más afecta la operación diaria o que bloquea el uso correcto del sistema.',
    items: [
      { id: '7_1', label: '7.1. Si solo pudiéramos corregir tres cosas primero, ¿cuáles elegirías?', type: 'textarea' },
      { id: '7_2', label: '7.2. ¿Qué cambio consideras indispensable antes de dar por cerrada esta etapa del sistema?', type: 'textarea' },
      { id: '7_3', label: '7.3. ¿Qué mejoras pueden esperar para una segunda etapa sin afectar la operación actual?', type: 'textarea' },
      { id: '7_4', label: '7.4. ¿Hay alguna función que prefieras eliminar porque no la usan o genera confusión?', type: 'textarea' },
      { id: '7_5', label: '7.5. Comentarios, ideas o necesidades que no hayan quedado cubiertas en las preguntas anteriores:', type: 'textarea' },
    ],
  },
];

/** Ids de items simples (textarea/radio/radio-other) — valores string. */
export const SIMPLE_ANSWER_IDS = new Set(
  SECTIONS.flatMap((s) =>
    s.items.filter((i) => i.type !== 'module-block' && i.type !== 'checkbox-group').map((i) => i.id)
  )
);

/** Ids de checkbox-group — valores string[]. */
export const MULTI_ANSWER_IDS = new Set(
  SECTIONS.flatMap((s) => s.items.filter((i) => i.type === 'checkbox-group').map((i) => i.id))
);

/** Ids de module-block — valores { observacion, prioridad }. */
export const MODULE_ANSWER_IDS = new Set(
  SECTIONS.flatMap((s) => s.items.filter((i) => i.type === 'module-block').map((i) => i.id))
);

/** Fila del registro rápido de incidencias (sección 01). */
export interface IncidentRow {
  seccion?: string;
  haciendo?: string;
  esperabas?: string;
  ocurrio?: string;
  frecuencia?: string;
  impacto?: string;
}

/** Fila de la tabla de priorización final (sección 07). */
export interface PriorityRow {
  cambio?: string;
  problema?: string;
  paraQuien?: string;
}

export interface ModuleAnswer {
  observacion?: string;
  prioridad?: string;
}

/** Payload completo que guarda el server action en `answers` (jsonb). */
export interface SmilemoreQaAnswers {
  nombre: string;
  puesto?: string;
  sucursal?: string;
  uso?: string;
  respuestas: Record<string, string>;
  multiples: Record<string, string[]>;
  modulos: Record<string, ModuleAnswer>;
  incidencias: IncidentRow[];
  prioridades: PriorityRow[];
}
