import { describe, expect, test, vi, beforeEach } from 'vitest';

/**
 * Fase B — generación asíncrona. Contratos que protegen estos tests:
 *  - startDraftGeneration responde de inmediato (la generación sigue viva
 *    como promesa desanclada) y marca `generating`.
 *  - Un fallo desanclado NO se pierde: queda `pending` + `lastError` SANEADO
 *    (el polling se lo muestra al editor).
 *  - Idempotencia: con `generating` en curso no se duplica la generación;
 *    `force` sí re-dispara (rescate del status atascado por reciclado).
 */

const { sessionMock, resolveBriefRowMock, generatePostFromBriefMock, setArgs } = vi.hoisted(() => ({
  sessionMock: vi.fn(),
  resolveBriefRowMock: vi.fn(),
  generatePostFromBriefMock: vi.fn(),
  setArgs: [] as unknown[],
}));

vi.mock('@/lib/auth/session', () => ({ requireUserSession: sessionMock }));
vi.mock('@/lib/db', () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn((arg: unknown) => {
        setArgs.push(arg);
        return { where: vi.fn(async () => undefined) };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'post-row-1' }]) })),
    })),
  },
}));
vi.mock('@/lib/db/schema', () => ({ blogBriefs: { data: {} }, blogPosts: { id: {} } }));
vi.mock('../pg', () => ({
  resolveBriefRow: resolveBriefRowMock,
  resolvePostRow: vi.fn(),
  publicId: vi.fn(() => 'brief-1'),
  getUserDisplayName: vi.fn(async () => 'Miguel Robles'),
}));
vi.mock('../ai/generate-post', () => ({
  generatePostFromBrief: generatePostFromBriefMock,
  computeWordCount: vi.fn(() => 800),
  computeReadingTime: vi.fn(() => 4),
  generateSlug: vi.fn(() => 'slug-async'),
}));

import { startDraftGeneration, getBriefGenerationStatus } from './drafts';

const GENERATED = {
  title: 'Título generado suficientemente largo',
  excerpt: 'x'.repeat(80),
  body: 'cuerpo '.repeat(120),
  category: 'automatización',
  tags: ['ia'],
  modelUsed: 'claude-test',
  rawOutput: 'raw',
};

/** Deja correr la promesa desanclada hasta vaciar la cola de microtareas. */
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};
const patches = () => setArgs.map((a) => JSON.stringify(a) ?? '');

beforeEach(() => {
  vi.clearAllMocks();
  setArgs.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  sessionMock.mockResolvedValue({ userId: 'user-1', email: 'staff@ejemplo.mx', role: 'staff' });
  resolveBriefRowMock.mockResolvedValue({
    id: 'row-1',
    data: { status: 'pending' },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  });
});

describe('startDraftGeneration — Fase B', () => {
  test('responde de inmediato con started:true mientras la generación sigue en curso', async () => {
    let resolveGen!: (v: typeof GENERATED) => void;
    generatePostFromBriefMock.mockReturnValueOnce(new Promise((r) => { resolveGen = r; }));

    const result = await startDraftGeneration('brief-1');

    expect(result).toEqual({ ok: true, data: { started: true } });
    expect(patches().some((p) => p.includes('generating'))).toBe(true);

    resolveGen(GENERATED);
    await flush();
    expect(patches().some((p) => p.includes('generated'))).toBe(true);
  });

  test('el fallo desanclado deja pending + lastError saneado', async () => {
    generatePostFromBriefMock.mockRejectedValueOnce(new Error('SELECT * FROM secreto_interno'));

    const result = await startDraftGeneration('brief-1');
    expect(result.ok).toBe(true);
    await flush();

    const all = patches().join('|');
    expect(all).toContain('pending');
    expect(all).toContain('lastError');
    expect(all).not.toContain('SELECT * FROM secreto_interno');
  });

  test('idempotente: con status generating NO re-dispara', async () => {
    resolveBriefRowMock.mockResolvedValue({
      id: 'row-1',
      data: { status: 'generating' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await startDraftGeneration('brief-1');
    await flush();

    expect(result).toEqual({ ok: true, data: { started: true } });
    expect(generatePostFromBriefMock).not.toHaveBeenCalled();
  });

  test('force re-dispara aunque el status esté atascado en generating', async () => {
    resolveBriefRowMock.mockResolvedValue({
      id: 'row-1',
      data: { status: 'generating' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    generatePostFromBriefMock.mockResolvedValueOnce(GENERATED);

    const result = await startDraftGeneration('brief-1', { force: true });
    await flush();

    expect(result.ok).toBe(true);
    expect(generatePostFromBriefMock).toHaveBeenCalledTimes(1);
  });
});

describe('getBriefGenerationStatus', () => {
  test('devuelve status, generatedDraftId y lastError del data JSONB', async () => {
    resolveBriefRowMock.mockResolvedValue({
      id: 'row-1',
      data: { status: 'generated', generatedDraftId: 'post-9', lastError: null },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const res = await getBriefGenerationStatus('brief-1');

    expect(res).toEqual({
      ok: true,
      data: { status: 'generated', generatedDraftId: 'post-9', lastError: null },
    });
  });
});
