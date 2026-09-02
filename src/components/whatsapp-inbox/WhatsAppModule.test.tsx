// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// El shell solo orquesta navegación; las vistas se prueban en sus propios tests.
vi.mock("./InboxShell", () => ({ InboxShell: () => <div>vista: bandeja</div> }));
vi.mock("./AccountView", () => ({ AccountView: () => <div>vista: cuenta</div> }));
vi.mock("./ReviewerGuide", () => ({ ReviewerGuide: () => <div>guía del revisor</div> }));
vi.mock("./BotConfigView", () => ({ BotConfigView: () => <div>vista: bot</div> }));
vi.mock("./ExamplesView", () => ({ ExamplesView: () => <div>vista: entrenamiento</div> }));
vi.mock("./ConfigVersionsPanel", () => ({ ConfigVersionsPanel: () => <div>vista: pruebas</div> }));

const { useIsRestrictedRoleMock } = vi.hoisted(() => ({ useIsRestrictedRoleMock: vi.fn() }));
vi.mock("@/hooks/use-restricted-role", () => ({ useIsRestrictedRole: useIsRestrictedRoleMock }));

import { WhatsAppModule } from "./WhatsAppModule";

beforeEach(() => {
  // Admin por defecto: el comportamiento histórico del módulo.
  useIsRestrictedRoleMock.mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WhatsAppModule — shell de PixelBot Console", () => {
  it("muestra la navegación por objetivo: Bandeja, Cuenta, Bot, Entrenamiento, Pruebas", () => {
    render(<WhatsAppModule tenantId="tenant-test" />);
    for (const label of ["Bandeja", "Cuenta", "Bot", "Entrenamiento", "Pruebas"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    // La jerga vieja desaparece del recorrido principal (§9).
    expect(screen.queryByText("Versiones y playground")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inbox" })).not.toBeInTheDocument();
  });

  it("marca la tab activa con aria-current y permite cambiar de sección", () => {
    render(<WhatsAppModule tenantId="tenant-test" />);
    expect(screen.getByRole("button", { name: "Bandeja" })).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: "Entrenamiento" }));
    expect(screen.getByRole("button", { name: "Entrenamiento" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Bandeja" })).not.toHaveAttribute("aria-current");
  });

  it("la pestaña Cuenta abre AccountView", () => {
    render(<WhatsAppModule tenantId="tenant-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Cuenta" }));
    expect(screen.getByText("vista: cuenta")).toBeInTheDocument();
  });
});

describe("WhatsAppModule — pestañas por rol (WO-2026-00181)", () => {
  it("rol restringido: solo Bandeja y Cuenta, ninguna sección que devolvería 403", () => {
    useIsRestrictedRoleMock.mockReturnValue(true);
    render(<WhatsAppModule tenantId="tenant-test" />);

    expect(screen.getByRole("button", { name: "Bandeja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
    for (const label of ["Bot", "Entrenamiento", "Pruebas"]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
  });

  it("sesión cargando (undefined): fail-closed — se dibuja el juego reducido, sin parpadeo", () => {
    useIsRestrictedRoleMock.mockReturnValue(undefined);
    render(<WhatsAppModule tenantId="tenant-test" />);

    expect(screen.getByRole("button", { name: "Bandeja" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bot" })).not.toBeInTheDocument();
  });

  it("admin: conserva las cinco pestañas (regresión)", () => {
    useIsRestrictedRoleMock.mockReturnValue(false);
    render(<WhatsAppModule tenantId="tenant-test" />);
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });
});
