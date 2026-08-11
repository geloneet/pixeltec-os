// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { CRMClient } from "@/types/crm";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { portalStatusMock } = vi.hoisted(() => ({ portalStatusMock: vi.fn() }));

// El workspace solo orquesta: los tabs pesados se sustituyen por marcadores.
vi.mock("./ClientDetail", () => ({
  ClientDetail: () => <div data-testid="tab-resumen" />,
}));
vi.mock("@/components/crm/workspace-tabs/ProyectosTab", () => ({
  ProyectosTab: () => <div data-testid="tab-proyectos" />,
}));
vi.mock("@/components/crm/workspace-tabs/ComercialTab", () => ({
  ComercialTab: (props: { initialSub?: string }) => (
    <div data-testid="tab-comercial" data-sub={props.initialSub ?? ""} />
  ),
}));
vi.mock("@/components/crm/workspace-tabs/DocumentosTab", () => ({
  DocumentosTab: () => <div data-testid="tab-documentos" />,
}));
vi.mock("@/components/crm/workspace-tabs/PortalTab", () => ({
  PortalTab: () => <div data-testid="tab-portal" />,
}));
vi.mock("@/lib/client-portal/admin-actions", () => ({
  getPortalStatusForClientAction: portalStatusMock,
}));

import { ClientWorkspace } from "./ClientWorkspace";

function buildClient(overrides: Partial<CRMClient> = {}): CRMClient {
  return {
    id: "client-1",
    name: "Cliente Demo",
    email: "demo@cliente.mx",
    phone: "",
    location: "",
    notes: "",
    projects: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const noop = () => {};

function renderWorkspace(client: CRMClient, extra: Partial<Parameters<typeof ClientWorkspace>[0]> = {}) {
  return render(
    <ClientWorkspace
      client={client}
      onBack={noop}
      navigateToProject={noop}
      setModal={noop}
      deleteClient={noop}
      {...extra}
    />
  );
}

describe("ClientWorkspace — tabs de ADR-0035", () => {
  it("muestra los 4 tabs base y oculta Portal cuando está deshabilitado", () => {
    renderWorkspace(buildClient({ portalAccessEnabled: false }));

    for (const label of ["Resumen", "Proyectos", "Comercial", "Documentos"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "Portal" })).not.toBeInTheDocument();
    // Los tabs viejos ya no existen en el nivel 1
    for (const gone of ["Propuesta", "Contratos", "Discovery", "Estrategia"]) {
      expect(screen.queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  it("muestra Portal cuando el blob trae portalAccessEnabled=true", () => {
    renderWorkspace(buildClient({ portalAccessEnabled: true }));
    expect(screen.getByRole("button", { name: "Portal" })).toBeInTheDocument();
  });

  it("blob viejo (sin campo): consulta el status y agrega Portal si procede", async () => {
    portalStatusMock.mockResolvedValue({ portalAccessEnabled: true, email: "demo@cliente.mx" });

    renderWorkspace(buildClient({ portalAccessEnabled: undefined }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Portal" })).toBeInTheDocument();
    });
    expect(portalStatusMock).toHaveBeenCalledWith("client-1");
  });

  it("deep-link a comercial abre el tab con la sub-sección pedida", () => {
    renderWorkspace(buildClient({ portalAccessEnabled: false }), {
      initialTab: "comercial",
      initialSub: "facturacion",
    });

    expect(screen.getByTestId("tab-comercial")).toHaveAttribute("data-sub", "facturacion");
  });
});
