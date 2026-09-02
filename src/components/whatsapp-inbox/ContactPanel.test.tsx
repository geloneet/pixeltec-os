// @vitest-environment jsdom
// src/components/whatsapp-inbox/ContactPanel.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BotMemoryEntry } from "@/types/whatsapp-inbox";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { useInboxBotMemoryMock } = vi.hoisted(() => ({
  useInboxBotMemoryMock: vi.fn(),
}));

const { useIsRestrictedRoleMock } = vi.hoisted(() => ({ useIsRestrictedRoleMock: vi.fn() }));
vi.mock("@/hooks/use-restricted-role", () => ({ useIsRestrictedRole: useIsRestrictedRoleMock }));

beforeEach(() => {
  // Admin por defecto: comportamiento histórico de la ficha.
  useIsRestrictedRoleMock.mockReturnValue(false);
});

vi.mock("@/hooks/use-user", () => ({
  useUser: () => ({ uid: "admin-1", email: "admin@pixeltec.mx" }),
}));
vi.mock("@/components/crm/CRMContextCore", () => ({
  useCRM: () => ({ clients: [], addClient: vi.fn(), addTask: vi.fn() }),
}));
vi.mock("@/hooks/use-inbox-contact-notes", () => ({
  useInboxContactNotes: () => ({ notes: [], refetch: vi.fn() }),
}));
vi.mock("@/hooks/use-inbox-bot-memory", () => ({
  useInboxBotMemory: useInboxBotMemoryMock,
}));
vi.mock("@/lib/whatsapp-inbox/contacts-client", () => ({
  addContactNote: vi.fn(),
  createWhatsappTicket: vi.fn(),
  upsertContact: vi.fn(),
}));

import { ContactPanel } from "./ContactPanel";

const noopProps = {
  tenantId: "pixeltec",
  phone: "+5213221234567",
  onClose: vi.fn(),
  onModeChanged: vi.fn(),
  refetchContacts: vi.fn(),
};

describe("ContactPanel — memoria del bot (Fase 2)", () => {
  it("muestra los hechos recordados con su etiqueta en español", () => {
    const memory: BotMemoryEntry[] = [
      { key: "name", value: "Juan Pérez", source: "customer", confidence: 0.9, expires_at: null, updated_at: "2026-07-11T18:30:00" },
      { key: "budget", value: "$50,000", source: "inferred", confidence: 0.6, expires_at: null, updated_at: "2026-07-11T18:31:00" },
    ];
    useInboxBotMemoryMock.mockReturnValue({ memory, loading: false, error: null, refetch: vi.fn() });

    render(<ContactPanel {...noopProps} />);
    fireEvent.click(screen.getByRole("tab", { name: "Bot" }));

    expect(screen.getByText("Memoria del bot")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Presupuesto")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando el bot no recuerda nada del contacto", () => {
    useInboxBotMemoryMock.mockReturnValue({ memory: [], loading: false, error: null, refetch: vi.fn() });

    render(<ContactPanel {...noopProps} />);
    fireEvent.click(screen.getByRole("tab", { name: "Bot" }));

    expect(screen.getByText(/aún no recuerda datos/i)).toBeInTheDocument();
  });
});

describe("ContactPanel — ficha tabulada (PixelBot Console, §8.7)", () => {
  it("expone las tres tabs Perfil / Bot / Actividad", () => {
    useInboxBotMemoryMock.mockReturnValue({ memory: [], loading: false, error: null, refetch: vi.fn() });
    render(<ContactPanel {...noopProps} />);
    expect(screen.getByRole("tab", { name: "Perfil" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Bot" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Actividad" })).toBeInTheDocument();
  });

  it("NO renderiza un segundo control de automatización: solo resumen de estado", () => {
    useInboxBotMemoryMock.mockReturnValue({ memory: [], loading: false, error: null, refetch: vi.fn() });
    render(<ContactPanel {...noopProps} conv={{ id: "+5213221234567", mode: "BOT" }} />);
    fireEvent.click(screen.getByRole("tab", { name: "Bot" }));
    // Badge de solo lectura con el estado…
    expect(screen.getByText("Bot respondiendo")).toBeInTheDocument();
    // …pero ninguna acción de cambio de modo (viven solo en el hilo).
    expect(screen.queryByText("Tomar control")).not.toBeInTheDocument();
    expect(screen.queryByText("Devolver al bot")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Pausar/)).not.toBeInTheDocument();
  });

  it("Resolver y Archivar viven en el menú secundario, no como botones primarios", () => {
    useInboxBotMemoryMock.mockReturnValue({ memory: [], loading: false, error: null, refetch: vi.fn() });
    render(<ContactPanel {...noopProps} />);
    expect(screen.queryByText("Marcar como resuelto")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("button", { name: "Más acciones" }), { key: "Enter" });
    expect(screen.getByText("Marcar como resuelto")).toBeInTheDocument();
    expect(screen.getByText("Archivar")).toBeInTheDocument();
  });
});

describe("ContactPanel — modo revisor (WO-2026-00181)", () => {
  const emptyMemory = { memory: [], loading: false, error: null, refetch: vi.fn() };

  it("rol restringido: sin «Guardar contacto», sin ticket y sin nota rápida; la ficha sigue legible", () => {
    useInboxBotMemoryMock.mockReturnValue(emptyMemory);
    useIsRestrictedRoleMock.mockReturnValue(true);
    render(<ContactPanel {...noopProps} />);

    expect(screen.queryByRole("button", { name: /Guardar contacto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear ticket de soporte/ })).not.toBeInTheDocument();
    expect(screen.queryByText("CRM")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    expect(screen.queryByLabelText("Nota rápida")).not.toBeInTheDocument();
    expect(screen.getByText("Historial")).toBeInTheDocument();
  });

  it("admin/staff: los controles de CRM y la nota rápida siguen presentes", () => {
    useInboxBotMemoryMock.mockReturnValue(emptyMemory);
    render(<ContactPanel {...noopProps} />);

    expect(screen.getByRole("button", { name: /Guardar contacto/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear ticket de soporte/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    expect(screen.getByLabelText("Nota rápida")).toBeInTheDocument();
  });
});
