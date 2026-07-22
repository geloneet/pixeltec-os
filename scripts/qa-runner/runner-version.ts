/**
 * Identidad del binario del qa-runner que persiste en `qa_runs.engine`
 * (T6, cierre del job: "runner: <git sha corto o package version>"). Prefiere
 * el git sha corto (identifica el commit EXACTO desplegado); si no hay
 * repositorio git disponible (la imagen Docker del target `qa-runner` no
 * copia `.git`), cae a la versión de `package.json` — nunca lanza, un
 * runner sin ninguna de las dos fuentes reporta `"unknown"` en vez de tumbar
 * el cierre del job por un detalle de metadata.
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function tryGitShortSha(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function tryPackageVersion(): string | null {
  try {
    const pkg = require("../../package.json") as { version?: string };
    return pkg.version ?? null;
  } catch {
    return null;
  }
}

export function resolveRunnerVersion(): string {
  return tryGitShortSha() ?? tryPackageVersion() ?? "unknown";
}

/** Versión de `playwright` — MISMO paquete que el runner ejecuta (pin exacto en `package.json`, T6). */
export function resolvePlaywrightVersion(): string {
  try {
    const pkg = require("playwright/package.json") as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}
