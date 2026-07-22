import { describe, expect, it } from "vitest";
import { computeQaScore, QA_SCORING_VERSION, type QaScoreInput } from "./scoring";

type Finding = QaScoreInput["findings"][number];

function finding(overrides: Partial<Finding> & Pick<Finding, "checkCode" | "category" | "severity">): Finding {
  return { blocking: false, ...overrides };
}

const ALL_PHASES_COMPLETE = { deterministic: true, browser: true };

describe("QA_SCORING_VERSION", () => {
  it("es '1'", () => {
    expect(QA_SCORING_VERSION).toBe("1");
  });
});

describe("computeQaScore — verdict FAIL por blocking (regla 1, cortocircuito)", () => {
  it("un finding blocking=true fuerza FAIL aunque el score quede en 100", () => {
    const result = computeQaScore({
      findings: [finding({ checkCode: "QA-X-001", category: "estructura", severity: "info", blocking: true })],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.scoreTotal).toBe(100);
    expect(result.verdict).toBe("fail");
  });
});

describe("computeQaScore — umbrales exactos de scoreTotal (regla 2)", () => {
  it("scoreTotal===75 (justo en el límite) NO es fail — ninguna categoría baja de 50", () => {
    // 10 minors (checkCodes distintos, sin tope) en cada una de estructura/
    // diseno/visual → penalty 50 en las 3 (score exactamente 50, NO <50).
    // weightedSum = 10000-(20*50+15*50+15*50) = 10000-2500 = 7500 → scoreTotal=75.
    const minors = (category: string, prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => finding({ checkCode: `QA-${prefix}-${i}`, category, severity: "minor" }));

    const result = computeQaScore({
      findings: [...minors("estructura", "A", 10), ...minors("diseno", "B", 10), ...minors("visual", "C", 10)],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });

    expect(result.categoryScores.estructura?.score).toBe(50);
    expect(result.categoryScores.diseno?.score).toBe(50);
    expect(result.categoryScores.visual?.score).toBe(50);
    expect(result.scoreTotal).toBe(75);
    expect(result.verdict).not.toBe("fail");
  });

  it("scoreTotal===74 (un punto por debajo) SÍ es fail por score — sin que ninguna categoría baje de 50", () => {
    // estructura penalty40(score60), diseno penalty50(score50), visual
    // penalty50(score50), accesibilidad penalty20(score80) — ninguna <50.
    // weightedSum = 10000-(20*40+15*50+15*50+15*20) = 10000-2600 = 7400 → scoreTotal=74.
    const minors = (category: string, prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => finding({ checkCode: `QA-${prefix}-${i}`, category, severity: "minor" }));

    const result = computeQaScore({
      findings: [
        ...minors("estructura", "A", 8), // 8*5=40
        ...minors("diseno", "B", 10), // 10*5=50
        ...minors("visual", "C", 10), // 10*5=50
        ...minors("accesibilidad", "D", 4), // 4*5=20
      ],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });

    expect(result.categoryScores.estructura?.score).toBe(60);
    expect(result.categoryScores.diseno?.score).toBe(50);
    expect(result.categoryScores.visual?.score).toBe(50);
    expect(result.categoryScores.accesibilidad?.score).toBe(80);
    expect(result.scoreTotal).toBe(74);
    expect(result.verdict).toBe("fail");
  });

  it("scoreTotal===90 exacto: con 0 major y fases completas alcanza PASS estricto", () => {
    // 4 minors (checkCodes distintos, sin tope) en cada una de 3 categorías de
    // 20/20/20 puntos de penalty → estructura score80, diseno score80, visual
    // score80, el resto en 100. weightedSum = 10000-(20*20+15*20+15*20)=9000 → scoreTotal=90.
    const minorGroup = (category: string, prefix: string) =>
      Array.from({ length: 4 }, (_, i) => finding({ checkCode: `QA-${prefix}-${i}`, category, severity: "minor" }));

    const result = computeQaScore({
      findings: [...minorGroup("estructura", "A"), ...minorGroup("diseno", "B"), ...minorGroup("visual", "C")],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });

    expect(result.categoryScores.estructura?.score).toBe(80);
    expect(result.categoryScores.diseno?.score).toBe(80);
    expect(result.categoryScores.visual?.score).toBe(80);
    expect(result.scoreTotal).toBe(90);
    expect(result.verdict).toBe("pass");
  });

  it("scoreTotal===89 exacto (un minor adicional en visual): ya no alcanza PASS estricto", () => {
    // Mismo fixture que el caso 90, más 1 minor adicional en visual (penalty
    // 25 en vez de 20, score75). weightedSum = 10000-(400+300+375)=8925 → scoreTotal=89.
    const minorGroup = (category: string, prefix: string, count: number) =>
      Array.from({ length: count }, (_, i) => finding({ checkCode: `QA-${prefix}-${i}`, category, severity: "minor" }));

    const result = computeQaScore({
      findings: [...minorGroup("estructura", "A", 4), ...minorGroup("diseno", "B", 4), ...minorGroup("visual", "C", 5)],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });

    expect(result.categoryScores.visual?.score).toBe(75);
    expect(result.scoreTotal).toBe(89);
    expect(result.verdict).toBe("pass_with_warnings");
  });
});

describe("computeQaScore — categoría con peso>0 y score<50 fuerza FAIL sin importar el total", () => {
  it("motion en 45 (< 50) hace fail aunque scoreTotal sea 95", () => {
    const result = computeQaScore({
      findings: [
        finding({ checkCode: "QA-MO-900", category: "motion", severity: "critical" }), // 40
        finding({ checkCode: "QA-MO-901", category: "motion", severity: "major" }), // 15 → total 55 → score 45
      ],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.categoryScores.motion?.score).toBe(45);
    expect(result.scoreTotal).toBeGreaterThanOrEqual(90);
    expect(result.verdict).toBe("fail");
  });
});

describe("computeQaScore — tope 3x por checkCode dentro de una categoría", () => {
  it("5 findings major del mismo checkCode capan en 3×15=45, no 75", () => {
    const findings = Array.from({ length: 5 }, (_, i) =>
      finding({ checkCode: "QA-TE-004", category: "tecnico", severity: "major" })
    );
    const result = computeQaScore({
      findings,
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.categoryScores.tecnico?.penalty).toBe(45);
    expect(result.categoryScores.tecnico?.score).toBe(55);
    expect(result.categoryScores.tecnico?.findings).toBe(5);
  });

  it("el tope es POR checkCode — dos checkCodes distintos no comparten el tope", () => {
    const findings = [
      ...Array.from({ length: 5 }, () => finding({ checkCode: "QA-TE-004", category: "tecnico", severity: "major" })),
      ...Array.from({ length: 5 }, () => finding({ checkCode: "QA-TE-005", category: "tecnico", severity: "major" })),
    ];
    const result = computeQaScore({
      findings,
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    // Cada checkCode capa en 45 → total categoría 90 → score 10.
    expect(result.categoryScores.tecnico?.penalty).toBe(90);
    expect(result.categoryScores.tecnico?.score).toBe(10);
  });
});

describe("computeQaScore — redistribución de peso de 'capacidades'", () => {
  it("treeUsesCapabilities=true deja los pesos base intactos", () => {
    const result = computeQaScore({
      findings: [],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.categoryScores.capacidades?.weight).toBe(10);
    expect(result.categoryScores.estructura?.weight).toBe(20);
  });

  it("treeUsesCapabilities=false redistribuye el peso 10 de capacidades proporcionalmente — los weights reportados suman 100", () => {
    const result = computeQaScore({
      findings: [],
      treeUsesCapabilities: false,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.categoryScores.capacidades?.weight).toBe(0);
    expect(result.categoryScores.ia?.weight).toBe(0);
    // 90 = suma de pesos base con peso>0 excluyendo capacidades (20+15+15+15+15+10).
    expect(result.categoryScores.estructura?.weight).toBeCloseTo(20 + (10 * 20) / 90, 6);
    expect(result.categoryScores.diseno?.weight).toBeCloseTo(15 + (10 * 15) / 90, 6);
    expect(result.categoryScores.motion?.weight).toBeCloseTo(10 + (10 * 10) / 90, 6);

    const totalWeight = Object.values(result.categoryScores).reduce((sum, c) => sum + c.weight, 0);
    expect(totalWeight).toBeCloseTo(100, 6);
  });

  it("sin capabilities, con todo en 100, scoreTotal sigue siendo 100 (la redistribución no introduce drift)", () => {
    const result = computeQaScore({
      findings: [],
      treeUsesCapabilities: false,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.scoreTotal).toBe(100);
  });
});

describe("computeQaScore — determinismo", () => {
  it("la misma entrada produce siempre la misma salida (dos corridas)", () => {
    const input: QaScoreInput = {
      findings: [
        finding({ checkCode: "QA-A-001", category: "estructura", severity: "critical" }),
        finding({ checkCode: "QA-B-001", category: "diseno", severity: "minor" }),
        finding({ checkCode: "QA-C-001", category: "ia", severity: "info" }),
      ],
      treeUsesCapabilities: false,
      phasesComplete: { deterministic: true, browser: false },
    };
    const first = computeQaScore({ ...input, findings: [...input.findings] });
    const second = computeQaScore({ ...input, findings: [...input.findings] });
    expect(second).toEqual(first);
  });
});

describe("computeQaScore — categoría 'ia' no mueve el score (peso 0, advisory)", () => {
  it("findings críticos en categoría ia no cambian scoreTotal ni impiden PASS", () => {
    const result = computeQaScore({
      findings: [finding({ checkCode: "QA-IA-003", category: "ia", severity: "critical" })],
      treeUsesCapabilities: true,
      phasesComplete: ALL_PHASES_COMPLETE,
    });
    expect(result.categoryScores.ia?.score).toBe(60); // la categoría SÍ se penaliza internamente (100-40)...
    expect(result.categoryScores.ia?.weight).toBe(0); // ...pero su weight es 0, así que no aporta al total.
    expect(result.scoreTotal).toBe(100);
    expect(result.verdict).toBe("pass");
  });
});
