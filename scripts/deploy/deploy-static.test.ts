import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

/**
 * Validaciones estáticas del deploy manual gobernado (M1A).
 *
 * Contrato: GitHub Actions retirado como camino productivo; el único camino
 * es el wrapper instalado en el VPS + motor extraído DEL SHA aprobado, con
 * release inmutable (git archive) y checkout canónico nunca mutado.
 * Estas pruebas NO ejecutan deploy, build ni docker: solo inspección de
 * contenido y comportamiento de validación de argumentos/lock del wrapper
 * (que falla antes de tocar git o docker).
 */

const ROOT = resolve(__dirname, "../..");
const ENGINE = join(ROOT, "scripts/deploy/production-deploy.sh");
const WRAPPER = join(ROOT, "scripts/deploy/deploy-pixeltec-os-wrapper.sh");
const SHIM = join(ROOT, "deploy.sh");
const WORKFLOWS = join(ROOT, ".github/workflows");

const engine = readFileSync(ENGINE, "utf8");
const wrapper = readFileSync(WRAPPER, "utf8");
const shim = readFileSync(SHIM, "utf8");

const FAKE_SHA = "a".repeat(40);

function hasFlock(): boolean {
  return spawnSync("flock", ["--version"]).status === 0;
}

describe("GitHub Actions retirado como camino productivo", () => {
  test("deploy.yml no existe", () => {
    expect(existsSync(join(WORKFLOWS, "deploy.yml"))).toBe(false);
  });

  test("ningún workflow restante despliega, usa SSH ni toca el VPS", () => {
    const files = existsSync(WORKFLOWS)
      ? readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))
      : [];
    for (const f of files) {
      const body = readFileSync(join(WORKFLOWS, f), "utf8");
      expect(body, `${f} no debe contener SSH/deploy/compose/restart`).not.toMatch(
        /ssh|scp|sshpass|appleboy|docker\s+compose|docker-compose|systemctl|restart|VPS_/i,
      );
    }
  });
});

