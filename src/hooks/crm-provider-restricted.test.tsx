// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";

/**
 * (Vive en src/hooks/ por el alcance del WO; prueba CRMProvider + useIsRestrictedRole.)
 *
 * WO-2026-00055: CRMProvider (montado por el layout admin en TODAS las
 * páginas, incluida /whatsapp) llamaba `getCrmDataAction()` al montar. Para
 * un rol restringido el middleware responde 403 → «Error al cargar datos del
 * CRM» en toast + «Error loading CRM data» en consola. Con este cambio el
 * provider no pide nada y queda vacío e inerte. Admin y staff: igual que hoy.
 */
const { crmActions, useUserMock, useUserProfileMock, toastMock } = vi.hoisted(() => ({
  crmActions: {
    getCrmDataAction: vi.fn(),
    syncCrmDataAction: vi.fn(),
    setClientStatusAction: vi.fn(),
    setClientNextActionAction: vi.fn(),
  },
  useUserMock: vi.fn(),
  useUserProfileMock: vi.fn(),
  toastMock: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("@/components/crm/crm-actions", () => crmActions);
vi.mock("@/hooks/use-user", () => ({ useUser: useUserMock }));
vi.mock("@/hooks/use-user-profile", () => ({ useUserProfile: useUserProfileMock }));
vi.mock("sonner", () => ({ toast: toastMock }));

import { CRMProvider, useCRM } from "@/components/crm/CRMContextCore";

const USER = { uid: "u1", email: "u@pixeltec.mx", displayName: "U", photoURL: null };
const DATA = { clients: [{ id: "c1", name: "Cliente", projects: [] }], tools: [], streak: 3, serverLinks: {}, sessions: [] };

function Probe() {
  const { clients, loading } = useCRM();
  return <div data-testid="probe">{loading ? "cargando" : `clientes:${clients.length}`}</div>;
}

beforeEach(() => {
  crmActions.getCrmDataAction.mockReset().mockResolvedValue(DATA);
  toastMock.error.mockReset();
  useUserMock.mockReset().mockReturnValue(USER);
  useUserProfileMock.mockReset();
});
afterEach(() => cleanup());

describe("CRMProvider — rol restringido (WO-2026-00055)", () => {
  it("reviewer: no llama getCrmDataAction, no muestra toast, provee estado vacío con loading=false", async () => {
    useUserProfileMock.mockReturnValue({ userProfile: { uid: "u1", role: "reviewer" }, loading: false });
    const { getByTestId } = render(
      <CRMProvider>
        <Probe />
      </CRMProvider>
    );
    await waitFor(() => expect(getByTestId("probe").textContent).toBe("clientes:0"));
    expect(crmActions.getCrmDataAction).not.toHaveBeenCalled();
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("sesión cargando (rol aún desconocido): espera, no llama", async () => {
    useUserProfileMock.mockReturnValue({ userProfile: null, loading: true });
    const { getByTestId } = render(
      <CRMProvider>
        <Probe />
      </CRMProvider>
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(getByTestId("probe").textContent).toBe("cargando");
    expect(crmActions.getCrmDataAction).not.toHaveBeenCalled();
  });

  it.each(["admin", "staff"])("%s: carga el CRM como hoy", async (role) => {
    useUserProfileMock.mockReturnValue({ userProfile: { uid: "u1", role }, loading: false });
    const { getByTestId } = render(
      <CRMProvider>
        <Probe />
      </CRMProvider>
    );
    await waitFor(() => expect(getByTestId("probe").textContent).toBe("clientes:1"));
    expect(crmActions.getCrmDataAction).toHaveBeenCalledTimes(1);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("admin: si la carga falla, el toast de error sigue apareciendo (comportamiento previo)", async () => {
    useUserProfileMock.mockReturnValue({ userProfile: { uid: "u1", role: "admin" }, loading: false });
    crmActions.getCrmDataAction.mockRejectedValue(new Error("boom"));
    render(
      <CRMProvider>
        <Probe />
      </CRMProvider>
    );
    await waitFor(() => expect(toastMock.error).toHaveBeenCalled());
  });
});
