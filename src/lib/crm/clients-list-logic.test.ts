import { describe, expect, it } from "vitest";
import type { CRMClient, CRMProject, CRMTask } from "@/types/crm";
import { deriveClientStats } from "./client-stats";
import {
  nextActionChip,
  activeProjectsInfo,
  clientNeedsAttention,
  isArchivedClient,
  syntheticLastActivity,
  lastActivityLabel,
  parseClientsFilter,
  parseClientsSort,
  applyClientsFilter,
  matchesClientQuery,
  sortClientsEntries,
  deriveDirectoryMetrics,
  type ClientListEntry,
} from "./clients-list-logic";

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

// ── A2 ───────────────────────────────────────────────────────────────────────

function entry(c: CRMClient, lastActivityAt = c.createdAt): ClientListEntry {
  return {
    client: c,
    stats: deriveClientStats(c),
    attention: clientNeedsAttention(c, deriveClientStats(c), NOW),
    lastActivityAt,
  };
}

describe("clientNeedsAttention — derivación pura", () => {
  it("tareas detenidas → atención", () => {
    const c = client({ projects: [project([task("bloqueado")])] });
    expect(clientNeedsAttention(c, deriveClientStats(c), NOW)).toBe(true);
  });

  it("próxima acción vencida → atención (cualquier estado)", () => {
    const c = client({ nextAction: { label: "Llamar", dueAt: "2026-08-01T00:00:00.000Z" } });
    expect(clientNeedsAttention(c, deriveClientStats(c), NOW)).toBe(true);
  });

  it("activo SIN próxima acción → atención (cliente a la deriva)", () => {
    const c = client({ crmStatus: "activo" });
    expect(clientNeedsAttention(c, deriveClientStats(c), NOW)).toBe(true);
  });

  it("activo con próxima acción futura → sin atención", () => {
    const c = client({ crmStatus: "activo", nextAction: { label: "Demo", dueAt: "2026-08-20T00:00:00.000Z" } });
    expect(clientNeedsAttention(c, deriveClientStats(c), NOW)).toBe(false);
  });

  it("prospecto sin nada → sin atención", () => {
    expect(clientNeedsAttention(client(), deriveClientStats(client()), NOW)).toBe(false);
  });
});

describe("isArchivedClient", () => {
  it("pausado y cerrado son archivados; el resto no", () => {
    expect(isArchivedClient(client({ crmStatus: "pausado" }))).toBe(true);
    expect(isArchivedClient(client({ crmStatus: "cerrado" }))).toBe(true);
    expect(isArchivedClient(client({ crmStatus: "activo" }))).toBe(false);
    expect(isArchivedClient(client({ crmStatus: "prospecto" }))).toBe(false);
    expect(isArchivedClient(client())).toBe(false);
  });
});

