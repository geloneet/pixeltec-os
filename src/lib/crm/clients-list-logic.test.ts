import { describe, expect, it } from "vitest";
import type { CRMClient, CRMProject, CRMTask } from "@/types/crm";
import { nextActionChip, activeProjectsInfo } from "./clients-list-logic";

const NOW = new Date("2026-08-05T12:00:00.000Z");

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

function project(tasks: CRMTask[] = [], overrides: Partial<CRMProject> = {}): CRMProject {
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
    ...overrides,
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

describe("nextActionChip — chip de próxima acción por fila", () => {
  it("sin próxima acción: muted", () => {
    expect(nextActionChip(null, NOW)).toEqual({
      label: "Sin próxima acción",
      detail: null,
      tone: "muted",
    });
    expect(nextActionChip(undefined, NOW).tone).toBe("muted");
  });

  it("con acción sin fecha: solo el label", () => {
    const chip = nextActionChip({ label: "Llamar", dueAt: null }, NOW);
    expect(chip).toEqual({ label: "Llamar", detail: null, tone: "default" });
  });

  it("vencida: «Vencido hace X» en tono overdue", () => {
    const chip = nextActionChip({ label: "Enviar propuesta", dueAt: "2026-08-02T12:00:00.000Z" }, NOW);
    expect(chip.tone).toBe("overdue");
    expect(chip.detail).toBe("Vencido hace 3 días");
  });

  it("futura: fecha corta en tono default", () => {
    const chip = nextActionChip({ label: "Enviar propuesta", dueAt: "2026-08-12T12:00:00.000Z" }, NOW);
    expect(chip.tone).toBe("default");
    expect(chip.detail).toBe("12 ago");
  });

  it("fecha corrupta degrada a label sin detalle, jamás rompe", () => {
    const chip = nextActionChip({ label: "Llamar", dueAt: "no-es-fecha" }, NOW);
    expect(chip).toEqual({ label: "Llamar", detail: null, tone: "default" });
  });
});

describe("activeProjectsInfo — la fila responde «¿hay trabajo vivo?»", () => {
  it("sin proyectos: «Sin proyecto»", () => {
    expect(activeProjectsInfo(client())).toEqual({
      count: 0,
      label: "Sin proyecto",
      hasProjects: false,
    });
  });

  it("cuenta solo proyectos en estado Activo (no detenidos ni completados)", () => {
    const c = client({
      projects: [
        project([task("en_progreso")]),          // Activo
        project([task("bloqueado")]),            // Detenido
        project([task("completado")]),           // Completado
        project([]),                             // Activo (sin tareas)
      ],
    });
    const info = activeProjectsInfo(c);
    expect(info.count).toBe(2);
    expect(info.label).toBe("2 activos");
    expect(info.hasProjects).toBe(true);
  });

  it("singular: «1 activo»", () => {
    const c = client({ projects: [project()] });
    expect(activeProjectsInfo(c).label).toBe("1 activo");
  });
});
