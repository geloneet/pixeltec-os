// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { CRMClient } from "@/types/crm";

/**
 * WO-2026-00088 §6 — regresión: guardar la INFORMACIÓN GENERAL de un cliente
 * (Editar cliente: empresa, contacto, teléfono, email, ubicación, notas) no
 * elimina ni sobrescribe los datos de las secciones ocultas (proyectos con
 * tareas y cobros, portal, estrategia, estado comercial, próxima acción,
 * expediente documental).
 *
 * Dos capas: (1) comportamiento real del CRMProvider (merge parcial +
 * payload que viaja a syncCrmDataAction); (2) contrato a nivel de fuente
 * sobre el formulario y el upsert de Postgres (campos que NO entran al `set`).
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

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const USER = { uid: "u1", email: "u@pixeltec.mx", displayName: "U", photoURL: null };

function buildClientWithHiddenData(): CRMClient {
  return {
    id: "c1",
    name: "Villa Nogal",
    contactName: "Aidee",
    email: "hola@villanogal.mx",
    phone: "+52 322 000 0000",
    location: "Puerto Vallarta",
    notes: "nota original",
    createdAt: "2026-08-01T00:00:00.000Z",
    // ── secciones ocultas / server-owned ───────────────────────────────────
    projects: [
      {
        id: "p1",
        name: "Sitio web",
        domain: "villanogal.mx",
        budget: 25000,
        annual: 6000,
        budgetIva: "plus",
        annualIva: "none",
        tech: "Next",
        keys: [{ id: "k1", label: "cPanel", value: "secreto-demo" }],
        guides: "guía",
        accounts: "cuentas",
        readme: "readme",
        prompt: "prompt",
        quickNotes: "quick",
        notesLog: [{ id: "n1", category: "General", content: "log", authorName: "U", createdAt: "2026-08-02T00:00:00.000Z" }],
        tasks: [{ id: "t1", name: "Tarea", desc: "", status: "pendiente", prio: "low", createdAt: "2026-08-02T00:00:00.000Z", pomoSessions: 0 }],
        charges: [{ id: "ch1", concept: "Hosting", amount: "500", frequency: "monthly", startDate: "2026-08-01", clientEmail: "hola@villanogal.mx", active: true, createdAt: "2026-08-01T00:00:00.000Z" }],
        createdAt: "2026-08-01T00:00:00.000Z",
        contractId: "ctr-1",
      },
    ],
    portalToken: "tok-demo",
    portalEnabled: true,
    strategyId: "strat-1",
    crmStatus: "activo",
    nextAction: { label: "Llamar", dueAt: null },
    portalAccessEnabled: true,
  };
}

let api: ReturnType<typeof useCRM> | null = null;
function Probe() {
  api = useCRM();
  return <div data-testid="probe">{api.loading ? "cargando" : `clientes:${api.clients.length}`}</div>;
}

beforeEach(() => {
  api = null;
  crmActions.getCrmDataAction.mockReset().mockResolvedValue({
    clients: [buildClientWithHiddenData()],
    tools: [],
    streak: 0,
    serverLinks: {},
    sessions: [],
  });
  crmActions.syncCrmDataAction.mockReset().mockResolvedValue({ ok: true });
  toastMock.error.mockReset();
  useUserMock.mockReset().mockReturnValue(USER);
  useUserProfileMock.mockReset().mockReturnValue({ userProfile: { uid: "u1", role: "admin" }, loading: false });
});
afterEach(() => cleanup());

describe("guardar información general conserva los datos de secciones ocultas", () => {
  it("updateClient con solo campos generales → el cliente sincronizado conserva proyectos, tareas, cobros, portal, estrategia, estado y próxima acción", async () => {
    const { getByTestId } = render(
      <CRMProvider>
        <Probe />
      </CRMProvider>
    );
    await waitFor(() => expect(getByTestId("probe").textContent).toBe("clientes:1"));

    // Exactamente lo que envía el modal «Editar cliente» (CRMShellProvider → editClient).
    await act(async () => {
      api!.updateClient("c1", {
        name: "Villa Nogal SA",
        contactName: undefined,
        email: "nuevo@villanogal.mx",
        phone: "+52 322 111 1111",
        location: "Nuevo Vallarta",
        notes: "nota editada",
      });
      await api!.flushSave();
    });

    expect(crmActions.syncCrmDataAction).toHaveBeenCalledTimes(1);
    const payload = crmActions.syncCrmDataAction.mock.calls[0][0] as { clients?: CRMClient[] };
    expect(payload.clients).toHaveLength(1);
    const saved = payload.clients![0];
    const original = buildClientWithHiddenData();

    // Información general: actualizada.
    expect(saved.name).toBe("Villa Nogal SA");
    expect(saved.email).toBe("nuevo@villanogal.mx");
    expect(saved.notes).toBe("nota editada");

    // Secciones ocultas: intactas, byte a byte.
    expect(saved.projects).toEqual(original.projects);
    expect(saved.projects[0].tasks).toHaveLength(1);
    expect(saved.projects[0].charges).toHaveLength(1);
    expect(saved.projects[0].keys).toEqual(original.projects[0].keys);
    expect(saved.projects[0].contractId).toBe("ctr-1");
    expect(saved.portalToken).toBe("tok-demo");
    expect(saved.portalEnabled).toBe(true);
    expect(saved.strategyId).toBe("strat-1");
    expect(saved.crmStatus).toBe("activo");
    expect(saved.nextAction).toEqual({ label: "Llamar", dueAt: null });
    expect(saved.portalAccessEnabled).toBe(true);

    // Y en memoria el provider tampoco perdió nada.
    expect(api!.clients[0].projects).toEqual(original.projects);
  });
});

describe("contrato a nivel de fuente (no se envían campos ocultos vacíos)", () => {
  const shell = fs.readFileSync(path.join(REPO_ROOT, "src/components/crm/CRMShellProvider.tsx"), "utf8");
  const sync = fs.readFileSync(path.join(REPO_ROOT, "src/lib/db/repos/crm-sync.ts"), "utf8");
  const core = fs.readFileSync(path.join(REPO_ROOT, "src/components/crm/CRMContextCore.tsx"), "utf8");

  it("el modal Editar cliente solo manda los 6 campos de información general", () => {
    const start = shell.indexOf('case "editClient": {');
    const end = shell.indexOf('case "addProject":', start);
    const block = shell.slice(start, end);
    const fields = [...block.matchAll(/^\s*(\w+): val\("(\w+)"\)/gm)].map((m) => m[1]);
    expect(fields.sort()).toEqual(["contactName", "email", "location", "name", "notes", "phone"].sort());
    for (const hidden of ["projects", "portalToken", "portalEnabled", "strategyId", "documents", "crmStatus", "nextAction"]) {
      expect(block, `editClient no debe mandar ${hidden}`).not.toMatch(new RegExp(`^\\s*${hidden}:`, "m"));
    }
  });

  it("updateClient hace merge parcial ({ ...c, ...data }), nunca reemplazo", () => {
    expect(core).toMatch(/const updateClient = useCallback\(\(id: string, data: Partial<CRMClient>\) => \{\s*const next = dataRef\.current\.clients\.map\(c => c\.id === id \? \{ \.\.\.c, \.\.\.data \} : c\);/);
  });

  it("el upsert de clients en Postgres no toca documents, crm_status, next_action ni strategy (ADR-0035 + §6)", () => {
    const start = sync.indexOf("export async function syncCrmClients");
    const setStart = sync.indexOf(".onConflictDoUpdate({", start);
    const setEnd = sync.indexOf(".returning(", setStart);
    const setBlock = sync.slice(setStart, setEnd);
    for (const col of ["documents", "crmStatus", "nextAction", "strategyId", "portalAccessEnabled"]) {
      expect(setBlock, `set del upsert no debe incluir ${col}`).not.toContain(`${col}:`);
    }
    expect(setBlock).toContain("name: c.name");
    expect(setBlock).toContain("notes: c.notes");
  });
});
