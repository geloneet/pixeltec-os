import { describe, expect, it } from "vitest";
import type { CRMClient, CRMProject, CRMTask } from "@/types/crm";
import {
  deriveClientStats,
  clientStatusBadge,
  formatPhone,
  deriveResumenCards,
  deriveOnboardingChecklist,
} from "./client-stats";

function task(status: CRMTask["status"]): CRMTask {
  return {
    id: `t-${Math.random().toString(36).slice(2, 7)}`,
    name: "Tarea",
    desc: "",
    status,
    prio: "important",
    pomoSessions: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function project(tasks: CRMTask[] = []): CRMProject {
  return {
    id: "p-1",
    name: "Proyecto",
    domain: "",
    budget: 0,
    annual: 0,
    budgetIva: "none",
    annualIva: "none",
    tech: "",
    guides: "",
    accounts: "",
    readme: "",
    prompt: "",
    quickNotes: "",
    keys: [],
    tasks,
    charges: [],
    createdAt: "2026-08-01T00:00:00.000Z",
  } as CRMProject;
}

function client(overrides: Partial<CRMClient> = {}): CRMClient {
  return {
    id: "c-1",
    name: "Cliente Demo",
    email: "",
    phone: "",
    location: "",
    notes: "",
    projects: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("clientStatusBadge — el badge refleja el estado comercial", () => {
  it("cada estado tiene su etiqueta", () => {
    const stats = deriveClientStats(client());
    expect(clientStatusBadge("prospecto", stats).label).toBe("Prospecto");
    expect(clientStatusBadge("activo", stats).label).toBe("Cliente activo");
    expect(clientStatusBadge("pausado", stats).label).toBe("Pausado");
    expect(clientStatusBadge("cerrado", stats).label).toBe("Cerrado");
  });

  it("sin estado (blob viejo) cae a Prospecto", () => {
    expect(clientStatusBadge(undefined, deriveClientStats(client())).label).toBe("Prospecto");
  });

  it("tareas detenidas siempre ganan (señal de bloqueo)", () => {
    const c = client({ projects: [project([task("bloqueado")])] });
    expect(clientStatusBadge("activo", deriveClientStats(c)).label).toBe("Atención requerida");
  });
});

describe("formatPhone — teléfono accionable", () => {
  it("10 dígitos se asumen mexicanos", () => {
    const p = formatPhone("322 019 9919");
    expect(p).not.toBeNull();
    expect(p!.telHref).toBe("tel:+523220199919");
    expect(p!.waHref).toBe("https://wa.me/523220199919");
    expect(p!.display).toBe("+52 322 019 9919");
  });

  it("con + explícito conserva el país", () => {
    expect(formatPhone("+52 (322) 137-8336")!.telHref).toBe("tel:+523221378336");
  });

  it("basura o números cortos: null", () => {
    expect(formatPhone("ext. 123")).toBeNull();
    expect(formatPhone("")).toBeNull();
    expect(formatPhone(undefined)).toBeNull();
  });
});

describe("deriveResumenCards — tarjetas según estado", () => {
  const input = { openProposalsCount: 2, pendingBillingCount: 0, lastActivityAt: "2026-08-04T10:00:00.000Z" };

  it("cliente activo: proyectos, siguiente acción y cobros", () => {
    const c = client({ crmStatus: "activo", projects: [project()] });
    const cards = deriveResumenCards(c, deriveClientStats(c), input);
    expect(cards.map((x) => x.key)).toEqual(["proyectos", "siguiente", "cobro"]);
    expect(cards[1].value).toBe("Sin próxima acción");
    expect(cards[1].tone).toBe("warning");
  });

  it("prospecto: propuestas, seguimiento y último contacto", () => {
    const c = client({ crmStatus: "prospecto" });
    const cards = deriveResumenCards(c, deriveClientStats(c), input);
    expect(cards.map((x) => x.key)).toEqual(["propuestas", "seguimiento", "contacto"]);
    expect(cards[0].value).toBe("2");
    expect(cards[2].value).toBe("2026-08-04");
  });

  it("con próxima acción registrada la tarjeta la muestra", () => {
    const c = client({ crmStatus: "activo", nextAction: { label: "Llamar", dueAt: null } });
    const cards = deriveResumenCards(c, deriveClientStats(c), input);
    expect(cards[1].value).toBe("Llamar");
    expect(cards[1].tone).toBe("default");
  });

  it("detenidas aparece SOLO por excepción y en rojo", () => {
    const sano = client({ crmStatus: "activo" });
    expect(deriveResumenCards(sano, deriveClientStats(sano), input).some((x) => x.key === "detenidas")).toBe(false);

    const bloqueado = client({ crmStatus: "activo", projects: [project([task("pausado")])] });
    const cards = deriveResumenCards(bloqueado, deriveClientStats(bloqueado), input);
    const detenidas = cards.find((x) => x.key === "detenidas");
    expect(detenidas?.tone).toBe("danger");
    expect(detenidas?.value).toBe("1");
  });
});

describe("deriveOnboardingChecklist — CTA por estado", () => {
  it("prospecto → Crear propuesta", () => {
    const r = deriveOnboardingChecklist(client(), 0);
    expect(r.cta.action).toBe("crear-propuesta");
    expect(r.steps.filter((s) => s.done)).toHaveLength(0);
  });

  it("activo sin proyecto → Crear proyecto", () => {
    const r = deriveOnboardingChecklist(client({ crmStatus: "activo" }), 0);
    expect(r.cta.action).toBe("crear-proyecto");
  });

  it("activo con proyecto → Abrir proyecto activo", () => {
    const r = deriveOnboardingChecklist(client({ crmStatus: "activo", projects: [project()] }), 0);
    expect(r.cta.action).toBe("abrir-proyecto");
    expect(r.projectId).toBe("p-1");
  });

  it("los pasos reflejan el avance real", () => {
    const r = deriveOnboardingChecklist(
      client({ email: "hola@demo.mx", crmStatus: "activo", nextAction: { label: "Llamar", dueAt: null } }),
      1
    );
    expect(r.steps.map((s) => s.done)).toEqual([true, true, true, true]);
  });
});
