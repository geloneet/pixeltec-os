// @vitest-environment jsdom
// src/components/whatsapp-inbox/ConversationList.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
