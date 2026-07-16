// @vitest-environment jsdom
// src/components/whatsapp-inbox/ContactPanel.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { BotMemoryEntry } from "@/types/whatsapp-inbox";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { useInboxBotMemoryMock } = vi.hoisted(() => ({
  useInboxBotMemoryMock: vi.fn(),
}));

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

    expect(screen.getByText("Memoria del bot")).toBeInTheDocument();
    expect(screen.getByText("Nombre")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("Presupuesto")).toBeInTheDocument();
    expect(screen.getByText("$50,000")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando el bot no recuerda nada del contacto", () => {
    useInboxBotMemoryMock.mockReturnValue({ memory: [], loading: false, error: null, refetch: vi.fn() });

    render(<ContactPanel {...noopProps} />);

    expect(screen.getByText(/aún no recuerda datos/i)).toBeInTheDocument();
  });
});
