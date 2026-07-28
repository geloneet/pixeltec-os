import { describe, expect, test } from "vitest";
import {
  renderFindings,
  validateEgressConfig,
  type Finding,
  type ValidationResult,
} from "./validate-egress-config";

/**
 * Contrato E0g-1: el validador reproduce la semántica fail-closed de los
 * guards SIN imprimir valores. Todos los valores de estos tests son
 * sintéticos.
 */

const SECRETO_SINTETICO = "cron-secret-sintetico-para-tests";

function statuses(result: ValidationResult, name: string): string[] {
  return result.findings.filter((f: Finding) => f.name === name).map((f) => f.status);
}

/** Configuración productiva completa 100% sintética. */
function prodSintetica(): Record<string, string> {
  return {
    EGRESS_EMAIL_MODE: "live",
    EGRESS_WHATSAPP_MODE: "live",
    EGRESS_VPS_MODE: "allowlist",
    EGRESS_VPS_HOST_ALLOWLIST: "vps.example.test",
    EGRESS_R2_MODE: "live",
    EGRESS_R2_ALLOW_DELETE: "true",
    EGRESS_META_MODE: "live",
    EGRESS_META_ALLOW_CREDENTIAL_READ: "true",
    EGRESS_META_ALLOW_PUBLISH: "true",
    EGRESS_AI_MODE: "live",
    EGRESS_AI_TARGET_ALLOWLIST: "anthropic:model-example,openai:model-example",
    EGRESS_INTERNAL_MODE: "allowlist",
    EGRESS_INTERNAL_TARGET_ALLOWLIST: "pixelbot:127.0.0.1:3011",
    CRON_EXECUTION_MODE: "enabled",
    CRON_SECRET: SECRETO_SINTETICO,
  };
}

