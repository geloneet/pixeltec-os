import { describe, expect, test } from "vitest";
import { buildContractSections, flattenSections, CONTRACT_TEMPLATE_VERSION } from "./base-template";

const BASE_DATA = {
  clientName: "Acme SA de CV",
  contractTitle: "Contrato de servicios — Acme",
  startDate: "2026-03-01",
  endDate: undefined as string | undefined,
  proposalReference: undefined as string | undefined,
  scope: undefined as string | undefined,
  deliverables: undefined as string | undefined,
  billingItems: [] as { concept: string; amount: number; frequency: string }[],
};

describe("buildContractSections", () => {
  test("returns the 15 fixed sections in the required order", () => {
    const sections = buildContractSections(BASE_DATA);
    expect(sections.map((s) => s.key)).toEqual([
      "partes",
      "objeto",
      "alcance",
      "entregables",
      "obligaciones_pixeltec",
      "obligaciones_cliente",
      "inversion",
      "forma_pago",
      "vigencia",
      "renovacion",
      "cancelacion",
      "confidencialidad",
      "propiedad_intelectual",
      "soporte",
      "aprobacion",
    ]);
  });

  test("cada sección trae un título no vacío", () => {
    const sections = buildContractSections(BASE_DATA);
    for (const s of sections) {
      expect(s.title.length).toBeGreaterThan(0);
    }
  });

  test("la sección 'partes' menciona al cliente y a PixelTEC", () => {
    const sections = buildContractSections(BASE_DATA);
    const partes = sections.find((s) => s.key === "partes")!;
    expect(partes.body).toContain("Acme SA de CV");
    expect(partes.body).toContain("PixelTEC");
  });

  test("la sección 'inversion' lista cada concepto de cobro con monto y frecuencia", () => {
    const sections = buildContractSections({
      ...BASE_DATA,
      billingItems: [
        { concept: "Hosting anual", amount: 1500, frequency: "anual" },
        { concept: "Desarrollo de software", amount: 25000, frequency: "unico" },
      ],
    });
    const inversion = sections.find((s) => s.key === "inversion")!;
    expect(inversion.body).toContain("Hosting anual");
    expect(inversion.body).toContain("Anual");
    expect(inversion.body).toContain("Desarrollo de software");
    expect(inversion.body).toContain("Pago único");
    expect(inversion.body).toContain("$1,500");
    expect(inversion.body).toContain("$25,000");
  });

  test("sin conceptos de cobro, 'inversion' cae en un fallback elegante", () => {
    const sections = buildContractSections(BASE_DATA);
    const inversion = sections.find((s) => s.key === "inversion")!;
    expect(inversion.body).toContain("por definir");
  });

  test("'vigencia' usa fecha de fin cuando existe", () => {
    const sections = buildContractSections({ ...BASE_DATA, endDate: "2027-03-01" });
    const vigencia = sections.find((s) => s.key === "vigencia")!;
    expect(vigencia.body).toContain("2026-03-01");
    expect(vigencia.body).toContain("2027-03-01");
  });

  test("'vigencia' sin fecha de fin indica vigencia indefinida", () => {
    const sections = buildContractSections(BASE_DATA);
    const vigencia = sections.find((s) => s.key === "vigencia")!;
    expect(vigencia.body).toContain("indefinida");
  });

  test("CONTRACT_TEMPLATE_VERSION es 1", () => {
    expect(CONTRACT_TEMPLATE_VERSION).toBe(1);
  });
});

describe("flattenSections", () => {
  test("concatena título y cuerpo de cada sección, en orden", () => {
    const sections = buildContractSections(BASE_DATA);
    const flat = flattenSections(sections);
    const partesIdx = flat.indexOf("Partes involucradas");
    const objetoIdx = flat.indexOf("Objeto del contrato");
    expect(partesIdx).toBeGreaterThanOrEqual(0);
    expect(objetoIdx).toBeGreaterThan(partesIdx);
  });
});
