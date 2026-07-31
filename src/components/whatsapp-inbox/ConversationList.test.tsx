// @vitest-environment jsdom
// src/components/whatsapp-inbox/ConversationList.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { InboxConversation } from "@/types/whatsapp-inbox";
import { ConversationList } from "./ConversationList";

afterEach(() => {
  cleanup();
});

function baseProps() {
  return {
    tenantId: "pixeltec",
    loading: false,
    error: null,
    contactsByPhone: new Map(),
    selectedPhone: null,
    onSelect: vi.fn(),
    category: "todos" as const,
    onCategoryChange: vi.fn(),
    quickFilter: null,
    onQuickFilterChange: vi.fn(),
  };
}

describe("ConversationList — badge de no leídos (Fase 5)", () => {
  it("muestra el contador de no leídos cuando unreadCount > 0", () => {
    const conversations: InboxConversation[] = [
      { id: "+5213221234567", lastMessagePreview: "hola", unreadCount: 3 },
    ];

    render(<ConversationList {...baseProps()} conversations={conversations} />);

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("no muestra badge cuando unreadCount es 0 o no viene", () => {
    const conversations: InboxConversation[] = [
      { id: "+5213221234567", lastMessagePreview: "hola", unreadCount: 0 },
      { id: "+5213221111111", lastMessagePreview: "hola 2" },
    ];

    render(<ConversationList {...baseProps()} conversations={conversations} />);

    expect(screen.queryByLabelText(/no leídos/i)).not.toBeInTheDocument();
  });
});

describe("ConversationList — preservación de filtros (PixelBot Console)", () => {
  const conversations: InboxConversation[] = [
    { id: "+5213221234567", lastMessagePreview: "hola", lastMessageDirection: "inbound", mode: "BOT" },
  ];

  it("expone las tres vistas rápidas y el botón Filtros", () => {
    render(<ConversationList {...baseProps()} conversations={conversations} />);
    expect(screen.getByRole("button", { name: "Sin responder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Control humano" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Urgentes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/ })).toBeInTheDocument();
  });

  it("el popover de Filtros conserva las 7 categorías y los 3 filtros restantes", () => {
    render(<ConversationList {...baseProps()} conversations={conversations} />);
    fireEvent.click(screen.getByRole("button", { name: /Filtros/ }));
    for (const cat of ["Todos", "Prospectos", "Clientes", "Soporte", "Proveedores", "Spam", "Sin clasificar"]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${cat}`) })).toBeInTheDocument();
    }
    for (const f of ["Bot respondiendo", "Nuevo", "Archivados"]) {
      expect(screen.getByRole("button", { name: f })).toBeInTheDocument();
    }
  });

  it("las vistas rápidas activan y desactivan el filtro operativo", () => {
    const props = baseProps();
    render(<ConversationList {...props} conversations={conversations} />);
    fireEvent.click(screen.getByRole("button", { name: "Sin responder" }));
    expect(props.onQuickFilterChange).toHaveBeenCalledWith("sin_responder");
  });

  it("una fila muestra como máximo dos indicadores persistentes", () => {
    const contact = new Map([
      [
        "+5213221234567",
        { id: "+5213221234567", urgent: true, status: "nuevo" as const, classification: "cliente" as const },
      ],
    ]);
    render(
      <ConversationList {...baseProps()} contactsByPhone={contact} conversations={conversations} />
    );
    // Modo (Bot) + el extra de mayor prioridad (Urgente); Nuevo y Cliente ceden.
    expect(screen.getByText("Bot")).toBeInTheDocument();
    expect(screen.getByText("Urgente")).toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente")).not.toBeInTheDocument();
  });
});
