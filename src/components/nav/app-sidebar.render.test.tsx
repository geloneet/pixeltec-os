// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

/**
 * Regresión (2026-08-26) — el módulo SEO estaba registrado, sus rutas
 * respondían y los tests de taxonomía pasaban, pero **el pill nunca se
 * dibujaba**: sus destinos no estaban en `PALETTE_NAV_ITEMS`, que es donde
 * `areaItems()` los busca. Lo encontró Miguel abriendo el panel.
 *
 * Este archivo renderiza el sidebar de verdad y comprueba lo que se ve. Un
 * test sobre funciones puras no habría bastado: la cadena registro → catálogo
 * → área → pill solo se rompe al final.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/hoy",
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as { alt?: string; src?: string })} />,
}));

vi.mock("@/components/cmd-k/CmdKProvider", () => ({
  useCmdK: () => ({ open: false, setOpen: vi.fn() }),
}));

vi.mock("@/components/crm/CRMContextCore", () => ({
  useCRM: () => ({ loading: false, clients: [], tools: [], tasks: [] }),
}));

vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ profile: { name: "Miguel", role: "admin" }, isLoading: false }),
}));

import { AppSidebar } from "./app-sidebar";

afterEach(cleanup);

describe("sidebar del panel", () => {
  it("dibuja las áreas aprobadas, SEO incluida", () => {
    render(<AppSidebar />);
    for (const label of ["Inicio", "Clientes", "WhatsApp", "Finanzas", "Blog", "SEO", "Usuarios y Accesos"]) {
      expect(screen.getAllByText(label).length, `falta el área ${label}`).toBeGreaterThan(0);
    }
  });

  it("no dibuja las áreas de módulos ocultos", () => {
    render(<AppSidebar />);
    for (const label of ["Trabajo", "Marketing", "Sistema"]) {
      expect(screen.queryByText(label), `${label} no debería verse`).toBeNull();
    }
  });

  it("la marca dice PIXELTEC-OS, no solo PixelTEC", () => {
    const { container } = render(<AppSidebar />);
    expect(container.textContent).toContain("-OS");
  });
});