describe("syntheticLastActivity — fallback sin filas de historial", () => {
  it("max(createdAt del cliente, createdAt de proyectos)", () => {
    const c = client({
      createdAt: "2026-07-01T00:00:00.000Z",
      projects: [
        project([], { createdAt: "2026-07-20T00:00:00.000Z" }),
        project([], { createdAt: "2026-07-10T00:00:00.000Z" }),
      ],
    });
    expect(syntheticLastActivity(c)).toBe("2026-07-20T00:00:00.000Z");
  });

  it("sin proyectos: el alta del cliente", () => {
    expect(syntheticLastActivity(client())).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("lastActivityLabel", () => {
  it("relativo en español", () => {
    expect(lastActivityLabel("2026-08-02T12:00:00.000Z", NOW)).toBe("hace 3 días");
  });
  it("null o basura: —", () => {
    expect(lastActivityLabel(null, NOW)).toBe("—");
    expect(lastActivityLabel("nope", NOW)).toBe("—");
  });
});

describe("parseClientsFilter / parseClientsSort — URL degradada al default", () => {
  it("valores válidos pasan", () => {
    expect(parseClientsFilter("archivados")).toBe("archivados");
    expect(parseClientsSort("nombre")).toBe("nombre");
  });
  it("desconocidos o null caen al default", () => {
    expect(parseClientsFilter("con-tareas")).toBe("todos");
    expect(parseClientsFilter(null)).toBe("todos");
    expect(parseClientsSort("mas-proyectos")).toBe("atencion");
    expect(parseClientsSort(null)).toBe("atencion");
  });
});

describe("applyClientsFilter — archivados fuera del trabajo diario", () => {
  const activo = entry(client({ id: "a", crmStatus: "activo", nextAction: { label: "x", dueAt: null } }));
  const sinProyecto = entry(client({ id: "b" }));
  const conProyecto = entry(client({ id: "c", projects: [project()] }));
  const pausado = entry(client({ id: "d", crmStatus: "pausado" }));
  const atencion = entry(client({ id: "e", crmStatus: "activo" })); // sin nextAction
  const all = [activo, sinProyecto, conProyecto, pausado, atencion];

  it("todos EXCLUYE archivados", () => {
    expect(applyClientsFilter(all, "todos").map((e) => e.client.id)).toEqual(["a", "b", "c", "e"]);
  });

  it("atencion: solo los que requieren atención, sin archivados", () => {
    expect(applyClientsFilter(all, "atencion").map((e) => e.client.id)).toEqual(["e"]);
  });

  it("sin-proyecto: sin proyectos y no archivados", () => {
    expect(applyClientsFilter(all, "sin-proyecto").map((e) => e.client.id)).toEqual(["a", "b", "e"]);
  });

  it("archivados: SOLO pausado/cerrado", () => {
    expect(applyClientsFilter(all, "archivados").map((e) => e.client.id)).toEqual(["d"]);
  });
});

describe("matchesClientQuery — incluye nombres de proyectos", () => {
  const c = client({
    name: "Clínica Demo",
    contactName: "Ana",
    projects: [project([], { name: "Rediseño Web" })],
  });

  it("por nombre de proyecto", () => {
    expect(matchesClientQuery(c, "rediseño")).toBe(true);
  });
  it("por contacto", () => {
    expect(matchesClientQuery(c, "ana")).toBe(true);
  });
  it("sin match", () => {
    expect(matchesClientQuery(c, "zzz")).toBe(false);
  });
  it("query vacía siempre pasa", () => {
    expect(matchesClientQuery(c, "  ")).toBe(true);
  });
});

describe("sortClientsEntries", () => {
  const vencidoViejo = entry(
    client({ id: "v1", name: "B", crmStatus: "activo", nextAction: { label: "x", dueAt: "2026-07-01T00:00:00.000Z" } }),
    "2026-07-01T00:00:00.000Z"
  );
  const vencidoReciente = entry(
    client({ id: "v2", name: "A", crmStatus: "activo", nextAction: { label: "x", dueAt: "2026-08-01T00:00:00.000Z" } }),
    "2026-08-04T00:00:00.000Z"
  );
  const derivaActivo = entry(
    client({ id: "v3", name: "C", crmStatus: "activo" }), // atención sin dueAt
    "2026-08-03T00:00:00.000Z"
  );
  const sano = entry(
    client({ id: "s1", name: "D", nextAction: { label: "x", dueAt: "2026-09-01T00:00:00.000Z" } }),
    "2026-08-02T00:00:00.000Z"
  );

  it("atencion: atención primero, vencimiento más antiguo antes, sin fecha al final del bloque", () => {
    const ids = sortClientsEntries([sano, derivaActivo, vencidoReciente, vencidoViejo], "atencion")
      .map((e) => e.client.id);
    expect(ids).toEqual(["v1", "v2", "v3", "s1"]);
  });

  it("actividad: última actividad descendente", () => {
    const ids = sortClientsEntries([vencidoViejo, sano, vencidoReciente], "actividad")
      .map((e) => e.client.id);
    expect(ids).toEqual(["v2", "s1", "v1"]);
  });

  it("nuevos: createdAt descendente", () => {
    const viejo = entry(client({ id: "n1", createdAt: "2026-01-01T00:00:00.000Z" }));
    const nuevo = entry(client({ id: "n2", createdAt: "2026-08-01T00:00:00.000Z" }));
    expect(sortClientsEntries([viejo, nuevo], "nuevos").map((e) => e.client.id)).toEqual(["n2", "n1"]);
  });

  it("nombre: A–Z en español y no muta el arreglo original", () => {
    const input = [vencidoViejo, vencidoReciente];
    const ids = sortClientsEntries(input, "nombre").map((e) => e.client.name);
    expect(ids).toEqual(["A", "B"]);
    expect(input[0].client.name).toBe("B");
  });
});

describe("deriveDirectoryMetrics — header accionable", () => {
  it("cuenta activos, proyectos activos y atención SIN archivados", () => {
    const entries = [
      entry(client({ id: "a", crmStatus: "activo", projects: [project(), project([task("bloqueado")])] })),
      entry(client({ id: "b" })), // prospecto tranquilo
      entry(client({ id: "c", crmStatus: "pausado", projects: [project()] })), // archivado: no cuenta
    ];
    const m = deriveDirectoryMetrics(entries);
    expect(m.activeClients).toBe(1);
    expect(m.activeProjects).toBe(1); // el bloqueado no está «Activo»
    expect(m.attention).toBe(1); // "a": tareas detenidas
  });
});
