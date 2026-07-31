// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WhatsAppModule } from "./WhatsAppModule";

// El shell solo orquesta navegación; las vistas se prueban en sus propios tests.
vi.mock("./InboxShell", () => ({ InboxShell: () => <div>vista: bandeja</div> }));
vi.mock("./BotConfigView", () => ({ BotConfigView: () => <div>vista: bot</div> }));
vi.mock("./ExamplesView", () => ({ ExamplesView: () => <div>vista: entrenamiento</div> }));
vi.mock("./ConfigVersionsPanel", () => ({ ConfigVersionsPanel: () => <div>vista: pruebas</div> }));

afterEach(() => {
  cleanup();
});

describe("WhatsAppModule — shell de PixelBot Console", () => {
  it("muestra la navegación por objetivo: Bandeja, Bot, Entrenamiento, Pruebas", () => {
    render(<WhatsAppModule tenantId="tenant-test" />);
    for (const label of ["Bandeja", "Bot", "Entrenamiento", "Pruebas"]) {
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
});
