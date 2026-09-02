// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const { useIsRestrictedRoleMock, useWhatsAppAccountMock } = vi.hoisted(() => ({
  useIsRestrictedRoleMock: vi.fn(),
  useWhatsAppAccountMock: vi.fn(),
}));

vi.mock("@/hooks/use-restricted-role", () => ({ useIsRestrictedRole: useIsRestrictedRoleMock }));
vi.mock("@/hooks/use-whatsapp-account", () => ({ useWhatsAppAccount: useWhatsAppAccountMock }));

import { ReviewerGuide } from "./ReviewerGuide";

const DISMISS_KEY = "wa-reviewer-guide-dismissed";

beforeEach(() => {
  useIsRestrictedRoleMock.mockReturnValue(true);
  useWhatsAppAccountMock.mockReturnValue({
    account: { configured: true, phone: { displayPhoneNumber: "+52 1 322 137 8336" } },
    loading: false,
    error: null,
    refetch: vi.fn(),
  });
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReviewerGuide — guía en inglés para el revisor de Meta (WO-2026-00181)", () => {
  it("con rol restringido explica el flujo de los dos permisos", () => {
    render(<ReviewerGuide />);

    const region = screen.getByRole("region", { name: "Reviewer guide" });
    expect(region).toBeInTheDocument();
    expect(screen.getByText("whatsapp_business_messaging")).toBeInTheDocument();
    expect(screen.getByText("whatsapp_business_management")).toBeInTheDocument();
    expect(region).toHaveTextContent(/Take control/);
    expect(region).toHaveTextContent(/New template/);
  });

  it("muestra el número de negocio que el revisor debe escribir desde su WhatsApp", () => {
    render(<ReviewerGuide />);
    expect(screen.getByRole("region", { name: "Reviewer guide" })).toHaveTextContent(
      /Message this number from your WhatsApp/
    );
    expect(screen.getByText("+52 1 322 137 8336")).toBeInTheDocument();
  });

  it("omite el número cuando la cuenta no está configurada, sin romper el banner", () => {
    useWhatsAppAccountMock.mockReturnValue({
      account: { configured: false, missing: ["WHATSAPP_BUSINESS_ACCOUNT_ID"] },
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<ReviewerGuide />);

    expect(screen.getByRole("region", { name: "Reviewer guide" })).toBeInTheDocument();
    expect(screen.queryByText(/Message this number/)).not.toBeInTheDocument();
  });

  it("incluye el glosario ES→EN de los controles que el revisor verá en pantalla", () => {
    render(<ReviewerGuide />);
    const region = screen.getByRole("region", { name: "Reviewer guide" });
    for (const pair of ["Bandeja = Inbox", "Cuenta = Account", "Enviar = Send", "Crear = Create"]) {
      expect(region).toHaveTextContent(pair);
    }
  });

  it("se descarta y recuerda el descarte en sessionStorage", () => {
    render(<ReviewerGuide />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss reviewer guide" }));

    expect(screen.queryByRole("region", { name: "Reviewer guide" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(DISMISS_KEY)).toBe("1");
  });

  it("no vuelve a aparecer si ya se descartó en esta sesión", () => {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
    render(<ReviewerGuide />);
    expect(screen.queryByRole("region", { name: "Reviewer guide" })).not.toBeInTheDocument();
  });

  it("admin/staff no la ven — y no se dispara la lectura de la cuenta", () => {
    useIsRestrictedRoleMock.mockReturnValue(false);
    render(<ReviewerGuide />);

    expect(screen.queryByRole("region", { name: "Reviewer guide" })).not.toBeInTheDocument();
    expect(useWhatsAppAccountMock).not.toHaveBeenCalled();
  });

  it("con la sesión cargando (undefined) tampoco se pinta", () => {
    useIsRestrictedRoleMock.mockReturnValue(undefined);
    render(<ReviewerGuide />);
    expect(screen.queryByRole("region", { name: "Reviewer guide" })).not.toBeInTheDocument();
  });
});
