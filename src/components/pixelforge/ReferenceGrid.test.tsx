// @vitest-environment jsdom
// src/components/pixelforge/ReferenceGrid.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReferenceAnalysis } from "@/lib/pixelforge/schemas/analyze-reference";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const {
  addUrlReferenceActionMock,
  addImageReferenceActionMock,
  addNoteReferenceActionMock,
  removeReferenceActionMock,
  refreshMock,
  usePixelforgeRunMock,
} = vi.hoisted(() => ({
  addUrlReferenceActionMock: vi.fn(),
  addImageReferenceActionMock: vi.fn(),
  addNoteReferenceActionMock: vi.fn(),
  removeReferenceActionMock: vi.fn(),
  refreshMock: vi.fn(),
  usePixelforgeRunMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  addUrlReferenceAction: addUrlReferenceActionMock,
  addImageReferenceAction: addImageReferenceActionMock,
  addNoteReferenceAction: addNoteReferenceActionMock,
  removeReferenceAction: removeReferenceActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));
vi.mock("@/hooks/pixelforge/use-pixelforge-run", () => ({
  usePixelforgeRun: usePixelforgeRunMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { ReferenceGrid, type VisualReferenceView } from "./ReferenceGrid";

function fixtureAnalysis(): ReferenceAnalysis {
  return {
    densidadVisual: "moderada",
    paletaDominante: "clara",
    temperatura: "neutra",
    tipografiaTitulos: "sans-serif",
    estiloLayout: "grid",
    nivelMovimientoPercibido: "sutil",
    personalidad: ["premium", "sobria"],
    notas: "Sitio limpio, mucho espacio en blanco.",
  };
}

function refUrlSemantic(overrides: Partial<VisualReferenceView> = {}): VisualReferenceView {
  return {
    id: "ref-url-1",
    kind: "url",
    label: "Sitio de la competencia",
    url: "https://ejemplo.com",
    coverage: "semantic-only",
    analysis: null,
    weight: 1,
    ...overrides,
  };
}

function refImageFullpage(overrides: Partial<VisualReferenceView> = {}): VisualReferenceView {
  return {
    id: "ref-img-1",
    kind: "image",
    label: "Screenshot completo",
    assetUrl: "https://cdn.example.com/img.png",
    coverage: "static-visual-fullpage",
    analysis: null,
    weight: 1,
    ...overrides,
  };
}

function refImagePartial(overrides: Partial<VisualReferenceView> = {}): VisualReferenceView {
  return {
    id: "ref-img-2",
    kind: "image",
    label: "Screenshot del hero",
    assetUrl: "https://cdn.example.com/hero.png",
    coverage: "static-visual-partial",
    analysis: null,
    weight: 1,
    ...overrides,
  };
}

describe("ReferenceGrid", () => {
  beforeEach(() => {
    usePixelforgeRunMock.mockReturnValue({ run: null, isPolling: false, error: undefined });
  });

  it("sin referencias: muestra el empty state", () => {
    render(<ReferenceGrid projectId="proj-1" references={[]} />);
    expect(
      screen.getByText(/Agrega referencias visuales.*inspirar la dirección visual/i)
    ).toBeInTheDocument();
  });

  it("badge de cobertura: semantic-only muestra 'Solo semántica' y sugiere subir screenshot (kind url)", () => {
    render(<ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />);
    expect(screen.getByText("Solo semántica")).toBeInTheDocument();
    expect(screen.getByText(/Sube un screenshot para análisis visual/i)).toBeInTheDocument();
  });

  it("badge de cobertura: static-visual-fullpage muestra 'Visual completa' y NO sugiere screenshot", () => {
    render(<ReferenceGrid projectId="proj-1" references={[refImageFullpage()]} />);
    expect(screen.getByText("Visual completa")).toBeInTheDocument();
    expect(screen.queryByText(/Sube un screenshot/i)).not.toBeInTheDocument();
  });

  it("badge de cobertura: static-visual-partial muestra 'Visual parcial'", () => {
    render(<ReferenceGrid projectId="proj-1" references={[refImagePartial()]} />);
    expect(screen.getByText("Visual parcial")).toBeInTheDocument();
  });

  it("sin analysis: muestra el botón 'Analizar'", () => {
    render(<ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />);
    expect(screen.getByText("Analizar")).toBeInTheDocument();
  });

  it("con analysis: NO muestra el botón 'Analizar' y renderiza chips de atributos", () => {
    render(
      <ReferenceGrid
        projectId="proj-1"
        references={[refUrlSemantic({ analysis: fixtureAnalysis() })]}
      />
    );
    expect(screen.queryByText("Analizar")).not.toBeInTheDocument();
    expect(screen.getByText(/Densidad: moderada/)).toBeInTheDocument();
    expect(screen.getByText("premium")).toBeInTheDocument();
    expect(screen.getByText("sobria")).toBeInTheDocument();
  });

  it("botón Analizar: hace POST a /api/pixelforge/runs con projectId/operation/referenceId", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: "run-1", status: "running" }),
    });
    render(<ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />);

    fireEvent.click(screen.getByText("Analizar"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/pixelforge/runs");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      projectId: "proj-1",
      operation: "analyze_reference",
      referenceId: "ref-url-1",
    });
  });

  it("quitar: pide confirmación y al confirmar llama removeReferenceAction con el id correcto", async () => {
    removeReferenceActionMock.mockResolvedValue({ success: true });
    render(<ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />);

    fireEvent.click(screen.getByLabelText(/Quitar Sitio de la competencia/i));
    expect(removeReferenceActionMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Confirmar"));

    await waitFor(() =>
      expect(removeReferenceActionMock).toHaveBeenCalledWith({ referenceId: "ref-url-1" })
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("formulario URL: agrega una referencia llamando addUrlReferenceAction y refresca", async () => {
    addUrlReferenceActionMock.mockResolvedValue({ success: true, data: { id: "new-1" } });
    render(<ReferenceGrid projectId="proj-1" references={[]} />);

    fireEvent.change(screen.getByLabelText(/Etiqueta/i), { target: { value: "Landing inspiradora" } });
    fireEvent.change(screen.getByLabelText(/^URL$/i), { target: { value: "https://ejemplo.com" } });
    fireEvent.click(screen.getByText("Agregar referencia"));

    await waitFor(() =>
      expect(addUrlReferenceActionMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        label: "Landing inspiradora",
        url: "https://ejemplo.com",
      })
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
  });

  it("formulario Nota: agrega una referencia llamando addNoteReferenceAction", async () => {
    addNoteReferenceActionMock.mockResolvedValue({ success: true, data: { id: "new-2" } });
    render(<ReferenceGrid projectId="proj-1" references={[]} />);

    fireEvent.click(screen.getByText("Nota"));
    fireEvent.change(screen.getByLabelText(/Etiqueta/i), { target: { value: "Dirección a evitar" } });
    fireEvent.change(screen.getByLabelText(/^Nota$/i), {
      target: { value: "Nada de estilo corporativo genérico." },
    });
    fireEvent.click(screen.getByText("Agregar referencia"));

    await waitFor(() =>
      expect(addNoteReferenceActionMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        label: "Dirección a evitar",
        note: "Nada de estilo corporativo genérico.",
      })
    );
  });

  it("formulario Imagen: construye FormData con projectId/label/file y llama addImageReferenceAction", async () => {
    addImageReferenceActionMock.mockResolvedValue({ success: true, data: { id: "new-3" } });
    render(<ReferenceGrid projectId="proj-1" references={[]} />);

    fireEvent.click(screen.getByText("Imagen"));
    fireEvent.change(screen.getByLabelText(/Etiqueta/i), { target: { value: "Screenshot hero" } });

    const file = new File(["contenido"], "hero.png", { type: "image/png" });
    const input = screen.getByLabelText(/Imagen \(PNG, JPEG o WebP/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByText("Agregar referencia"));

    await waitFor(() => expect(addImageReferenceActionMock).toHaveBeenCalled());
    const formData = addImageReferenceActionMock.mock.calls[0][0] as FormData;
    expect(formData.get("projectId")).toBe("proj-1");
    expect(formData.get("label")).toBe("Screenshot hero");
    expect(formData.get("file")).toBe(file);
  });

  it("mientras analiza: la plancha de referencia usa el estado forging (veta fluyendo, PF-X1 T6)", () => {
    let resolveFetch: (v: { ok: boolean; json: () => Promise<unknown> }) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    const { container } = render(
      <ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />
    );

    fireEvent.click(screen.getByText("Analizar"));

    expect(container.querySelector(".forge-zone--forging")).not.toBeNull();
    resolveFetch({ ok: true, json: async () => ({ runId: "run-1", status: "running" }) });
  });

  it("en reposo (sin análisis en curso): la plancha de referencia usa el estado draft", () => {
    const { container } = render(
      <ReferenceGrid projectId="proj-1" references={[refUrlSemantic()]} />
    );
    expect(container.querySelector(".forge-zone--draft")).not.toBeNull();
    expect(container.querySelector(".forge-zone--forging")).toBeNull();
  });

  it("formulario Imagen: rechaza archivos > 5MB antes de llamar la action", () => {
    render(<ReferenceGrid projectId="proj-1" references={[]} />);

    fireEvent.click(screen.getByText("Imagen"));
    fireEvent.change(screen.getByLabelText(/Etiqueta/i), { target: { value: "Screenshot grande" } });

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    const input = screen.getByLabelText(/Imagen \(PNG, JPEG o WebP/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(screen.getByText("Agregar referencia").closest("button")).toBeDisabled();
    expect(screen.getByText(/La imagen excede 5MB/i)).toBeInTheDocument();
  });
});
