// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AccountResponse, TemplatesResponse } from "@/lib/whatsapp/management-types";

const { toastSuccessMock } = vi.hoisted(() => ({ toastSuccessMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: vi.fn(), warning: vi.fn() },
}));

import { AccountView } from "./AccountView";

/** Respuesta HTTP mínima con la forma que consumen los hooks. */
function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const ACCOUNT_OK: AccountResponse = {
  configured: true,
  phone: {
    id: "123",
    displayPhoneNumber: "+52 1 322 137 8336",
    verifiedName: "PixelTEC",
    qualityRating: "GREEN",
    nameStatus: "APPROVED",
    codeVerificationStatus: "VERIFIED",
    messagingLimitTier: "TIER_1K",
    platformType: "CLOUD_API",
  },
  profile: {
    about: "Automatización y sitios web",
    address: "Puerto Vallarta, Jalisco",
    description: "Estudio de software",
    email: "hola@pixeltec.mx",
    profilePictureUrl: null,
    websites: ["https://pixeltec.mx"],
    vertical: "PROF_SERVICES",
  },
};

const TEMPLATES_OK: TemplatesResponse = {
  configured: true,
  templates: [
    {
      id: "t1",
      name: "confirmacion_de_cita",
      language: "es_MX",
      status: "APPROVED",
      category: "UTILITY",
      components: [{ type: "BODY", format: null, text: "Hola {{1}}, tu cita quedó confirmada." }],
      rejectedReason: null,
      qualityScore: null,
    },
    {
      id: "t2",
      name: "promo_septiembre",
      language: "es",
      status: "REJECTED",
      category: "MARKETING",
      components: [{ type: "BODY", format: null, text: "Promo de septiembre" }],
      rejectedReason: "INVALID_FORMAT",
      qualityScore: null,
    },
  ],
};

let fetchMock: ReturnType<typeof vi.fn>;

/** Enruta por URL: los dos hooks piden en paralelo y el orden no es estable. */
function stubFetch(routes: { account?: unknown; templates?: unknown; post?: unknown }) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/whatsapp-inbox/account")) return routes.account;
    if (init?.method === "POST") return routes.post;
    return routes.templates;
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  toastSuccessMock.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AccountView — estado «no configurado» (WO-2026-00181)", () => {
  it("declara las variables de entorno que faltan sin parecer una app rota", async () => {
    stubFetch({
      account: json({ configured: false, missing: ["WHATSAPP_BUSINESS_ACCOUNT_ID", "WHATSAPP_ACCESS_TOKEN"] }),
      templates: json({ configured: false, missing: ["WHATSAPP_BUSINESS_ACCOUNT_ID"], templates: [] }),
    });

    render(<AccountView />);

    expect(await screen.findByText("Cuenta no configurada")).toBeInTheDocument();
    expect(screen.getByText("WHATSAPP_BUSINESS_ACCOUNT_ID")).toBeInTheDocument();
    expect(screen.getByText("WHATSAPP_ACCESS_TOKEN")).toBeInTheDocument();
    // Nada de plantillas ni de número: no hay dato que enseñar.
    expect(screen.queryByText("Plantillas de mensaje")).not.toBeInTheDocument();
  });
});