describe("motor production-deploy.sh", () => {
  test("pasa bash -n", () => {
    expect(() => execFileSync("bash", ["-n", ENGINE])).not.toThrow();
  });

  test("sin dependencias de GitHub Actions", () => {
    expect(engine).not.toMatch(/GITHUB_[A-Z_]+/);
    expect(engine).not.toMatch(/workflow_dispatch|actions\//);
  });

  test("no muta el checkout canónico: sin pull/checkout/switch/reset", () => {
    expect(engine).not.toMatch(/git\s+pull/);
    expect(engine).not.toMatch(/git(\s+-C\s+\S+)?\s+(checkout|switch|reset)\b/);
  });

  test("sin prune y sin set -x", () => {
    expect(engine).not.toMatch(/image\s+prune|system\s+prune/);
    expect(engine).not.toMatch(/^\s*set\s+-x/m);
  });

  test("release inmutable con git archive, sin symlink ni copia del contrato E0", () => {
    expect(engine).toMatch(/git -C "\$APP_DIR" archive "\$SHA"/);
    expect(engine).toMatch(/pixeltec-os-releases/);
    expect(engine).not.toMatch(/ln -s/);
    expect(engine).toMatch(/config --quiet/);
    // Guard: la release rechaza cualquier .env* salvo las DOS plantillas
    // versionadas (lista cerrada — comportamiento fijado en el describe
    // "guard de plantillas env en la release").
    expect(engine).toMatch(/find "\$RELEASE_DIR" -name "\.env\*"/);
    expect(engine).toMatch(/archivo de entorno no permitido/);
  });

  test("la ruta canónica del entorno la fija el motor y llega a config/build/up/rollback", () => {
    expect(engine).toMatch(/PIXELTEC_OS_ENV_FILE="\$APP_DIR\/\.env\.production"/);
    expect(engine).toMatch(/env "PIXELTEC_OS_ENV_FILE=\$PIXELTEC_OS_ENV_FILE"/);
    expect(engine).toMatch(/--env-file "\$PIXELTEC_OS_ENV_FILE"/);
    // Toda invocación compose pasa por el array COMPOSE (config/build/up/rollback).
    const composeCalls = engine.match(/"\$\{COMPOSE\[@\]\}"/g) ?? [];
    expect(composeCalls.length).toBeGreaterThanOrEqual(4);
    // "docker compose" aparece solo una vez: en la definición del array COMPOSE.
    expect(engine.match(/docker compose/g)?.length).toBe(1);
  });

  test("guards de aislamiento de secretos en la release (dockerignore, secret mount, compose)", () => {
    expect(engine).toMatch(/\.dockerignore de la release no excluye/);
    expect(engine).toMatch(/type=secret,id=env_production/);
    expect(engine).toMatch(/no declara el build secret env_production/);
    expect(engine).toMatch(/legible por 'otros'/);
  });

  test("compose fija project name literal y solo recrea app (--no-deps, --no-build)", () => {
    expect(engine).toMatch(/-p "\$PROJECT"/);
    expect(engine).toMatch(/PROJECT=pixeltec-os/);
    const ups = engine.match(/up -d [^\n]*/g) ?? [];
    expect(ups.length).toBeGreaterThan(0);
    for (const up of ups) {
      expect(up).toContain("--no-build");
      expect(up).toContain("--no-deps");
      expect(up.trim().endsWith("app")).toBe(true);
    }
  });

  test("--check-only sale ANTES del build y de la activación", () => {
    const checkExit = engine.indexOf("CHECK-ONLY OK");
    const build = engine.indexOf("build app");
    const up = engine.indexOf("up -d");
    const activeWrite = engine.indexOf('> "$ACTIVE_SHA_FILE"');
    expect(checkExit).toBeGreaterThan(-1);
    for (const later of [build, up, activeWrite]) {
      expect(later).toBeGreaterThan(checkExit);
    }
    // El exit del modo check está pegado al mensaje CHECK-ONLY.
    const tail = engine.slice(checkExit, checkExit + 200);
    expect(tail).toMatch(/exit 0/);
  });

  test("rollback: exige imagen previa, conserva la fallida y registra resultado", () => {
    expect(engine).toMatch(/no existe la imagen etiquetada de la versión activa/);
    expect(engine).toMatch(/conservada para diagnóstico/);
    expect(engine).toMatch(/DEPLOY OK sha=.*rollback=no/);
    expect(engine).toMatch(/rollback=\$\{PREV_SHA:-none\}/);
  });
});

describe("wrapper deploy-pixeltec-os", () => {
  test("pasa bash -n", () => {
    expect(() => execFileSync("bash", ["-n", WRAPPER])).not.toThrow();
  });

  test("sin GITHUB_*, sin sudo interno, sin set -x, sin mutación de checkout", () => {
    expect(wrapper).not.toMatch(/GITHUB_[A-Z_]+/);
    const code = wrapper
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/\bsudo\b/);
    expect(code).not.toMatch(/^\s*set\s+-x/m);
    expect(code).not.toMatch(/git\s+pull/);
    expect(code).not.toMatch(/git(\s+-C\s+\S+)?\s+(checkout|switch|reset)\b/);
  });

  test("usa flock, extrae el motor DEL SHA y valida con bash -n", () => {
    expect(wrapper).toMatch(/flock -n 9/);
    expect(wrapper).toMatch(
      /git -C "\$APP_DIR" show "\$SHA:scripts\/deploy\/production-deploy\.sh"/,
    );
    expect(wrapper).toMatch(/bash -n "\$ENGINE"/);
  });

  test("rechaza SHA inválido antes de tocar git/docker", () => {
    const r = spawnSync("bash", [WRAPPER, "--sha", "abc123"], {
      env: { ...process.env, DEPLOY_EXPECTED_USER: "nadie" },
    });
    expect(r.status).not.toBe(0);
    expect(String(r.stderr)).toMatch(/SHA hexadecimal completo/);
  });

  test("rechaza capability desconocida", () => {
    const r = spawnSync("bash", [WRAPPER, "--sha", FAKE_SHA, "--require-todo"], {
      env: { ...process.env, DEPLOY_EXPECTED_USER: "nadie" },
    });
    expect(r.status).not.toBe(0);
    expect(String(r.stderr)).toMatch(/argumento desconocido/);
  });

  test("exige el usuario operativo esperado", () => {
    const r = spawnSync("bash", [WRAPPER, "--sha", FAKE_SHA], {
      env: { ...process.env, DEPLOY_EXPECTED_USER: "usuario-que-no-somos" },
    });
    expect(r.status).not.toBe(0);
    expect(String(r.stderr)).toMatch(/usuario operativo/);
  });

  test.skipIf(!hasFlock())("el lock impide un segundo deploy concurrente", () => {
    const dir = mkdtempSync(join(tmpdir(), "deploy-lock-"));
    const lock = join(dir, "lock");
    // Proceso que retiene el lock mientras el wrapper intenta adquirirlo.
    const holder = spawnSync("bash", [
      "-c",
      `exec 9>"${lock}"; flock -n 9; ` +
        `DEPLOY_EXPECTED_USER="$(id -un)" DEPLOY_LOCK_FILE="${lock}" ` +
        `bash "${WRAPPER}" --sha ${FAKE_SHA}; echo "rc=$?"`,
    ]);
    expect(String(holder.stdout)).toMatch(/rc=[1-9]/);
    expect(String(holder.stderr)).toMatch(/en curso/);
  });
});