describe("perfil dev — fail-closed es el estado natural", () => {
  test("todo ausente es válido: cero hallazgos, ok=true", () => {
    const result = validateEgressConfig({}, "dev");
    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  test("un modo inválido se reporta y falla", () => {
    const result = validateEgressConfig({ EGRESS_EMAIL_MODE: "enabled" }, "dev");
    expect(statuses(result, "EGRESS_EMAIL_MODE")).toContain("invalid");
    expect(result.ok).toBe(false);
  });

  test("live sin el flag global queda marcado (el guard lo bloquearía)", () => {
    const result = validateEgressConfig({ EGRESS_EMAIL_MODE: "live" }, "dev");
    expect(statuses(result, "EGRESS_EMAIL_MODE")).toContain("invalid");
  });

  test("modo allowlist sin lista se reporta como missing", () => {
    const result = validateEgressConfig({ EGRESS_R2_MODE: "allowlist" }, "dev");
    expect(statuses(result, "EGRESS_R2_BUCKET_ALLOWLIST")).toEqual(["missing"]);
  });

  test("IA activa sin target allowlist falla incluso en dev", () => {
    const result = validateEgressConfig(
      { EGRESS_AI_MODE: "live", EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION: "true" },
      "dev"
    );
    expect(statuses(result, "EGRESS_AI_TARGET_ALLOWLIST")).toEqual(["missing"]);
  });

  test("PixelBot activo sin target allowlist falla", () => {
    const result = validateEgressConfig({ EGRESS_INTERNAL_MODE: "allowlist" }, "dev");
    expect(statuses(result, "EGRESS_INTERNAL_TARGET_ALLOWLIST")).toEqual(["missing"]);
  });

  test("un booleano con valor distinto de true es inválido (false no es ausencia)", () => {
    const result = validateEgressConfig({ EGRESS_R2_ALLOW_DELETE: "yes" }, "dev");
    expect(statuses(result, "EGRESS_R2_ALLOW_DELETE")).toEqual(["invalid"]);
  });
});

describe("perfil predeploy — contrato de producción", () => {
  test("producción sin modos explícitos es inválida: los 8 modos en missing", () => {
    const result = validateEgressConfig({}, "predeploy");
    for (const mode of [
      "EGRESS_EMAIL_MODE",
      "EGRESS_WHATSAPP_MODE",
      "EGRESS_VPS_MODE",
      "EGRESS_R2_MODE",
      "EGRESS_META_MODE",
      "EGRESS_AI_MODE",
      "EGRESS_INTERNAL_MODE",
      "CRON_EXECUTION_MODE",
    ]) {
      expect(statuses(result, mode)).toEqual(["missing"]);
    }
    expect(result.ok).toBe(false);
  });

  test("mínimo privilegio: R2 activo SIN delete es un estado válido de producción", () => {
    const env = prodSintetica();
    delete (env as Record<string, string | undefined>).EGRESS_R2_ALLOW_DELETE;
    const result = validateEgressConfig(env, "predeploy");
    expect(statuses(result, "EGRESS_R2_ALLOW_DELETE")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("mínimo privilegio: Meta activo SIN credential read ni publish es válido", () => {
    const env = prodSintetica();
    delete (env as Record<string, string | undefined>).EGRESS_META_ALLOW_CREDENTIAL_READ;
    delete (env as Record<string, string | undefined>).EGRESS_META_ALLOW_PUBLISH;
    const result = validateEgressConfig(env, "predeploy");
    expect(statuses(result, "EGRESS_META_ALLOW_CREDENTIAL_READ")).toEqual([]);
    expect(statuses(result, "EGRESS_META_ALLOW_PUBLISH")).toEqual([]);
    expect(result.ok).toBe(true);
  });

  test("capacidad declarada r2Delete con variable ausente → missing", () => {
    const env = prodSintetica();
    delete (env as Record<string, string | undefined>).EGRESS_R2_ALLOW_DELETE;
    const result = validateEgressConfig(env, "predeploy", { r2Delete: true });
    expect(statuses(result, "EGRESS_R2_ALLOW_DELETE")).toEqual(["missing"]);
    expect(result.ok).toBe(false);
  });

  test("capacidades declaradas de Meta con variables ausentes → missing cada una", () => {
    const env = prodSintetica();
    delete (env as Record<string, string | undefined>).EGRESS_META_ALLOW_CREDENTIAL_READ;
    delete (env as Record<string, string | undefined>).EGRESS_META_ALLOW_PUBLISH;
    const result = validateEgressConfig(env, "predeploy", {
      metaCredentialRead: true,
      metaPublish: true,
    });
    expect(statuses(result, "EGRESS_META_ALLOW_CREDENTIAL_READ")).toEqual(["missing"]);
    expect(statuses(result, "EGRESS_META_ALLOW_PUBLISH")).toEqual(["missing"]);
  });

  test("las tres capacidades declaradas con true → válido", () => {
    const result = validateEgressConfig(prodSintetica(), "predeploy", {
      r2Delete: true,
      metaCredentialRead: true,
      metaPublish: true,
    });
    expect(result.ok).toBe(true);
  });

  test('valores "false", "1" y "yes" definidos son inválidos aun sin capacidad declarada', () => {
    for (const valor of ["false", "1", "yes"]) {
      const result = validateEgressConfig(
        { ...prodSintetica(), EGRESS_META_ALLOW_PUBLISH: valor },
        "predeploy"
      );
      expect(statuses(result, "EGRESS_META_ALLOW_PUBLISH")).toEqual(["invalid"]);
    }
  });

  test("los flags outside-production presentes son forbidden — incluso en false", () => {
    const env = {
      ...prodSintetica(),
      EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION: "false",
      CRON_ALLOW_OUTSIDE_PRODUCTION: "true",
    };
    const result = validateEgressConfig(env, "predeploy");
    expect(statuses(result, "EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION")).toEqual(["forbidden"]);
    expect(statuses(result, "CRON_ALLOW_OUTSIDE_PRODUCTION")).toEqual(["forbidden"]);
    expect(result.ok).toBe(false);
  });

  test("EGRESS_DEFAULT_MODE presente es forbidden: producción declara canal por canal", () => {
    const result = validateEgressConfig({ ...prodSintetica(), EGRESS_DEFAULT_MODE: "live" }, "predeploy");
    expect(statuses(result, "EGRESS_DEFAULT_MODE")).toEqual(["forbidden"]);
  });

  test("CRON_SECRET ausente es un requisito de secreto, separado de la política", () => {
    const env = prodSintetica();
    delete (env as Record<string, string | undefined>).CRON_SECRET;
    const result = validateEgressConfig(env, "predeploy");
    const hallazgo = result.findings.find((f) => f.name === "CRON_SECRET");
    expect(hallazgo?.status).toBe("missing");
    expect(hallazgo?.note).toContain("secreto operativo");
  });

  test("configuración productiva sintética completa: ok=true", () => {
    const result = validateEgressConfig(prodSintetica(), "predeploy");
    expect(result.findings.filter((f) => f.status !== "present")).toEqual([]);
    expect(result.ok).toBe(true);
  });
});

describe("la salida jamás lleva valores", () => {
  test("renderFindings no contiene el secreto ni entradas de allowlist", () => {
    const env = {
      ...prodSintetica(),
      EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION: "true",
    };
    const salida = renderFindings(validateEgressConfig(env, "predeploy"));
    expect(salida).not.toContain(SECRETO_SINTETICO);
    expect(salida).not.toContain("vps.example.test");
    expect(salida).not.toContain("anthropic:model-example");
    expect(salida).not.toContain("pixelbot:127.0.0.1:3011");
  });
});
