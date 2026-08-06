import { describe, expect, it } from 'vitest';
import { editorActions, type WorkflowActionId } from './workflow';

const admin = { isAdmin: true };
const staff = { isAdmin: false };

function ids(list: { id: WorkflowActionId }[]): WorkflowActionId[] {
  return list.map((a) => a.id);
}

describe('editorActions — acciones por estado (admin)', () => {
  it('draft: enviar a revisión como primaria; nada de aprobar/publicar', () => {
    const a = editorActions('draft', admin);
    expect(ids(a.primary)).toEqual(['request-review']);
    expect(ids(a.secondary)).toEqual(['regenerate', 'archive']);
  });

  it('needs-review: aprobar o devolver — JAMÁS «enviar a revisión» (bug del dictamen)', () => {
    const a = editorActions('needs-review', admin);
    expect(ids(a.primary)).toEqual(['approve', 'return-with-comments']);
    expect(ids([...a.primary, ...a.secondary])).not.toContain('request-review');
  });

  it('approved: publicar ahora (programar queda RESERVADO/oculto)', () => {
    const a = editorActions('approved', admin);
    expect(ids(a.primary)).toEqual(['publish']);
    expect(ids([...a.primary, ...a.secondary])).not.toContain('schedule-publish');
    expect(ids(a.secondary)).toContain('return-with-comments');
  });

  it('published: ver artículo y crear nueva revisión (B-PR6: el versionado ya existe)', () => {
    const a = editorActions('published', admin);
    expect(ids(a.primary)).toEqual(['view-public', 'create-revision']);
    expect(ids([...a.primary, ...a.secondary])).not.toContain('publish');
  });

  it('archived: restaurar; sin regenerar ni publicar', () => {
    const a = editorActions('archived', admin);
    expect(ids(a.primary)).toEqual(['unarchive']);
    expect(a.secondary).toEqual([]);
  });

  it('estado desconocido degrada a lo seguro sin romper', () => {
    const a = editorActions('estado-futuro', admin);
    expect(a.primary).toEqual([]);
    expect(ids(a.secondary)).toEqual(['archive']);
  });
});

describe('editorActions — sin rol admin se ocultan las acciones de servidor-admin', () => {
  it('needs-review sin admin: puede aprobar (acción de sesión) pero no devolver', () => {
    const a = editorActions('needs-review', staff);
    expect(ids(a.primary)).toEqual(['approve']);
    expect(ids([...a.primary, ...a.secondary])).not.toContain('return-with-comments');
    expect(ids([...a.primary, ...a.secondary])).not.toContain('archive');
  });

  it('approved sin admin: no hay publicar', () => {
    const a = editorActions('approved', staff);
    expect(ids(a.primary)).toEqual([]);
  });

  it('archived sin admin: no hay restaurar', () => {
    expect(editorActions('archived', staff).primary).toEqual([]);
  });
});
