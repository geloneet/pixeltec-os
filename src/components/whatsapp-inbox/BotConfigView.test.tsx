// @vitest-environment jsdom
// src/components/whatsapp-inbox/BotConfigView.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { BotConfig } from "@/types/whatsapp-inbox";
import { BotConfigView } from "./BotConfigView";

function buildConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  return {
    bot_name: "PixelBot",
    tone: "cercano",
    response_delay_seconds: 30,
    schedule: { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "18:00" },
    out_of_hours_message: "Fuera de horario",
    initial_message: "Hola",
    escalation_message: "Te paso con Miguel",
    can_answer: [],
    cannot_answer: [],
    escalation_rules: [],
    quote_questions: [],
    personality: {
      public_identity: "Equipo PixelTEC",
      traits: ["directa"],
      formality: "casual_profesional",
      language_variant: "es_MX",
      emoji_usage: { level: "bajo", max_count: 1, never_in: [] },
      lists_usage: "solo cuando hay pasos",
      preferred_phrases: [],
      forbidden_phrases: [],
      greeting_style: "Directo si ya hay contexto",
      farewell_style: "Breve y natural",
      error_ack_style: "Corto, sin excusas",
      ask_missing_data_style: "Un dato a la vez",
    },
    response_policy: {
      one_question_per_turn: true,
      no_repeat_greeting: true,
      no_repeat_known_data: true,
      length_preference: "1 a 3 párrafos",
      acknowledge_uncertainty: true,
      no_invent: [],
    },
    escalation: {
      confidence_threshold: 0.55,
      max_clarify_attempts: 2,
      messages: { lead: "a", escalate: "b", unknown: "c" },
      priority: "normal",
    },
    timing: {
      min_delay_seconds: 4,
      max_delay_seconds: 18,
      vary_by_length: true,
      disabled: false,
    },
    ...overrides,
  };
}

describe("BotConfigView — personalidad y comportamiento (Fase 1)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("muestra personality.public_identity al cargar la config", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ config: buildConfig() }),
    });

    render(<BotConfigView />);

    expect(await screen.findByDisplayValue("Equipo PixelTEC")).toBeInTheDocument();
  });

  it("incluye personality.public_identity editado en el PUT al guardar", async () => {
    const cfg = buildConfig();
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: cfg }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ config: cfg }) });

    render(<BotConfigView />);

    const input = await screen.findByDisplayValue("Equipo PixelTEC");
    fireEvent.change(input, { target: { value: "Equipo Nuevo" } });
    fireEvent.click(screen.getByText("Guardar cambios"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, putOptions] = fetchMock.mock.calls[1];
    const body = JSON.parse(putOptions.body as string);
    expect(body.config.personality.public_identity).toBe("Equipo Nuevo");
  });

  it("rechaza escalation.confidence_threshold fuera de 0-1 antes de guardar (no dispara el PUT)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ config: buildConfig() }) });

    render(<BotConfigView />);

    const thresholdInput = await screen.findByLabelText(/umbral de confianza/i);
    fireEvent.change(thresholdInput, { target: { value: "1.5" } });
    fireEvent.click(screen.getByText("Guardar cambios"));

    // Solo el GET inicial — la validación de cliente debe frenar el PUT.
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
