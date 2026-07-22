// @vitest-environment jsdom
/**
 * Tests mínimos de `usePixelforgeQaRun` (PF-F8 T4) — no existe un test para
 * `usePixelforgeRun` (el hook del que este es calco) que copiar, así que
 * este archivo cubre el mínimo pedido por el brief: render con datos, y que
 * el polling se apaga en un status terminal.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePixelforgeQaRun } from "./use-pixelforge-qa-run";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetchOnce(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("usePixelforgeQaRun", () => {
  it("no hace fetch si qaRunId es null", () => {
    const fetchMock = stubFetchOnce({});
    const { result } = renderHook(() => usePixelforgeQaRun(null));

    expect(result.current.run).toBeNull();
    expect(result.current.findings).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carga el run y expone sus findings", async () => {
    stubFetchOnce({
      run: { id: "qa-1", status: "running" },
      findings: [{ id: "f1", checkCode: "QA-ST-001" }],
    });

    const { result } = renderHook(() => usePixelforgeQaRun("qa-load"));

    await waitFor(() => expect(result.current.run).not.toBeNull());
    expect(result.current.run?.status).toBe("running");
    expect(result.current.findings).toHaveLength(1);
    expect(result.current.isLoading).toBe(false);
  });

  it("deja de pollear una vez que el status es terminal (succeeded)", async () => {
    const fetchMock = stubFetchOnce({
      run: { id: "qa-1", status: "succeeded" },
      findings: [],
    });

    const { result } = renderHook(() => usePixelforgeQaRun("qa-terminal"));

    await waitFor(() => expect(result.current.run?.status).toBe("succeeded"));

    const callsAfterSettle = fetchMock.mock.calls.length;
    // `refreshInterval` devuelve 0 en un status terminal — SWR no debería
    // seguir pidiendo más allá de la carga inicial.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(fetchMock.mock.calls.length).toBe(callsAfterSettle);
  });
});
