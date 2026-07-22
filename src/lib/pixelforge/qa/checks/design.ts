/**
 * Checks de diseño (QA-DI-001..006, PF-F8 T2) — todos `det`, sin DB/red/fecha.
 * Operan sobre el resultado de `directionTokensToCssVars` (la ÚNICA
 * traducción tokens→CSS, `components/pixelforge/render/tokens.ts`) y sobre
 * los `designTokens` crudos de la dirección `chosen` del proyecto. DI-006 no
 * necesita tokens — solo sabe si el proyecto tiene una dirección `chosen`.
 * DI-007 (jerarquía tipográfica) es `nav` — se declara en `catalog.ts` pero
 * no se ejecuta aquí.
 */
import {
  directionTokensToCssVars,
  sanitizeCssValue,
  findRoleValue,
  slugify,
  NEUTRAL_FONT_FAMILY,
  BG_GENERAL_KEYWORDS,
  BG_GENERIC_KEYWORDS,
  PRIMARY_KEYWORDS,
  FG_KEYWORDS,
  type DesignTokens,
} from "@/components/pixelforge/render/tokens";
import { contrastRatio } from "../contrast";
import { buildLocationKey } from "../location-key";
import type { QaFindingInput } from "../catalog";

function normalizeColorForCompare(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * QA-DI-001 — Colisión B1: `--pf-primary`≡`--pf-bg` o `--pf-fg`≡`--pf-bg`
 * (comparación normalizada). `directionTokensToCssVars` ya trae un guard
 * contra la colisión de `primary` (F6A #5, gate B1) que prueba el siguiente
 * candidato de la paleta; este check re-verifica el resultado FINAL porque,
 * si la paleta entera es monocolor, ese guard puede terminar cayendo al
 * mismo neutro que usa `bg` — una colisión real que sí debe reportarse.
 */
function checkDI001(vars: Record<string, string>): QaFindingInput[] {
  const bg = normalizeColorForCompare(vars["--pf-bg"] ?? "");
  const collidedRoles: string[] = [];
  if (normalizeColorForCompare(vars["--pf-primary"] ?? "") === bg) collidedRoles.push("--pf-primary");
  if (normalizeColorForCompare(vars["--pf-fg"] ?? "") === bg) collidedRoles.push("--pf-fg");
  if (collidedRoles.length === 0) return [];

  const location = { selectorHash: "color-collision" };
  return [
    {
      checkCode: "QA-DI-001",
      category: "diseno",
      severity: "critical",
      blocking: true,
      source: "det",
      title: "Colisión B1: un rol de texto/marca quedó igual al fondo",
      description: `Los siguientes roles quedaron con el mismo valor que --pf-bg (${vars["--pf-bg"]}): ${collidedRoles.join(", ")} — el texto sería invisible.`,
      recommendation:
        "Revisa la paleta de la dirección elegida — un texto/acento igual al fondo es invisible. Si la paleta es monocolor, elige/ajusta al menos un token adicional distinguible.",
      location,
      locationKey: buildLocationKey("QA-DI-001", location),
    },
  ];
}

interface ContrastPairSpec {
  slot: string;
  fgVar: string;
  bgVar: string;
  minRatio: number;
}

/** Los 4 pares que exige el plan — DI-002 evalúa los 4 sobre el mismo `vars`. */
const CONTRAST_PAIRS: readonly ContrastPairSpec[] = [
  { slot: "fg-bg", fgVar: "--pf-fg", bgVar: "--pf-bg", minRatio: 4.5 },
  { slot: "on-primary-primary", fgVar: "--pf-on-primary", bgVar: "--pf-primary", minRatio: 4.5 },
  { slot: "accent-bg", fgVar: "--pf-accent", bgVar: "--pf-bg", minRatio: 3.0 },
  { slot: "muted-bg", fgVar: "--pf-muted", bgVar: "--pf-bg", minRatio: 3.0 },
];

/**
 * QA-DI-002 — contraste WCAG server-side sobre los 4 pares de roles
 * semánticos. Un par no parseable (`contrastRatio` devuelve `null`) emite un
 * finding `info` separado ("no evaluable server-side") en vez del `major` de
 * contraste insuficiente. `blocking` es condicional: SOLO el par `fg-bg`
 * bloquea, y solo si su ratio real cae por debajo de 3.0 (texto de cuerpo
 * prácticamente ilegible, no solo por debajo del ideal AA).
 */
function checkDI002(vars: Record<string, string>): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const pair of CONTRAST_PAIRS) {
    const fgValue = vars[pair.fgVar];
    const bgValue = vars[pair.bgVar];
    const location = { selectorHash: pair.slot };

    if (fgValue === undefined || bgValue === undefined) continue;

    const ratio = contrastRatio(fgValue, bgValue);

    if (ratio === null) {
      findings.push({
        checkCode: "QA-DI-002",
        category: "diseno",
        severity: "info",
        blocking: false,
        source: "det",
        title: "Contraste WCAG insuficiente en un par de roles semánticos",
        description: `El par ${pair.fgVar}/${pair.bgVar} no es evaluable server-side (color no parseable: "${fgValue}" / "${bgValue}").`,
        recommendation: "Verifica manualmente el contraste de este par en el preview.",
        location,
        locationKey: buildLocationKey("QA-DI-002", location),
      });
      continue;
    }

    if (ratio < pair.minRatio) {
      const blocking = pair.slot === "fg-bg" && ratio < 3.0;
      findings.push({
        checkCode: "QA-DI-002",
        category: "diseno",
        severity: "major",
        blocking,
        source: "det",
        title: "Contraste WCAG insuficiente en un par de roles semánticos",
        description: `El par ${pair.fgVar}/${pair.bgVar} tiene un ratio de ${ratio.toFixed(2)}:1 (mínimo requerido ${pair.minRatio}:1).`,
        recommendation: "Ajusta los tokens de color para cumplir 4.5:1 (fg/bg, on-primary/primary) o 3:1 (accent/bg, muted/bg).",
        location,
        locationKey: buildLocationKey("QA-DI-002", location),
      });
    }
  }

  return findings;
}

