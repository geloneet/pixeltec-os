// @vitest-environment jsdom
// src/components/pixelforge/AddContextSourceForm.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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

describe("AddContextSourceForm", () => {
  it("no muestra el campo URL cuando el tipo es 'note'", () => {
    render(<AddContextSourceForm projectId="proj-1" />);
    expect(screen.queryByPlaceholderText(/https?:\/\//i)).not.toBeInTheDocument();
  });

  it("muestra el campo URL (obligatorio) cuando el tipo es 'url'", () => {
    render(<AddContextSourceForm projectId="proj-1" />);
    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: "url" } });
    expect(screen.getByPlaceholderText(/https?:\/\//i)).toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText(/tipo/i), { target: { value: "url" } });
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
