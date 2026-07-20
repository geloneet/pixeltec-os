// @vitest-environment jsdom
// src/components/pixelforge/AddContextSourceForm.test.tsx
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Ver NewPixelforgeForm.test.tsx: jsdom no implementa scrollIntoView, que el
// Select de radix (PF-X1 T3) invoca al abrir para posicionar el item activo.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { addContextSourceActionMock, refreshMock } = vi.hoisted(() => ({
  addContextSourceActionMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/pixelforge/actions", () => ({
  addContextSourceAction: addContextSourceActionMock,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

import { AddContextSourceForm } from "./AddContextSourceForm";

/** Abre el Select (radix) de "Tipo" y elige la opción dada por texto. */
async function selectType(optionName: string) {
  fireEvent.click(screen.getByRole("combobox", { name: /tipo/i }));
  fireEvent.click(await screen.findByRole("option", { name: optionName }));
}

describe("AddContextSourceForm", () => {
  it("no muestra el campo URL cuando el tipo es 'note'", () => {
    render(<AddContextSourceForm projectId="proj-1" />);
    expect(screen.queryByPlaceholderText(/https?:\/\//i)).not.toBeInTheDocument();
  });

  it("muestra el campo URL (obligatorio) cuando el tipo es 'url'", async () => {
    render(<AddContextSourceForm projectId="proj-1" />);
    await selectType("URL");
    expect(screen.getByPlaceholderText(/https?:\/\//i)).toBeInTheDocument();
  });

  it("el SelectContent portaleado (tipo) trae data-product=\"pixelforge\" para reactivar los tokens --pfx-* fuera del wrapper del layout", async () => {
    render(<AddContextSourceForm projectId="proj-1" />);
    fireEvent.click(screen.getByRole("combobox", { name: /tipo/i }));
    const option = await screen.findByRole("option", { name: "URL" });
    const content = option.closest('[role="listbox"]');
    expect(content).toHaveAttribute("data-product", "pixelforge");
  });

  it("anexa una fuente exitosamente: llama a la action, muestra toast, limpia campos y refresca", async () => {
    addContextSourceActionMock.mockResolvedValue({ success: true, data: { id: "src-1" } });
    render(<AddContextSourceForm projectId="proj-1" />);

    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "Sitio actual" } });
    fireEvent.change(screen.getByLabelText(/contenido/i), { target: { value: "El sitio actual usa X" } });
    fireEvent.click(screen.getByText("Anexar fuente"));

    await waitFor(() =>
      expect(addContextSourceActionMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        type: "note",
        title: "Sitio actual",
        content: "El sitio actual usa X",
        url: undefined,
      })
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.getByLabelText(/título/i)).toHaveValue("");
  });

  it("muestra toast.error cuando la action falla", async () => {
    addContextSourceActionMock.mockResolvedValue({ success: false, error: "No se pudo anexar la fuente" });
    render(<AddContextSourceForm projectId="proj-1" />);

    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "Sitio actual" } });
    fireEvent.change(screen.getByLabelText(/contenido/i), { target: { value: "El sitio actual usa X" } });
    fireEvent.click(screen.getByText("Anexar fuente"));

    await waitFor(() => expect(addContextSourceActionMock).toHaveBeenCalled());
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("incluye la url cuando el tipo es 'url'", async () => {
    addContextSourceActionMock.mockResolvedValue({ success: true, data: { id: "src-1" } });
    render(<AddContextSourceForm projectId="proj-1" />);

    await selectType("URL");
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: "Competencia" } });
    fireEvent.change(screen.getByLabelText(/contenido/i), { target: { value: "Referencia de un competidor" } });
    fireEvent.change(screen.getByPlaceholderText(/https?:\/\//i), {
      target: { value: "https://ejemplo.com" },
    });
    fireEvent.click(screen.getByText("Anexar fuente"));

    await waitFor(() =>
      expect(addContextSourceActionMock).toHaveBeenCalledWith({
        projectId: "proj-1",
        type: "url",
        title: "Competencia",
        content: "Referencia de un competidor",
        url: "https://ejemplo.com",
      })
    );
  });
});