/** QA-DI-003 — un token de paleta cuyo `valor` fue rechazado por `sanitizeCssValue` (nunca llegó a emitirse como `--pf-<slug>`). */
function checkDI003(tokens: DesignTokens): QaFindingInput[] {
  const findings: QaFindingInput[] = [];

  for (const entry of tokens.paleta) {
    const slug = slugify(entry.token);
    if (!slug) continue;
    if (sanitizeCssValue(entry.valor) !== null) continue;

    const location = { selectorHash: `token-${slug}` };
    findings.push({
      checkCode: "QA-DI-003",
      category: "diseno",
      severity: "minor",
      blocking: false,
      source: "det",
      title: "Un token de paleta se descartó por contener valores CSS hostiles",
      description: `El token "${entry.token}" no se emitió como --pf-${slug} — su valor fue rechazado por sanitización.`,
      recommendation: "Revisa el valor del token en la dirección creativa — probablemente incluye caracteres no válidos en un valor CSS (`;`, `{`, `url(`, etc.).",
      location,
      locationKey: buildLocationKey("QA-DI-003", location),
    });
  }

  return findings;
}

/**
 * QA-DI-004 — un rol semántico (`primary`/`fg`/`bg`) no matcheó ningún token
 * de la paleta por keyword (nombre ni `uso`) y por lo tanto tomó el camino de
 * fallback de `pickRole` en vez de un valor propio de la dirección. Reusa
 * `findRoleValue` (misma heurística que `directionTokensToCssVars`) en vez de
 * comparar contra el valor final — así no importa si el fallback dinámico
 * (p.ej. `paleta[0].valor` para `primary`) coincide por casualidad con un
 * valor real de la paleta.
 */
