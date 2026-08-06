import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Herramientas de IA (B-PR6): PROPONEN, no escriben. Se verifica que cada
 * action devuelve `{proposal}` sin tocar la base (db.update/insert jamás se
 * llaman — de hecho el módulo ni importa `db`), que max_tokens ≤ 1024 y que
 * la inferencia va vía anthropicCreate (ADR-0028).
 */

const { sessionMock, resolvePostRowMock, anthropicCreateMock, dbUpdateMock, dbInsertMock } =
  vi.hoisted(() => ({
    sessionMock: vi.fn(),
    resolvePostRowMock: vi.fn(),
    anthropicCreateMock: vi.fn(),
    dbUpdateMock: vi.fn(),
    dbInsertMock: vi.fn(),
  }));

vi.mock('@/lib/auth/session', () => ({ requireUserSession: sessionMock }));
vi.mock('../pg', () => ({ resolvePostRow: resolvePostRowMock }));
vi.mock('@/lib/ai/anthropic-egress', () => ({ anthropicCreate: anthropicCreateMock }));
vi.mock('@/lib/db', () => ({ db: { update: dbUpdateMock, insert: dbInsertMock } }));

import { improveTitle, improveExcerpt, improveFragment, adjustTone } from './ai-tools';

const POST_ROW = {
  id: 'post-uuid',
  title: 'Título actual',
  excerpt: 'Extracto actual',
  body: '# Intro\n\nPárrafo inicial.\n\n## Sección\n\nMás contenido.',
  category: 'arquitectura',
  briefSource: { targetAudience: 'pymes', tone: 'educativo' },
  seo: { primaryKeyword: 'software a medida' },
};

interface CapturedCall {
  operation: string;
  model: string;
  params: { max_tokens: number; system: string; messages: unknown[] };
}

let captured: CapturedCall[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  captured = [];
  sessionMock.mockResolvedValue({ userId: 'u1', role: 'staff' });
  resolvePostRowMock.mockResolvedValue(POST_ROW);
  anthropicCreateMock.mockImplementation(
    async (call: { operation: string; model: string; buildParams: () => CapturedCall['params'] }) => {
      captured.push({ operation: call.operation, model: call.model, params: call.buildParams() });
      return { content: [{ type: 'text', text: '  Propuesta de la IA  ' }], model: 'model-x' };
    }
  );
});

function expectNoDbWrites() {
  expect(dbUpdateMock).not.toHaveBeenCalled();
  expect(dbInsertMock).not.toHaveBeenCalled();
}

describe('las 4 herramientas devuelven propuesta SIN escribir a la base', () => {
  test('improveTitle', async () => {
    const result = await improveTitle('post-1');
    expect(result).toEqual({ ok: true, data: { proposal: 'Propuesta de la IA' } });
    expectNoDbWrites();
  });

  test('improveExcerpt', async () => {
    const result = await improveExcerpt('post-1');
    expect(result).toEqual({ ok: true, data: { proposal: 'Propuesta de la IA' } });
    expectNoDbWrites();
  });

  test('improveFragment con selección válida', async () => {
    const result = await improveFragment('post-1', 'Párrafo inicial con contenido.');
    expect(result).toEqual({ ok: true, data: { proposal: 'Propuesta de la IA' } });
    expectNoDbWrites();
  });

  test('adjustTone con tono del brief', async () => {
    const result = await adjustTone('post-1', 'técnico-directo');
    expect(result).toEqual({ ok: true, data: { proposal: 'Propuesta de la IA' } });
    expectNoDbWrites();
    // El objetivo es la INTRODUCCIÓN (hasta el primer H2), no el cuerpo entero.
    expect(captured[0].params.messages).toBeDefined();
  });
});

describe('contrato con anthropic-egress (ADR-0028)', () => {
  test('operation generate_text y max_tokens ≤ 1024 en TODAS', async () => {
    await improveTitle('post-1');
    await improveExcerpt('post-1');
    await improveFragment('post-1', 'Párrafo inicial con contenido.');
    await adjustTone('post-1', 'educativo');

    expect(captured).toHaveLength(4);
    for (const call of captured) {
      expect(call.operation).toBe('generate_text');
      expect(call.params.max_tokens).toBeLessThanOrEqual(1024);
    }
  });
});

describe('validaciones locales — sin llamar a la IA', () => {
  test('improveFragment sin selección suficiente', async () => {
    const result = await improveFragment('post-1', '   ab ');
    expect(result.ok).toBe(false);
    expect(anthropicCreateMock).not.toHaveBeenCalled();
    expectNoDbWrites();
  });

  test('adjustTone con tono desconocido', async () => {
    const result = await adjustTone('post-1', 'sarcástico');
    expect(result.ok).toBe(false);
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('sin sesión → No autenticado', async () => {
    sessionMock.mockResolvedValueOnce(null);
    const result = await improveTitle('post-1');
    expect(result).toEqual({ ok: false, error: 'No autenticado' });
    expect(anthropicCreateMock).not.toHaveBeenCalled();
  });

  test('un fallo del proveedor devuelve mensaje saneado', async () => {
    anthropicCreateMock.mockRejectedValueOnce(new Error('cuerpo crudo del proveedor con prompt'));
    const result = await improveTitle('post-1');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Error generando la propuesta con IA');
    expect(JSON.stringify(result)).not.toContain('cuerpo crudo');
  });
});