describe("aislamiento de .env.production del build context (M1A ITERATE)", () => {
  const dockerignore = readFileSync(join(ROOT, ".dockerignore"), "utf8");
  const dockerfile = readFileSync(join(ROOT, "Dockerfile"), "utf8");
  const compose = readFileSync(join(ROOT, "docker-compose.yml"), "utf8");

  test(".dockerignore excluye .env.production y todo .env.*, conservando .env.example", () => {
    const lines = dockerignore.split("\n").map((l) => l.trim());
    expect(lines).toContain(".env.production");
    expect(lines).toContain(".env.*");
    expect(lines).toContain(".env");
    expect(lines).toContain("!.env.example");
    // La negación va DESPUÉS de los patrones que excluye.
    expect(lines.indexOf("!.env.example")).toBeGreaterThan(lines.indexOf(".env.*"));
  });

  test("Dockerfile: frontend 1.7 y secret mount solo durante npm run build", () => {
    expect(dockerfile.split("\n")[0]).toBe("# syntax=docker/dockerfile:1.7");
    expect(dockerfile).toMatch(
      /RUN --mount=type=secret,id=env_production,target=\/app\/\.env\.production,required=true \\\n\s+npm run build/,
    );
  });

  test("Dockerfile no expone .env.production por COPY/ARG/ENV", () => {
    const code = dockerfile
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/COPY[^\n]*\.env/);
    expect(code).not.toMatch(/^\s*ARG[^\n]*(ENV_|SECRET|KEY|TOKEN|PASSWORD)/m);
    expect(code).not.toMatch(/^\s*ENV[^\n]*(SECRET|KEY|TOKEN|PASSWORD)/m);
  });

  test("runner final no copia .env.production", () => {
    const runner = dockerfile.slice(dockerfile.indexOf("AS runner"));
    expect(runner).not.toMatch(/\.env/);
  });

  test("compose declara el build secret solo para app y su fuente parametrizada", () => {
    expect(compose).toMatch(/build:\n\s+context: \.\n\s+dockerfile: Dockerfile\n(\s+#[^\n]*\n)*\s+secrets:\n\s+- env_production/);
    expect(compose).toMatch(/secrets:\n\s+env_production:\n\s+file: \$\{PIXELTEC_OS_ENV_FILE:-\.env\.production\}/);
    // El secreto jamás como variable de entorno del build.
    expect(compose).not.toMatch(/args:[^\n]*env/i);
  });

  test("compose usa PIXELTEC_OS_ENV_FILE en TODOS los env_file (app, qa-runner, migrator, seed)", () => {
    const refs = compose.match(/env_file:(\n\s+- |\s)\$\{PIXELTEC_OS_ENV_FILE:-\.env\.production\}/g) ?? [];
    expect(refs.length).toBe(4);
    // Cero referencias env_file sin parametrizar.
    expect(compose).not.toMatch(/env_file:(\n\s+- |\s)\.env\.production/);
  });

  test("el wrapper no permite sobrescribir la ruta del entorno por argumentos", () => {
    expect(wrapper).not.toMatch(/PIXELTEC_OS_ENV_FILE/);
    const r = spawnSync(
      "bash",
      [WRAPPER, "--sha", FAKE_SHA, "--env-file", "/tmp/x"],
      { env: { ...process.env, DEPLOY_EXPECTED_USER: "nadie" } },
    );
    expect(r.status).not.toBe(0);
    expect(String(r.stderr)).toMatch(/argumento desconocido/);
  });
});

describe("guard de plantillas env en la release (F-M1B-1)", () => {
  // Ejecuta la condición REAL del guard: extrae la asignación ENV_LEAK del
  // motor y la corre contra un directorio temporal con archivos plantados.
  const assignment = engine.match(/ENV_LEAK="\$\(find[\s\S]*?-print -quit\)"/)?.[0];

  function envLeak(entries: { name: string; symlink?: boolean }[]): string {
    expect(assignment, "la asignación ENV_LEAK debe existir en el motor").toBeDefined();
    const dir = mkdtempSync(join(tmpdir(), "release-guard-"));
    try {
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.symlink) symlinkSync("/dev/null", p);
        else writeFileSync(p, "x=1\n");
      }
      const r = spawnSync("bash", [
        "-c",
        `RELEASE_DIR=${JSON.stringify(dir)}\n${assignment}\nprintf '%s' "$ENV_LEAK"`,
      ]);
      expect(r.status).toBe(0);
      return String(r.stdout).trim();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test("permite exactamente las dos plantillas versionadas", () => {
    expect(envLeak([{ name: ".env.example" }, { name: ".env.production.example" }])).toBe("");
  });

  test("rechaza .env.production real", () => {
    expect(envLeak([{ name: ".env.production" }])).toMatch(/\/\.env\.production$/);
  });

  test("rechaza .env, .env.local, .env.test y .env.secret", () => {
    expect(envLeak([{ name: ".env" }])).toMatch(/\/\.env$/);
    expect(envLeak([{ name: ".env.local" }])).toMatch(/\/\.env\.local$/);
    expect(envLeak([{ name: ".env.test" }])).toMatch(/\/\.env\.test$/);
    expect(envLeak([{ name: ".env.secret" }])).toMatch(/\/\.env\.secret$/);
  });

  test("rechaza un symlink .env.production aunque las plantillas estén presentes", () => {
    expect(
      envLeak([
        { name: ".env.example" },
        { name: ".env.production.example" },
        { name: ".env.production", symlink: true },
      ]),
    ).toMatch(/\/\.env\.production$/);
  });

  test("la allowlist es cerrada y explícita: sin patrones amplios", () => {
    expect(engine).not.toMatch(/! -name "\*\.example"/);
    expect(engine).not.toMatch(/\.env\*\.example/);
    // Exactamente las dos excepciones literales, en el único find del motor.
    const exceptions = engine.match(/! -name "[^"]*"/g) ?? [];
    expect(exceptions).toEqual([
      '! -name ".env.example"',
      '! -name ".env.production.example"',
    ]);
  });

  test(".dockerignore NO re-incluye .env.production.example en el build context", () => {
    const lines = readFileSync(join(ROOT, ".dockerignore"), "utf8")
      .split("\n")
      .map((l) => l.trim());
    expect(lines).not.toContain("!.env.production.example");
    // La única re-inclusión env del contexto sigue siendo .env.example.
    expect(lines.filter((l) => l.startsWith("!.env"))).toEqual(["!.env.example"]);
  });
});

describe("shim deploy.sh", () => {
  test("pasa bash -n y termina en exit 1 sin efectos", () => {
    expect(() => execFileSync("bash", ["-n", SHIM])).not.toThrow();
    const r = spawnSync("bash", [SHIM]);
    expect(r.status).toBe(1);
    expect(String(r.stderr)).toMatch(/deshabilitado/);
    expect(String(r.stderr)).toMatch(/deploy-pixeltec-os/);
  });

  test("cero Git, Docker o red dentro del shim", () => {
    const body = shim
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(body).not.toMatch(/\bgit\s/);
    expect(body).not.toMatch(/\bdocker\s/i);
    expect(body).not.toMatch(/curl|wget|\bssh\b/);
  });
});