describe("AccountView — datos de la cuenta", () => {
  beforeEach(() => {
    stubFetch({ account: json(ACCOUNT_OK), templates: json(TEMPLATES_OK) });
  });

  it("pinta número, calidad, límite de mensajería y estado del nombre", async () => {
    render(<AccountView />);

    expect(await screen.findByText("+52 1 322 137 8336")).toBeInTheDocument();
    expect(screen.getByText("PixelTEC")).toBeInTheDocument();
    expect(screen.getByText("Alta")).toBeInTheDocument(); // GREEN
    expect(screen.getByText("1 000 conversaciones / 24 h")).toBeInTheDocument();
    expect(screen.getByText("Aprobado")).toBeInTheDocument(); // name_status
    expect(screen.getByText("Verificado")).toBeInTheDocument();
  });

  it("pinta el perfil de empresa en solo lectura", async () => {
    render(<AccountView />);

    expect(await screen.findByText("Perfil de empresa")).toBeInTheDocument();
    expect(screen.getByText("Automatización y sitios web")).toBeInTheDocument();
    expect(screen.getByText("hola@pixeltec.mx")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://pixeltec.mx" })).toBeInTheDocument();
    expect(screen.getByText("Servicios profesionales")).toBeInTheDocument();
  });

  it("lista las plantillas con estado traducido y el motivo del rechazo", async () => {
    render(<AccountView />);

    expect(await screen.findByText("confirmacion_de_cita")).toBeInTheDocument();
    expect(screen.getByText("Aprobada")).toBeInTheDocument();
    expect(screen.getByText("Rechazada")).toBeInTheDocument();
    expect(screen.getByText(/Motivo del rechazo: INVALID_FORMAT/)).toBeInTheDocument();
    expect(screen.getByText("Hola {{1}}, tu cita quedó confirmada.")).toBeInTheDocument();
    expect(screen.getByText("es_MX · Utilidad")).toBeInTheDocument();
  });
});

describe("AccountView — error saneado", () => {
  it("muestra el texto del backend y ofrece reintentar", async () => {
    stubFetch({
      account: json({ error: "No se pudo leer el número de WhatsApp.", code: "meta_error" }, 502),
      templates: json({ configured: true, templates: [] }),
    });

    render(<AccountView />);

    expect(await screen.findByText("No se pudo leer la cuenta")).toBeInTheDocument();
    expect(screen.getByText("No se pudo leer el número de WhatsApp.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/ })).toBeInTheDocument();
    // El fallo de una lectura no tumba la otra: las plantillas siguen ahí.
    expect(screen.getByText("Plantillas de mensaje")).toBeInTheDocument();
  });
});

describe("AccountView — alta de plantilla (whatsapp_business_management)", () => {
  it("envía el contrato esperado, avisa y refetchea la lista", async () => {
    stubFetch({
      account: json(ACCOUNT_OK),
      templates: json({ configured: true, templates: [] }),
      post: json({ id: "t9", status: "PENDING", name: "recordatorio_cita" }, 201),
    });

    render(<AccountView />);
    fireEvent.click(await screen.findByRole("button", { name: /Nueva plantilla/ }));

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "recordatorio_cita" } });
    fireEvent.change(screen.getByLabelText("Cuerpo"), {
      target: { value: "Hola {{1}}, te esperamos el {{2}}." },
    });
    // Los campos de ejemplo aparecen solos al detectar las variables del cuerpo.
    fireEvent.change(screen.getByLabelText("Ejemplo para {{1}}"), { target: { value: "Miguel" } });
    fireEvent.change(screen.getByLabelText("Ejemplo para {{2}}"), { target: { value: "12 de marzo" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "MARKETING" } });
    fireEvent.change(screen.getByLabelText("Pie (opcional)"), { target: { value: "PixelTEC" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Plantilla enviada a revisión de Meta"));

    const post = fetchMock.mock.calls.find((call) => (call[1] as RequestInit | undefined)?.method === "POST");
    expect(post).toBeDefined();
    expect(post?.[0]).toBe("/api/whatsapp-inbox/templates");
    expect(JSON.parse(String((post?.[1] as RequestInit).body))).toEqual({
      name: "recordatorio_cita",
      language: "es_MX",
      category: "MARKETING",
      body: "Hola {{1}}, te esperamos el {{2}}.",
      examples: ["Miguel", "12 de marzo"],
      footer: "PixelTEC",
    });

    // Se cierra y vuelve a leer la lista (el GET de plantillas corre dos veces).
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const templateGets = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/whatsapp-inbox/templates" && (call[1] as RequestInit | undefined)?.method !== "POST"
    );
    expect(templateGets.length).toBe(2);
  });

  it("valida en el cliente antes de llamar a Meta", async () => {
    stubFetch({ account: json(ACCOUNT_OK), templates: json({ configured: true, templates: [] }) });

    render(<AccountView />);
    fireEvent.click(await screen.findByRole("button", { name: /Nueva plantilla/ }));

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nombre Inválido" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/minúsculas, números y guion bajo/);
    expect(alert).toHaveTextContent(/El cuerpo no puede estar vacío/);
    expect(fetchMock.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toBe(false);
  });

  it("muestra todos los `details[]` de un 400 invalid_template", async () => {
    stubFetch({
      account: json(ACCOUNT_OK),
      templates: json({ configured: true, templates: [] }),
      post: json(
        {
          error: "La plantilla no es válida.",
          code: "invalid_template",
          details: ["El nombre ya existe.", "El cuerpo excede 1024 caracteres."],
        },
        400
      ),
    });

    render(<AccountView />);
    fireEvent.click(await screen.findByRole("button", { name: /Nueva plantilla/ }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "duplicada" } });
    fireEvent.change(screen.getByLabelText("Cuerpo"), { target: { value: "Sin variables." } });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El nombre ya existe.");
    expect(alert).toHaveTextContent("El cuerpo excede 1024 caracteres.");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });
});
