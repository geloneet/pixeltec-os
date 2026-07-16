// @vitest-environment jsdom
// src/components/whatsapp-inbox/InboxShell.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InboxConversation } from "@/types/whatsapp-inbox";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const { refetchConversationsMock, refetchContactsMock } = vi.hoisted(() => ({
  refetchConversationsMock: vi.fn(),
  refetchContactsMock: vi.fn(),
}));

let mockConversations: InboxConversation[] = [];

vi.mock("@/hooks/use-inbox-contacts", () => ({
  useInboxContacts: () => ({ contactsByPhone: new Map(), refetch: refetchContactsMock }),
}));
vi.mock("@/hooks/use-inbox-conversations", () => ({
  useInboxConversations: () => ({
    conversations: mockConversations,
    loading: false,
    error: null,
    refetch: refetchConversationsMock,
  }),
}));
vi.mock("./ChatThread", () => ({ ChatThread: ({ phone }: { phone: string }) => <div>hilo: {phone}</div> }));
vi.mock("./ContactPanel", () => ({ ContactPanel: () => <div>panel</div> }));

import { InboxShell } from "./InboxShell";

describe("InboxShell — marca como leída al abrir un hilo (Fase 5)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("llama a /api/whatsapp-inbox/conversations/read al abrir una conversación con no leídos", async () => {
    mockConversations = [
      { id: "+5213221234567", lastMessagePreview: "hola", unreadCount: 3 },
    ];
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok", unreadCount: 0 }),
    });

    render(<InboxShell tenantId="pixeltec" onOpenConfig={vi.fn()} />);

    fireEvent.click(screen.getByText("+5213221234567"));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url, options] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/whatsapp-inbox/conversations/read");
    expect(JSON.parse(options.body as string)).toEqual({ phone: "+5213221234567" });

    await waitFor(() => expect(refetchConversationsMock).toHaveBeenCalled());
  });

  it("no llama al endpoint si la conversación ya no tiene no leídos", async () => {
    mockConversations = [{ id: "+5213221111111", lastMessagePreview: "hola", unreadCount: 0 }];

    render(<InboxShell tenantId="pixeltec" onOpenConfig={vi.fn()} />);

    fireEvent.click(screen.getByText("+5213221111111"));

    await screen.findByText("hilo: +5213221111111");
    expect(fetch).not.toHaveBeenCalled();
  });
});
