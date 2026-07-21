import { describe, expect, it } from "vitest";
import {
  QA_CATALOG_VERSION,
  QA_CHECKS,
  getCheckDefinition,
  isValidCheckCode,
  MIN_ITEMS_BY_BLOCK,
  ITEMS_FIELD_BY_BLOCK,
  AXE_IMPACT_TO_SEVERITY,
} from "./catalog";

/** Los 46 códigos det/nav/heu del plan (todas las categorías salvo `ia`). */
const PLAN_NON_IA_CODES = [
  "QA-ST-001",
  "QA-ST-002",
  "QA-ST-003",
  "QA-ST-004",
  "QA-DI-001",
  "QA-DI-002",
  "QA-DI-003",
  "QA-DI-004",
  "QA-DI-005",
  "QA-DI-006",
  "QA-DI-007",
  "QA-VI-001",
  "QA-VI-002",
  "QA-VI-003",
  "QA-VI-004",
  "QA-VI-005",
  "QA-VI-006",
  "QA-VI-007",
  "QA-VI-008",
  "QA-VI-009",
  "QA-MO-001",
  "QA-MO-002",
  "QA-MO-003",
  "QA-MO-004",
  "QA-MO-005",
  "QA-MO-006",
  "QA-CA-001",
  "QA-CA-002",
  "QA-CA-003",
  "QA-CA-004",
  "QA-CA-005",
  "QA-AX-001",
  "QA-AX-002",
  "QA-AX-003",
  "QA-AX-004",
  "QA-AX-005",
  "QA-AX-006",
  "QA-TE-001",
  "QA-TE-002",
  "QA-TE-003",
  "QA-TE-004",
  "QA-TE-005",
  "QA-TE-006",
  "QA-TE-007",
  "QA-TE-008",
  "QA-TE-009",
];

const PLAN_IA_CODES = ["QA-IA-001", "QA-IA-002", "QA-IA-003"];

describe("QA_CATALOG_VERSION", () => {
  it("es '1'", () => {
    expect(QA_CATALOG_VERSION).toBe("1");
  });
});

describe("QA_CHECKS — forma general", () => {
  it("todos los códigos son únicos", () => {
    const codes = QA_CHECKS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("todos los códigos respetan el formato QA-[A-Z]{2}-\\d{3}", () => {
    for (const check of QA_CHECKS) {
      expect(isValidCheckCode(check.code)).toBe(true);
    }
  });

  it("toda entrada tiene category/checkClass/severity/title/recommendation no vacíos", () => {
    const validCategories = new Set([
      "estructura",
      "diseno",
      "visual",
      "accesibilidad",
      "tecnico",
      "motion",
      "capacidades",
      "ia",
    ]);
    const validClasses = new Set(["det", "nav", "heu", "ia"]);
    const validSeverities = new Set(["critical", "major", "minor", "info"]);

    for (const check of QA_CHECKS) {
      expect(validCategories.has(check.category)).toBe(true);
      expect(validClasses.has(check.checkClass)).toBe(true);
      expect(validSeverities.has(check.severity)).toBe(true);
      expect(check.title.length).toBeGreaterThan(0);
      expect(check.recommendation.length).toBeGreaterThan(0);
    }
  });

  it("blocking=true está contenido en {severity critical} ∪ {DI-002 condicional}", () => {
    for (const check of QA_CHECKS) {
      if (check.blocking === true) {
        expect(check.severity).toBe("critical");
      } else if (check.blocking === "conditional") {
        expect(check.code).toBe("QA-DI-002");
      }
    }
  });

  it("contiene los 46 códigos det/nav/heu del plan", () => {
    const codes = new Set(QA_CHECKS.map((c) => c.code));
    for (const code of PLAN_NON_IA_CODES) {
      expect(codes.has(code)).toBe(true);
    }
    expect(PLAN_NON_IA_CODES).toHaveLength(46);
  });

  it("contiene los 3 códigos QA-IA-* (clase ia, advisory)", () => {
    const codes = new Set(QA_CHECKS.map((c) => c.code));
    for (const code of PLAN_IA_CODES) {
      expect(codes.has(code)).toBe(true);
      expect(getCheckDefinition(code)?.checkClass).toBe("ia");
    }
  });

  it("el total de entradas es exactamente los 46 no-ia + los 3 ia (49)", () => {
    expect(QA_CHECKS).toHaveLength(PLAN_NON_IA_CODES.length + PLAN_IA_CODES.length);
  });
});

describe("getCheckDefinition", () => {
  it("devuelve la definición para un código existente", () => {
    expect(getCheckDefinition("QA-ST-001")?.category).toBe("estructura");
  });

  it("devuelve undefined para un código inexistente", () => {
    expect(getCheckDefinition("QA-XX-999")).toBeUndefined();
  });
});

describe("isValidCheckCode", () => {
  it("acepta el formato correcto", () => {
    expect(isValidCheckCode("QA-ST-001")).toBe(true);
  });

  it("rechaza formatos incorrectos", () => {
    expect(isValidCheckCode("QA-ST-1")).toBe(false);
    expect(isValidCheckCode("qa-st-001")).toBe(false);
    expect(isValidCheckCode("QA-STX-001")).toBe(false);
    expect(isValidCheckCode("ST-001")).toBe(false);
  });
});

describe("MIN_ITEMS_BY_BLOCK / ITEMS_FIELD_BY_BLOCK", () => {
  it("tienen exactamente las mismas keys (un campo de ítems por cada block con mínimo)", () => {
    expect(Object.keys(MIN_ITEMS_BY_BLOCK).sort()).toEqual(Object.keys(ITEMS_FIELD_BY_BLOCK).sort());
  });

  it("cubre los 6 blocks del plan con sus mínimos exactos", () => {
    expect(MIN_ITEMS_BY_BLOCK["feature-grid"]).toBe(2);
    expect(MIN_ITEMS_BY_BLOCK["faq-accordion"]).toBe(2);
    expect(MIN_ITEMS_BY_BLOCK["proof-logos"]).toBe(3);
    expect(MIN_ITEMS_BY_BLOCK["offer-tiers"]).toBe(2);
    expect(MIN_ITEMS_BY_BLOCK["process-steps"]).toBe(2);
    expect(MIN_ITEMS_BY_BLOCK["stats-band"]).toBe(2);
  });
});

describe("AXE_IMPACT_TO_SEVERITY", () => {
  it("mapea critical/serious a major, moderate a minor, minor a info", () => {
    expect(AXE_IMPACT_TO_SEVERITY.critical).toBe("major");
    expect(AXE_IMPACT_TO_SEVERITY.serious).toBe("major");
    expect(AXE_IMPACT_TO_SEVERITY.moderate).toBe("minor");
    expect(AXE_IMPACT_TO_SEVERITY.minor).toBe("info");
  });
});
