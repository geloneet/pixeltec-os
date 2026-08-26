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
import { CLIENT_WORKSPACE_SECTIONS, getVisibleClientSections } from "@/lib/modules/client-workspace";

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

/**
 * WO-2026-00088 §6 (revisión explícita del test de ADR-0035): el workspace
 * conserva los cinco tabs en código, pero solo muestra los que el registro
 * de secciones marca visibles. Hoy: únicamente Resumen.
 */
describe("ClientWorkspace — tabs según el registro de secciones (WO-2026-00088)", () => {
  it("el registro deja visible solo Resumen; proyectos/comercial/documentos/portal ocultos", () => {
    expect(getVisibleClientSections().map((s) => s.id)).toEqual(["resumen"]);
    expect(CLIENT_WORKSPACE_SECTIONS.map((s) => s.id)).toEqual([
      "resumen",
      "proyectos",
      "comercial",
      "documentos",
      "portal",
    ]);
  });

  it("muestra solo el tab Resumen y ninguno de los ocultos", () => {
    renderWorkspace(buildClient({ portalAccessEnabled: false }));

    expect(screen.getByRole("button", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByTestId("tab-resumen")).toBeInTheDocument();
    for (const gone of ["Proyectos", "Comercial", "Documentos", "Portal", "Propuesta", "Contratos", "Discovery", "Estrategia"]) {
      expect(screen.queryByRole("button", { name: gone })).not.toBeInTheDocument();
    }
  });

  it("Portal no aparece aunque el blob traiga portalAccessEnabled=true (sección oculta)", () => {
    renderWorkspace(buildClient({ portalAccessEnabled: true }));
    expect(screen.queryByRole("button", { name: "Portal" })).not.toBeInTheDocument();
  });

  it("blob viejo (sin campo): consulta el status pero NO agrega Portal mientras esté oculto", async () => {
    portalStatusMock.mockResolvedValue({ portalAccessEnabled: true, email: "demo@cliente.mx" });

    renderWorkspace(buildClient({ portalAccessEnabled: undefined }));

    await waitFor(() => expect(portalStatusMock).toHaveBeenCalledWith("client-1"));
    expect(screen.queryByRole("button", { name: "Portal" })).not.toBeInTheDocument();
    expect(screen.getByTestId("tab-resumen")).toBeInTheDocument();
  });

  it("deep-link a una sección oculta (comercial) cae en Resumen sin 404 ni pantalla vacía", async () => {
    renderWorkspace(buildClient({ portalAccessEnabled: false }), {
      initialTab: "comercial",
      initialSub: "facturacion",
    });

    await waitFor(() => expect(screen.getByTestId("tab-resumen")).toBeInTheDocument());
    expect(screen.queryByTestId("tab-comercial")).not.toBeInTheDocument();
  });
});
