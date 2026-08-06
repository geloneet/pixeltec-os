/**
 * Máquina de estados editorial del blog (D4 del plan 2026-08-05): deriva las
 * acciones del editor a partir del estado REAL del artículo, con ids estables.
 * PURA — sin DB ni sesión — para testearse estado×rol sin DOM.
 *
 * Reglas del dictamen:
 * - Cada estado muestra SOLO las acciones que le corresponden (nada de
 *   «Marcar para revisión» sobre un artículo ya en revisión).
 * - La transición de guardado NO cambia estado: enviar a revisión es un acto
 *   explícito (`request-review`).
 * - `schedule-publish` queda RESERVADO (oculto): publicar programado requiere
 *   scheduler y está diferido explícitamente por el plan.
 * - Estado desconocido DEGRADA a acciones seguras (guardar/archivar), jamás
 *   rompe — misma regla dura que la lista.
 */

export type WorkflowActionId =
  | 'request-review'
  | 'approve'
  | 'return-with-comments'
  | 'publish'
  | 'schedule-publish'
  | 'view-public'
  | 'create-revision'
  | 'archive'
  | 'unarchive'
  | 'regenerate';

export interface WorkflowAction {
  id: WorkflowActionId;
  label: string;
  /** Tono visual estable para que la UI no re-decida colores por estado. */
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'muted';
  /** Solo admin puede ejecutarla (el servidor la exige igual — esto es UI). */
  adminOnly?: boolean;
}

export interface EditorActions {
  /** Acción(es) que mueven el flujo — botones prominentes. */
  primary: WorkflowAction[];
  /** Acciones de soporte — botones discretos bajo el separador. */
  secondary: WorkflowAction[];
}

const A: Record<WorkflowActionId, WorkflowAction> = {
  'request-review': { id: 'request-review', label: 'Enviar a revisión', tone: 'primary' },
  approve: { id: 'approve', label: 'Aprobar', tone: 'primary' },
  'return-with-comments': {
    id: 'return-with-comments',
    label: 'Devolver con comentarios',
    tone: 'warning',
    adminOnly: true,
  },
  publish: { id: 'publish', label: 'Publicar ahora', tone: 'success', adminOnly: true },
  'schedule-publish': { id: 'schedule-publish', label: 'Programar', tone: 'muted', adminOnly: true },
  'view-public': { id: 'view-public', label: 'Ver artículo', tone: 'primary' },
  'create-revision': { id: 'create-revision', label: 'Crear nueva revisión', tone: 'muted' },
  archive: { id: 'archive', label: 'Archivar', tone: 'danger', adminOnly: true },
  unarchive: { id: 'unarchive', label: 'Restaurar del archivo', tone: 'primary', adminOnly: true },
  regenerate: { id: 'regenerate', label: 'Regenerar con IA', tone: 'muted' },
};

/** Ids que la UI aún no debe pintar aunque el estado los liste.
 *  B-PR6: `create-revision` salió de aquí — el versionado ya existe y el botón
 *  del editor lo cablea a la action `createRevision` (snapshot `nueva-revision`). */
const HIDDEN: ReadonlySet<WorkflowActionId> = new Set(['schedule-publish']);

export function editorActions(status: string, opts: { isAdmin: boolean }): EditorActions {
  let primary: WorkflowAction[];
  let secondary: WorkflowAction[];

  switch (status) {
    case 'draft':
      primary = [A['request-review']];
      secondary = [A.regenerate, A.archive];
      break;
    case 'needs-review':
      primary = [A.approve, A['return-with-comments']];
      secondary = [A.regenerate, A.archive];
      break;
    case 'approved':
      primary = [A.publish, A['schedule-publish']];
      secondary = [A['return-with-comments'], A.archive];
      break;
    case 'published':
      primary = [A['view-public'], A['create-revision']];
      secondary = [A.archive];
      break;
    case 'archived':
      primary = [A.unarchive];
      secondary = [];
      break;
    default:
      // Estado desconocido: degrada a lo seguro.
      primary = [];
      secondary = [A.archive];
      break;
  }

  const visible = (a: WorkflowAction) => !HIDDEN.has(a.id) && (opts.isAdmin || !a.adminOnly);
  return { primary: primary.filter(visible), secondary: secondary.filter(visible) };
}