function checkDI004(tokens: DesignTokens): QaFindingInput[] {
  const fellBackRoles: string[] = [];

  if (findRoleValue(tokens.paleta, BG_GENERAL_KEYWORDS) === null && findRoleValue(tokens.paleta, BG_GENERIC_KEYWORDS) === null) {
    fellBackRoles.push("bg");
  }
  if (findRoleValue(tokens.paleta, PRIMARY_KEYWORDS) === null) fellBackRoles.push("primary");
  if (findRoleValue(tokens.paleta, FG_KEYWORDS) === null) fellBackRoles.push("fg");

  if (fellBackRoles.length === 0) return [];

  const location = { selectorHash: "role-fallback" };
  return [
    {
      checkCode: "QA-DI-004",
      category: "diseno",
      severity: "minor",
      blocking: false,
      source: "det",
      title: "Un rol semántico (primary/fg/bg) no matcheó ningún token y cayó al fallback",
      description: `Los siguientes roles no matchearon ningún token de la paleta por nombre ni por uso, y tomaron el valor de fallback: ${fellBackRoles.join(", ")}.`,
      recommendation:
        "Nombra o describe (`uso`) al menos un token de la paleta con palabras clave del rol (p.ej. \"fondo\", \"texto\", \"marca\") para que el rol tome un valor propio de la dirección.",
      location,
      locationKey: buildLocationKey("QA-DI-004", location),
    },
  ];
}

const FONT_FAMILY_FROM_STACK_RE = /^'([^']*)'/;

function extractFontFamily(stack: string): string | null {
  const match = FONT_FAMILY_FROM_STACK_RE.exec(stack);
  return match ? match[1]! : null;
}

/** QA-DI-005 — la familia display o body degradó a `NEUTRAL_FONT_FAMILY` ("sans-serif") tras sanear el nombre. */
function checkDI005(vars: Record<string, string>): QaFindingInput[] {
  const findings: QaFindingInput[] = [];
  const slots: readonly ["display" | "body", string][] = [
    ["display", vars["--pf-font-display"] ?? ""],
    ["body", vars["--pf-font-body"] ?? ""],
  ];

  for (const [slot, stack] of slots) {
    const family = extractFontFamily(stack);
    if (family !== NEUTRAL_FONT_FAMILY) continue;

    const location = { slot: `tipografia.${slot}` };
    findings.push({
      checkCode: "QA-DI-005",
      category: "diseno",
      severity: "minor",
      blocking: false,
      source: "det",
      title: "La tipografía display o body degradó a la familia genérica sans-serif",
      description: `--pf-font-${slot} quedó en la familia genérica "${NEUTRAL_FONT_FAMILY}" (el nombre original probablemente quedó vacío tras sanear caracteres hostiles).`,
      recommendation: "Revisa el nombre de familia tipográfica de la dirección — probablemente quedó vacío tras sanear caracteres hostiles.",
      location,
      locationKey: buildLocationKey("QA-DI-005", location),
    });
  }

  return findings;
}

/**
 * Corre DI-001..005 sobre unos `designTokens` (dirección `chosen`).
 * `run-deterministic.ts` solo la invoca cuando el proyecto SÍ tiene una
 * dirección `chosen` — sin tokens no hay nada que evaluar, y ese caso lo
 * cubre `checkDI006` por separado.
 */
export function checkDesignTokens(tokens: DesignTokens): QaFindingInput[] {
  const vars = directionTokensToCssVars(tokens);
  return [...checkDI001(vars), ...checkDI002(vars), ...checkDI003(tokens), ...checkDI004(tokens), ...checkDI005(vars)];
}

/** QA-DI-006 — el proyecto no tiene una dirección creativa `chosen`; el preview cae a los tokens default. */
export function checkNoChosenDirection(): QaFindingInput {
  const location = { selectorHash: "no-chosen-direction" };
  return {
    checkCode: "QA-DI-006",
    category: "diseno",
    severity: "major",
    blocking: false,
    source: "det",
    title: "El proyecto no tiene una dirección creativa chosen — el preview usa tokens default",
    description: "El proyecto no tiene ninguna dirección creativa marcada como chosen; la landing se está previsualizando con los tokens neutros por defecto, no con la dirección real del cliente.",
    recommendation: "Elige una dirección creativa en la estación 'direcciones' antes de avanzar a producción.",
    location,
    locationKey: buildLocationKey("QA-DI-006", location),
  };
}
