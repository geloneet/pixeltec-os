/**
 * Tests de `deriveAllProjects` — la agregación de "Todos" en /proyectos.
 *
 * Regresión: antes de esto, "Todos" solo leía proyectos CRM clásicos
 * (`deriveActiveProjects`) y nunca `pixelforge_projects`/`project_definitions`,
 * por lo que una cuenta con únicamente proyectos PixelForge o Definición veía
 * la lista vacía aunque sí tuviera proyectos activos.
 */
import { describe, expect, it } from "vitest";
import { deriveAllProjects } from "./crm-data";
import type { CRMClient, CRMProject } from "@/types/crm";
import type { PixelforgeProjectListItem } from "@/lib/db/repos/pixelforge";
import type { DefinitionListItem } from "@/lib/db/repos/definitions";

function buildProject(overrides: Partial<CRMProject> = {}): CRMProject {
  return {
    id: "crm-project-1",
    name: "Proyecto CRM de prueba",
    domain: "example.com",
    budget: 0,
    annual: 0,
    budgetIva: "none",
    annualIva: "none",
    tech: "",
    keys: [],
    guides: "",
    accounts: "",
    readme: "",
    prompt: "",
    quickNotes: "",
    tasks: [],
    charges: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildClient(overrides: Partial<CRMClient> = {}): CRMClient {
  return {
    id: "client-1",
    name: "Cliente de prueba",
    email: "cliente@example.com",
    phone: "555-0000",
    location: "CDMX",
    notes: "",
    projects: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildPixelforgeItem(
  overrides: Partial<PixelforgeProjectListItem> = {},
): PixelforgeProjectListItem {
  return {
    id: "pf-project-1",
    title: "Landing de prueba",
    clientId: "client-1",
    clientName: "Cliente de prueba",
    currentStation: "direcciones",
    status: "in_progress",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-10T00:00:00.000Z"),
    ...overrides,
  };
}

function buildDefinitionItem(
  overrides: Partial<DefinitionListItem> = {},
): DefinitionListItem {
  return {
    id: "def-project-1",
    title: "Definición de prueba",
    clientId: "client-1",
    clientName: "Cliente de prueba",
    currentStation: "mvp",
    status: "in_progress",
    proposalId: null,
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-05T00:00:00.000Z"),
    ...overrides,
  };
}

describe("deriveAllProjects", () => {
  it("agrega solo un proyecto PixelForge (sin proyectos CRM ni Definición)", () => {
    const result = deriveAllProjects([], [buildPixelforgeItem()], []);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "pf-project-1",
      kind: "pixelforge",
      href: "/proyectos/pixelforge/pf-project-1/direcciones",
      station: "direcciones",
      status: "in_progress",
    });
  });

  it("agrega solo una Definición (sin proyectos CRM ni PixelForge)", () => {
    const result = deriveAllProjects([], [], [buildDefinitionItem()]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "def-project-1",
      kind: "definicion",
      href: "/proyectos/definicion/def-project-1",
      station: "mvp",
      status: "in_progress",
    });
  });

  it("agrega PixelForge y Definición juntos, ordenados por última actividad", () => {
    const pf = buildPixelforgeItem({ updatedAt: new Date("2026-07-10T00:00:00.000Z") });
    const def = buildDefinitionItem({ updatedAt: new Date("2026-07-12T00:00:00.000Z") });

    const result = deriveAllProjects([], [pf], [def]);

    expect(result).toHaveLength(2);
    // Más reciente primero: la Definición (07-12) antes que PixelForge (07-10).
    expect(result[0].id).toBe("def-project-1");
    expect(result[1].id).toBe("pf-project-1");
  });

  it("un proyecto CRM y uno PixelForge del MISMO cliente no se cuentan doble", () => {
    const client = buildClient({
      id: "client-shared",
      projects: [buildProject({ id: "crm-project-shared", createdAt: "2026-07-01T00:00:00.000Z" })],
    });
    const pf = buildPixelforgeItem({ id: "pf-project-shared", clientId: "client-shared" });

    const result = deriveAllProjects([client], [pf], []);

    expect(result).toHaveLength(2);
    const ids = result.map((p) => p.id).sort();
    expect(ids).toEqual(["crm-project-shared", "pf-project-shared"]);
    const kinds = result.map((p) => p.kind).sort();
    expect(kinds).toEqual(["crm", "pixelforge"]);
  });

  it("devuelve lista vacía real cuando las tres fuentes están vacías", () => {
    expect(deriveAllProjects([], [], [])).toEqual([]);
  });

  it("no duplica un id repetido dentro de la MISMA fuente (salvaguarda de dedupe)", () => {
    const pf = buildPixelforgeItem({ id: "pf-dup" });

    const result = deriveAllProjects([], [pf, { ...pf }], []);

    expect(result).toHaveLength(1);
  });
});
