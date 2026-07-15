// @vitest-environment jsdom
// src/components/crm/workspace-tabs/ProyectosTab.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { CRMClient } from "@/types/crm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { listClientDefinitionsActionMock } = vi.hoisted(() => ({
  listClientDefinitionsActionMock: vi.fn(),
}));

vi.mock("@/app/(admin)/proyectos/definicion/actions", () => ({
  listClientDefinitionsAction: listClientDefinitionsActionMock,
}));

import { ProyectosTab } from "./ProyectosTab";

function buildClient(overrides: Partial<CRMClient> = {}): CRMClient {
  return {
    id: "client-1",
    name: "Cliente de prueba",
    email: "cliente@example.com",
    phone: "555-0000",
    location: "CDMX",
    notes: "",
    projects: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ProyectosTab — sección Definiciones", () => {
  it("no muestra la sección si no hay definiciones", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({ success: true, data: { definitions: [] } });
    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    await waitFor(() => expect(listClientDefinitionsActionMock).toHaveBeenCalledWith("client-1"));
    expect(screen.queryByText("Definiciones")).not.toBeInTheDocument();
    expect(screen.getByText("Nuevo Proyecto")).toBeInTheDocument();
  });

  it("muestra 'Continuar <título>' cuando hay una definición sin terminar", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({
      success: true,
      data: {
        definitions: [
          {
            id: "def-1",
            title: "Rediseño del portal",
            clientId: "client-1",
            clientName: "Cliente de prueba",
            currentStation: "mvp",
            status: "in_progress",
            proposalId: null,
            updatedAt: new Date("2026-07-15T10:00:00.000Z"),
            createdAt: new Date("2026-07-10T10:00:00.000Z"),
          },
        ],
      },
    });

    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    expect(await screen.findByText("Definiciones")).toBeInTheDocument();
    expect(screen.getByText("Rediseño del portal")).toBeInTheDocument();
    const continueLink = screen.getByRole("link", { name: /Continuar Rediseño del portal/i });
    expect(continueLink).toHaveAttribute("href", "/proyectos/definicion/def-1");
    expect(screen.getByRole("link", { name: "Nuevo Proyecto" })).toBeInTheDocument();
  });

  it("mantiene 'Nuevo Proyecto' como botón principal si todas las definiciones están completas", async () => {
    listClientDefinitionsActionMock.mockResolvedValue({
      success: true,
      data: {
        definitions: [
          {
            id: "def-1",
            title: "Ya terminado",
            clientId: "client-1",
            clientName: "Cliente de prueba",
            currentStation: "flujo",
            status: "completed",
            proposalId: "prop-1",
            updatedAt: new Date("2026-07-15T10:00:00.000Z"),
            createdAt: new Date("2026-07-10T10:00:00.000Z"),
          },
        ],
      },
    });

    render(<ProyectosTab client={buildClient()} navigateToProject={vi.fn()} setModal={vi.fn()} />);

    expect(await screen.findByText("Definiciones")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Continuar/i })).not.toBeInTheDocument();
    const primaryLink = screen.getByRole("link", { name: "Nuevo Proyecto" });
    expect(primaryLink).toHaveAttribute("href", expect.stringContaining("/proyectos/definicion/nueva"));
  });
});
