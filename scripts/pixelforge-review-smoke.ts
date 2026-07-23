/**
 * Smoke e2e completo del gate de cierre de PF-F9 (§17 del plan formal,
 * capa de Revisión humana de PixelForge) — PF-F9 T7.
 *
 * SOLO SMOKE, entorno 100% desechable: NUNCA toca la DB de prod/dev (5437) —
 * levanta su propio Postgres 16 en el puerto 5500 (`pf-f9-smoke-db`, DISTINTO
 * del `pf-f8-smoke-db`/5499 de F8 T8 para poder correr en paralelo), aplica
 * TODAS las migraciones del árbol (incluida la 0026 de F9) desde cero,
 * siembra un proyecto hasta blueprint sellado + dirección chosen (mismo
 * patrón de `pixelforge-qa-smoke.ts`), y dispara la secuencia completa del
 * ciclo de revisión vía HTTP real contra un Next dev server bare (puerto
 * 9010, DISTINTO del 9007 de qa-smoke):
 *
 *   Producción con page version → QA asociado → abrir revisión → comentar
 *   una sección (nodeId real) → solicitar cambios (→ estación correcta
 *   reabierta) → nueva versión → QA nuevo → resolver comentarios (incluido
 *   el bloqueante) → aceptar riesgos si existen → aprobación humana →
 *   release-ready visible → componer una versión posterior → la aprobación
 *   queda `superseded` automáticamente.
 *
 * compose_page_tree y QA disparan IA real (Anthropic) — nada mockeado. El
 * QA necesita su fase de navegador para cerrar con veredicto (`finalize.ts`
 * exige `browserStatus` terminal), así que este script arranca el
 * qa-runner LOCAL igual que qa-smoke (opción (a) del brief T7 — no existe
 * un modo de QA sin fase de navegador, confirmado leyendo `finalize.ts`).
 *
 * Al terminar (éxito o error) el `finally` derriba TODO: mata dev server +
 * qa-runner, destruye el contenedor Postgres, borra el `.env.smoke` temporal
 * (vive en el scratchpad, fuera del árbol versionado).
 *
 * Uso: ./node_modules/.bin/tsx scripts/pixelforge-review-smoke.ts
 * Requiere: Docker, y que /home/ubuntu/pixeltec-os/.env tenga
 * ANTHROPIC_API_KEY + R2_* reales (se copian al .env.smoke temporal).
 */
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { randomUUID, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import type * as SchemaModule from "@/lib/db/schema";

// ─── Config ─────────────────────────────────────────────────────────────────
const CONTAINER_NAME = "pf-f9-smoke-db";
const PG_PORT = 5500;
const DB_URL = `postgres://pfsmoke:pfsmoke@127.0.0.1:${PG_PORT}/pixelforge_smoke`;
const DEV_PORT = 9010;
const APP_BASE_URL = `http://localhost:${DEV_PORT}`;
const REAL_ENV_PATH = "/home/ubuntu/pixeltec-os/.env";
const SCRATCHPAD_DIR = "/tmp/claude-1000/-home-ubuntu/6c54ecff-83bc-4fb4-be96-d18515c5021c/scratchpad";
const ENV_SMOKE_PATH = path.join(SCRATCHPAD_DIR, ".env.smoke-f9");
const DEV_LOG_PATH = path.join(SCRATCHPAD_DIR, "pf-f9-dev-server.log");
const RUNNER_LOG_PATH = path.join(SCRATCHPAD_DIR, "pf-f9-qa-runner.log");
const REPO_ROOT = "/home/ubuntu/pixeltec-os/.claude/worktrees/pixelforge-f1";

const SMOKE_EMAIL = "review-smoke-f9@example.com";
const SMOKE_PASSWORD = "SmokeF9-" + randomBytes(6).toString("hex");
const QA_PREVIEW_TOKEN_SECRET = randomBytes(32).toString("hex");

interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}
const results: CheckResult[] = [];
function check(label: string, ok: boolean, detail?: string): void {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "OK" : "FALLA"} — ${label}${detail ? ` (${detail})` : ""}`);
}

function log(msg: string): void {
  console.log(`\n[smoke] ${msg}`);
}

/** Corte deliberado de la secuencia por política del brief (p.ej. verdict `fail` dos veces seguidas) — NO un fallo silencioso, se reporta BLOCKED. */
class SmokeBlockedError extends Error {}

// ─── Fase 1: Postgres desechable ────────────────────────────────────────────
function startDisposablePostgres(): void {
  log(`Levantando Postgres desechable (${CONTAINER_NAME}, puerto ${PG_PORT})...`);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  execSync(
    `docker run --rm -d --name ${CONTAINER_NAME} ` +
      `-e POSTGRES_USER=pfsmoke -e POSTGRES_PASSWORD=pfsmoke -e POSTGRES_DB=pixelforge_smoke ` +
      `-p 127.0.0.1:${PG_PORT}:5432 postgres:16-alpine`,
    { stdio: "inherit" }
  );
}

async function waitForPostgres(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    const probe = postgres(DB_URL, { max: 1 });
    try {
      await probe.unsafe("select 1");
      await probe.end();
      return;
    } catch (err) {
      lastErr = err;
      await probe.end({ timeout: 1 }).catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Postgres desechable no respondió a tiempo: ${String(lastErr)}`);
}

async function applyMigrations(): Promise<void> {
  log("Aplicando TODAS las migraciones del árbol (incluida 0026, F9) con drizzle-orm/postgres-js migrator...");
  const migrationClient = postgres(DB_URL, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
}

// ─── Fase 2: .env.smoke ─────────────────────────────────────────────────────
function parseEnvFile(filePath: string): Record<string, string> {
  const raw = fs.readFileSync(filePath, "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function buildSmokeEnv(): Record<string, string> {
  const real = parseEnvFile(REAL_ENV_PATH);
  const smoke: Record<string, string> = {
    ...real,
    DATABASE_URL: DB_URL,
    QA_PREVIEW_TOKEN_SECRET,
    QA_INTERNAL_APP_URL: APP_BASE_URL,
    NEXTAUTH_URL: APP_BASE_URL,
    NEXT_PUBLIC_APP_URL: APP_BASE_URL,
    // Nunca disparar notificaciones reales (WhatsApp/email) desde el smoke.
    RESEND_API_KEY: "",
    WHATSAPP_ACCESS_TOKEN: "",
    SEED_ADMIN_EMAIL: "",
    SEED_ADMIN_PASSWORD: "",
  };
  return smoke;
}

function writeEnvSmokeFile(env: Record<string, string>): void {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_SMOKE_PATH, lines.join("\n") + "\n", { mode: 0o600 });
  log(`.env.smoke temporal escrito en ${ENV_SMOKE_PATH} (fuera del árbol versionado).`);
}

// ─── Fase 3: seed de fixture (mismo patrón que qa-smoke: inserts directos, artifacts sellados) ──
interface SeededFixture {
  userId: string;
  userName: string;
  clientId: string;
  projectId: string;
  directionChosenId: string;
}

async function seedFixture(schema: typeof SchemaModule, db: any, eq: any): Promise<SeededFixture> {
  log("Sembrando fixture (usuario/cliente/proyecto/artifacts sellados/direcciones)...");
  const passwordHash = await bcrypt.hash(SMOKE_PASSWORD, 10);
  const userId = randomUUID();
  const userName = "Review Smoke F9";
  await db.insert(schema.users).values({
    id: userId,
    email: SMOKE_EMAIL,
    passwordHash,
    name: userName,
    role: "staff",
  });

  const clientId = randomUUID();
  await db.insert(schema.clients).values({
    id: clientId,
    ownerId: userId,
    source: "portal",
    name: "Cliente Review Smoke F9",
  });

  const projectId = randomUUID();
  await db.insert(schema.pixelforgeProjects).values({
    id: projectId,
    ownerId: userId,
    clientId,
    clientCrmId: "crm-review-smoke-f9",
    title: "Landing Review Smoke F9",
    brainDump:
      "Estudio de fisioterapia deportiva en Monterrey, atiende lesiones de corredores y ciclistas, " +
      "quiere transmitir rigor clínico y resultados medibles para captar atletas amateur serios.",
    currentStation: "produccion",
    status: "in_progress",
  });

  const now = new Date();
  const sealedBase = { sealedAt: now, sealedById: userId, sealedByName: userName, status: "sealed" as const };

  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "context_brief",
    ...sealedBase,
    sealedContent: {
      confirmados: [
        {
          titulo: "Especialización en lesiones deportivas",
          detalle: "El estudio atiende específicamente lesiones de corredores y ciclistas.",
          confianza: "alta",
          evidencias: [{ sourceRef: "braindump", cita: "atiende lesiones de corredores y ciclistas" }],
        },
      ],
      inferidos: [
        {
          titulo: "Audiencia de atletas amateur serios",
          detalle: "Clientes que entrenan con disciplina y buscan resultados medibles, no solo alivio.",
          confianza: "media",
          evidencias: [{ sourceRef: "braindump", cita: "atletas amateur serios" }],
        },
      ],
      faltantes: [
        { titulo: "Tarifario", detalle: "No hay precios de referencia en el brain dump.", confianza: "baja", evidencias: [] },
      ],
      contradicciones: [],
      resumen:
        "Estudio de fisioterapia deportiva en Monterrey orientado a corredores y ciclistas amateur serios " +
        "que buscan rigor clínico y resultados medibles.",
    },
    currentDraft: null,
  });

  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "landing_dna",
    ...sealedBase,
    sealedContent: {
      propuestaValor: "Recuperación con protocolo clínico, medida en semanas, no en 'algún día'.",
      audiencia: {
        descripcion: "Corredores y ciclistas amateur de 28-50 años que entrenan con disciplina.",
        dolores: ["Lesiones que regresan por rehabilitación incompleta", "Falta de métricas objetivas de progreso"],
        objeciones: ["¿Esto es solo para atletas profesionales?", "¿Vale la pena el costo vs un fisio genérico?"],
      },
      tono: { voz: "clínico, preciso, orientado a datos", atributos: ["riguroso", "medible", "deportivo"] },
      mensajesClave: [
        {
          mensaje: "Protocolo de recuperación medido semana a semana",
          evidencias: [{ sourceRef: "braindump", cita: "atiende lesiones de corredores y ciclistas" }],
        },
      ],
      llamadosAccion: [{ texto: "Agenda tu evaluación", intencion: "agenda" }],
      evidencias: [{ sourceRef: "braindump", cita: "atiende lesiones de corredores y ciclistas" }],
    },
    currentDraft: null,
  });

  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "visual_dna",
    ...sealedBase,
    sealedContent: {
      direccionGeneral: "Clínico deportivo, preciso, con acentos de rendimiento atlético.",
      paleta: { estrategia: "azul clínico sobre blanco, acento verde rendimiento para CTAs", contraste: "alto" },
      tipografia: { caracterTitulos: "técnica y firme", caracterCuerpo: "legible, neutra" },
      espaciado: "equilibrado",
      motivosVisuales: ["línea de progreso", "pulso/frecuencia", "silueta en movimiento"],
      antiPatrones: ["iconografía de hospital genérica", "fotos stock de doctores sonriendo"],
      influencias: [],
    },
    currentDraft: null,
  });

  const CONTRASTING_PALETA = [
    { token: "Fondo General", uso: "fondo general de la pagina, superficie base", valor: "#ffffff" },
    { token: "Color Primario", uso: "marca, botones principales", valor: "#0f4c81" },
    { token: "Color Acento", uso: "CTA, destacados", valor: "#15803d" },
    { token: "Texto Principal", uso: "texto de cuerpo, contenido oscuro", valor: "#0f172a" },
    { token: "Gris Sutil", uso: "bordes, elementos muted", valor: "#64748b" },
  ];

  function buildDirection(slot: number, chosen: boolean, paleta: typeof CONTRASTING_PALETA) {
    return {
      id: randomUUID(),
      projectId,
      slot,
      title: chosen ? "Rigor Medible" : `Alternativa ${slot}`,
      concept: chosen
        ? "Landing que transmite precisión clínica y progreso medible a la vez."
        : `Concepto alternativo ${slot} descartado en la elección.`,
      designTokens: {
        paleta,
        tipografia: { display: "Space Grotesk", body: "Inter", escala: "modular 1.25, base 16px" },
        radios: "suaves" as const,
        espaciado: "equilibrado" as const,
        sombra: "sutil" as const,
      },
      motionDna: {
        personalidad: "preciso y clínico",
        ritmo: "moderado" as const,
        intensidadGlobal: 2 as const,
        firmas: ["barrido de línea de progreso", "conteo ascendente de métricas"],
      },
      signatureMotif: {
        nombre: "La Línea de Progreso",
        descripcion: "Motivo lineal recurrente que representa la curva de recuperación medible.",
        aplicaciones: ["separadores de sección", "icono de carga", "bullets de features"],
      },
      signatureComponent: {
        status: "custom-development-required" as const,
        concept: "Calculadora de semanas estimadas de recuperación por tipo de lesión.",
        businessValue: "Reduce fricción al mostrar expectativa realista antes de agendar evaluación.",
        requiredData: ["tipo de lesión", "semanas promedio por lesión"],
        estimatedComplexity: "medium" as const,
      },
      scores: {
        originalidadConceptual: 74,
        independenciaDeReferencias: 80,
        especificidadDelMotif: 76,
        utilidadDelSignature: 72,
        riesgoGenericidadIA: 24,
      },
      scoreTotal: chosen ? 79 : 61,
      scoresRazones: { porCriterio: "Puntajes estimados de fixture de smoke — no generados por IA." },
      status: chosen ? ("chosen" as const) : ("discarded" as const),
      risks: chosen ? ["El motif de línea puede sentirse repetitivo si se sobreusa"] : [],
    };
  }

  const directionSlot1 = buildDirection(1, false, CONTRASTING_PALETA);
  const directionSlot2 = buildDirection(2, true, CONTRASTING_PALETA);
  const directionSlot3 = buildDirection(3, false, CONTRASTING_PALETA);

  for (const d of [directionSlot1, directionSlot2, directionSlot3]) {
    await db.insert(schema.pixelforgeCreativeDirections).values(d);
  }

  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "direction_decision",
    ...sealedBase,
    sealedContent: {
      chosenDirectionId: directionSlot2.id,
      rationale: "Se eligió por transmitir mejor el rigor clínico sin perder cercanía con el atleta.",
      acceptedRisks: ["El motif de línea puede sentirse repetitivo si se sobreusa"],
      combinedFromDirectionIds: [],
    },
    currentDraft: null,
  });

  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "narrative_blueprint",
    ...sealedBase,
    sealedContent: {
      historia:
        "El visitante es un corredor frustrado por una lesión que 'nunca termina de sanar'; descubre un " +
        "protocolo clínico que mide su progreso semana a semana en vez de prometer alivio vago.",
      actos: [
        {
          orden: 1,
          proposito: "Capturar atención con la promesa central",
          mensaje: "Recuperación con protocolo clínico, medida en semanas.",
          tension: "Mi lesión nunca termina de sanar del todo",
          resolucion: "Un protocolo que mide tu progreso real",
        },
        {
          orden: 2,
          proposito: "Construir confianza clínica",
          mensaje: "Evaluación biomecánica y plan individual, no genérico",
          tension: "¿Es esto solo para atletas profesionales?",
          resolucion: "El protocolo se adapta a tu nivel y tu deporte",
        },
        {
          orden: 3,
          proposito: "Mostrar el proceso simple",
          mensaje: "Evaluación, plan, seguimiento semanal",
          tension: "Parece complicado comprometerse a un protocolo largo",
          resolucion: "Proceso de 3 pasos, primera evaluación en menos de 1 semana",
        },
        {
          orden: 4,
          proposito: "Cerrar con llamado a la acción",
          mensaje: "Agenda tu evaluación hoy",
          tension: "Podría posponerlo indefinidamente",
          resolucion: "Agenda ahora, primera cita disponible esta semana",
        },
      ],
      cinematicMoments: [
        {
          actoOrden: 2,
          descripcion: "La línea de progreso se dibuja lentamente mientras se revela el plan individual.",
          motifConnection: "La Línea de Progreso — acompaña el momento de mayor confianza clínica.",
        },
      ],
      notasProduccion: [
        "Usar iconografía de línea de progreso/pulso en separadores de sección.",
        "El CTA final debe repetir la promesa 'medido semana a semana'.",
      ],
    },
    currentDraft: null,
  });

  await db
    .update(schema.pixelforgeProjects)
    .set({ chosenDirectionId: directionSlot2.id })
    .where(eq(schema.pixelforgeProjects.id, projectId));

  return { userId, userName, clientId, projectId, directionChosenId: directionSlot2.id };
}

// ─── Fase 4: procesos ───────────────────────────────────────────────────────
function spawnLogged(cmd: string, args: string[], env: Record<string, string>, logPath: string, label: string): ChildProcess {
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const child = spawn(cmd, args, {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.pipe(logStream);
  child.stderr?.pipe(logStream);
  child.on("exit", (code, signal) => {
    console.log(`[smoke] ${label} salió (code=${code}, signal=${signal})`);
  });
  return child;
}

async function waitForHttp(url: string, timeoutMs: number, label: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${label} no respondió a tiempo en ${url}: ${String(lastErr)}`);
}

// ─── Fase 5: login HTTP (NextAuth credentials) ──────────────────────────────
interface CookieJar {
  [name: string]: string;
}

function mergeSetCookies(jar: CookieJar, res: Response): void {
  const setCookies = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    jar[name] = value;
  }
}

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function loginViaHttp(email: string, password: string): Promise<CookieJar> {
  const jar: CookieJar = {};
  const csrfRes = await fetch(`${APP_BASE_URL}/api/auth/csrf`);
  mergeSetCookies(jar, csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    redirect: "false",
    json: "true",
  });

  const callbackRes = await fetch(`${APP_BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(jar),
    },
    body: body.toString(),
    redirect: "manual",
  });
  mergeSetCookies(jar, callbackRes);

  const hasSessionCookie = Object.keys(jar).some((k) => k.includes("session-token"));
  if (!hasSessionCookie) {
    const text = await callbackRes.text().catch(() => "");
    throw new Error(`Login HTTP falló — sin cookie de sesión (status ${callbackRes.status}): ${text.slice(0, 300)}`);
  }
  return jar;
}

// ─── Fase 6: helpers de polling API ─────────────────────────────────────────
async function apiGet(jar: CookieJar, urlPath: string): Promise<{ status: number; json: any }> {
  const res = await fetch(`${APP_BASE_URL}${urlPath}`, { headers: { Cookie: cookieHeader(jar) } });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function apiPost(jar: CookieJar, urlPath: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${APP_BASE_URL}${urlPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function pollUntil<T>(
  fn: () => Promise<T>,
  isDone: (v: T) => boolean,
  timeoutMs: number,
  intervalMs: number,
  label: string
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  while (Date.now() < deadline) {
    last = await fn();
    if (isDone(last)) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando ${label}`);
}

/** Extrae un nodeId real caminando `tree.nodes[]` (mismo shape que valida `treeHasNode` en repos/pixelforge.ts). */
function firstNodeId(tree: unknown): string {
  const nodes = (tree as { nodes?: Array<{ nodeId?: string }> } | null)?.nodes;
  if (!Array.isArray(nodes) || nodes.length === 0 || !nodes[0]?.nodeId) {
    throw new Error(`El árbol compuesto no trae nodes[].nodeId — shape inesperado: ${JSON.stringify(tree).slice(0, 300)}`);
  }
  return nodes[0].nodeId;
}

// ─── main ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  let devServer: ChildProcess | null = null;
  let qaRunner: ChildProcess | null = null;

  const timings: Record<string, number> = {};
  const t0 = Date.now();

  try {
    startDisposablePostgres();
    await waitForPostgres();
    timings.postgresReady = Date.now() - t0;

    const tMigrate = Date.now();
    await applyMigrations();
    timings.migrations = Date.now() - tMigrate;
    check("applyMigrations corrió hasta el final sin error (incluida 0026, F9) contra Postgres real", true);

    process.env.DATABASE_URL = DB_URL;
    const schema = (await import("@/lib/db/schema")) as typeof SchemaModule;
    const { db } = await import("@/lib/db");
    const { eq, desc } = await import("drizzle-orm");
    const { isReleaseReady } = (await import("@/lib/pixelforge/review/stage")) as typeof import("@/lib/pixelforge/review/stage");

    const tSeed = Date.now();
    const fixture = await seedFixture(schema, db, eq);
    timings.seed = Date.now() - tSeed;
    log(`Fixture sembrado: proyecto ${fixture.projectId}, dirección chosen ${fixture.directionChosenId}`);

    const smokeEnv = buildSmokeEnv();
    writeEnvSmokeFile(smokeEnv);

    log(`Arrancando dev server (puerto ${DEV_PORT})...`);
    devServer = spawnLogged(
      path.join(REPO_ROOT, "node_modules/.bin/next"),
      ["dev", "-p", String(DEV_PORT)],
      smokeEnv,
      DEV_LOG_PATH,
      "dev-server"
    );
    await waitForHttp(`${APP_BASE_URL}/api/auth/csrf`, 90_000, "dev server");
    check("dev server bare (9010) arrancó y respondió", true);

    log("Login HTTP vía NextAuth credentials...");
    const jar = await loginViaHttp(SMOKE_EMAIL, SMOKE_PASSWORD);
    check("login HTTP real (NextAuth credentials) obtuvo cookie de sesión", true);

    log("Pre-calentando compilación de la ruta /preview (evita cold-compile en el primer job real del qa-runner)...");
    const tWarm = Date.now();
    try {
      await fetch(`${APP_BASE_URL}/proyectos/pixelforge/${"00000000-0000-0000-0000-000000000000"}/preview`, {
        headers: { Cookie: cookieHeader(jar) },
      });
    } catch {
      // best-effort
    }
    timings.previewPrewarm = Date.now() - tWarm;
    check("pre-warm de /preview disparado (compilación on-demand adelantada)", true, `${timings.previewPrewarm}ms`);

    log("Arrancando qa-runner LOCAL (necesario: el QA no cierra veredicto sin fase de navegador terminal, ver finalize.ts)...");
    qaRunner = spawnLogged(
      path.join(REPO_ROOT, "node_modules/.bin/tsx"),
      ["scripts/qa-runner/index.ts"],
      { ...smokeEnv, QA_INTERNAL_APP_URL: APP_BASE_URL },
      RUNNER_LOG_PATH,
      "qa-runner"
    );
    await new Promise((r) => setTimeout(r, 3000));

    try {
      // ── helpers de flujo ──
      let versionCounter = 0;

      async function composeVersion(label: string): Promise<{ runId: string; pageVersionId: string; version: number; tree: any }> {
        log(`Disparando compose_page_tree REAL (${label})...`);
        const tCompose = Date.now();
        const composeStart = await apiPost(jar, "/api/pixelforge/runs", {
          projectId: fixture.projectId,
          operation: "compose_page_tree",
        });
        check(
          `POST /api/pixelforge/runs compose_page_tree arrancó (${label}) (200, status running)`,
          composeStart.status === 200 && composeStart.json?.status === "running",
          JSON.stringify(composeStart.json)
        );
        const runId = composeStart.json.runId as string;

        const composeFinal = await pollUntil(
          () => apiGet(jar, `/api/pixelforge/runs/${runId}`),
          (r) => r.json?.status === "succeeded" || r.json?.status === "failed",
          6 * 60_000,
          3000,
          `compose_page_tree ${label}`
        );
        timings[`compose_${label}`] = Date.now() - tCompose;
        check(
          `compose_page_tree (${label}) terminó succeeded`,
          composeFinal.json?.status === "succeeded",
          `status=${composeFinal.json?.status}, failureKind=${composeFinal.json?.failureKind ?? "-"}, tokensIn/Out=${composeFinal.json?.tokensIn}/${composeFinal.json?.tokensOut}`
        );
        if (composeFinal.json?.status !== "succeeded") {
          throw new Error(`compose_page_tree (${label}) no llegó a succeeded — no se puede continuar. Ver detalle arriba.`);
        }

        versionCounter += 1;
        const pageVersions = await db
          .select()
          .from(schema.pixelforgePageVersions)
          .where(eq(schema.pixelforgePageVersions.projectId, fixture.projectId))
          .orderBy(desc(schema.pixelforgePageVersions.version));
        const latest = pageVersions[0]!;
        check(
          `page_versions (${label}): ${versionCounter} fila(s) totales, la vigente es v${versionCounter} con tree no nulo`,
          pageVersions.length === versionCounter && latest.version === versionCounter && latest.tree !== null,
          `filas=${pageVersions.length}, versiones=${pageVersions.map((p: any) => p.version).sort().join(",")}, vigente.version=${latest.version}`
        );
        const events = await db
          .select()
          .from(schema.pixelforgeEvents)
          .where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
        check(`evento page_composed insertado tras componer ${label}`, events.some((e: any) => e.type === "page_composed" && e.snapshot?.version === versionCounter));

        return { runId, pageVersionId: latest.id, version: latest.version, tree: latest.tree };
      }

      const isInfraFailure = (r: { json: any }) =>
        r.json?.run?.status === "failed" &&
        r.json?.run?.verdict === null &&
        (r.json?.run?.browserStatus === "failed" || r.json?.run?.browserStatus === "timed_out");

      async function runQaAndPoll(label: string): Promise<{ qaRunId: string; final: { status: number; json: any } }> {
        const start = await apiPost(jar, "/api/pixelforge/qa/runs", { projectId: fixture.projectId });
        check(
          `POST /api/pixelforge/qa/runs ${label} arrancó (200, running)`,
          start.status === 200 && start.json?.status === "running",
          JSON.stringify(start.json)
        );
        const qaRunId = start.json.qaRunId as string;
        let final = await pollUntil(
          () => apiGet(jar, `/api/pixelforge/qa/runs/${qaRunId}`),
          (r) => r.json?.run?.status === "succeeded" || r.json?.run?.status === "failed",
          6 * 60_000,
          3000,
          `QA run ${label}`
        );
        if (isInfraFailure(final)) {
          log(`QA ${label} (${qaRunId}) falló por infraestructura del entorno (browserStatus=${final.json?.run?.browserStatus}, no un veredicto) — reintentando UNA vez...`);
          const retryStart = await apiPost(jar, "/api/pixelforge/qa/runs", { projectId: fixture.projectId });
          const retryQaRunId = retryStart.json.qaRunId as string;
          const retryFinal = await pollUntil(
            () => apiGet(jar, `/api/pixelforge/qa/runs/${retryQaRunId}`),
            (r) => r.json?.run?.status === "succeeded" || r.json?.run?.status === "failed",
            6 * 60_000,
            3000,
            `QA run ${label} (reintento infra)`
          );
          return { qaRunId: retryQaRunId, final: retryFinal };
        }
        return { qaRunId, final };
      }

      /**
       * QA con la política de reintento del brief T7 (paso 2/7): un `verdict
       * 'fail'` NO se manipula — se recompone una vez más (contenido real
       * distinto de la IA) y se reintenta UNA vez. Si tras 2 intentos sigue
       * `fail`, corta la secuencia con `SmokeBlockedError` (→ BLOCKED en el
       * reporte, no un fallo silencioso).
       */
      async function runQaUntilDecided(label: string, recomposeLabel: string): Promise<{ qaRunId: string; verdict: string }> {
        let { qaRunId, final } = await runQaAndPoll(label);
        check(
          `QA ${label} terminó (status succeeded, verdict real reportado sin forzar)`,
          final.json?.run?.status === "succeeded",
          `status=${final.json?.run?.status}, verdict=${final.json?.run?.verdict}, score=${final.json?.run?.scoreTotal}, browserStatus=${final.json?.run?.browserStatus}`
        );
        if (final.json?.run?.status !== "succeeded") {
          throw new SmokeBlockedError(`QA ${label} no cerró succeeded (status=${final.json?.run?.status}) — no es un veredicto, ver detalle arriba.`);
        }
        let verdict = final.json.run.verdict as string;

        if (verdict === "fail") {
          log(`QA ${label} cerró con verdict REAL 'fail' — política del brief: recompón una vez y reintenta UNA vez antes de reportar BLOCKED.`);
          await composeVersion(recomposeLabel);
          const retry = await runQaUntilDecidedInner(`${label} (reintento tras fail)`);
          qaRunId = retry.qaRunId;
          verdict = retry.verdict;
          if (verdict === "fail") {
            throw new SmokeBlockedError(
              `QA volvió a cerrar 'fail' tras 2 intentos reales (${label} y su reintento) — política del brief: reportar BLOCKED, no manipular contenido para forzar otro veredicto.`
            );
          }
        }
        return { qaRunId, verdict };
      }

      // Variante sin recursión de reintento — usada SOLO para el segundo intento interno de arriba.
      async function runQaUntilDecidedInner(label: string): Promise<{ qaRunId: string; verdict: string }> {
        const { qaRunId, final } = await runQaAndPoll(label);
        check(
          `QA ${label} terminó (status succeeded, verdict real reportado sin forzar)`,
          final.json?.run?.status === "succeeded",
          `status=${final.json?.run?.status}, verdict=${final.json?.run?.verdict}, score=${final.json?.run?.scoreTotal}, browserStatus=${final.json?.run?.browserStatus}`
        );
        if (final.json?.run?.status !== "succeeded") {
          throw new SmokeBlockedError(`QA ${label} no cerró succeeded (status=${final.json?.run?.status}) — no es un veredicto, ver detalle arriba.`);
        }
        return { qaRunId, verdict: final.json.run.verdict as string };
      }

      /** Si `pass_with_warnings`, ejerce la aprobación humana del gate EXISTENTE de QA (F8, no F9) para que `current_station` avance a `revision`. */
      async function passExistingQaGateIfNeeded(qaRunId: string, verdict: string, label: string): Promise<void> {
        if (verdict === "pass_with_warnings") {
          log(`Verdict pass_with_warnings (${label}) — ejerciendo aprobación humana del gate F8 existente...`);
          const decisionRes = await apiPost(jar, `/api/pixelforge/qa/runs/${qaRunId}/decision`, {
            decision: "approved",
            reason: "Aprobado en smoke controlado PF-F9 T7 — hallazgos de warnings revisados y aceptados.",
          });
          check(`POST decision approved del gate F8 (${label}) devolvió ok`, decisionRes.status === 200 && decisionRes.json?.ok === true, JSON.stringify(decisionRes.json));
        }
      }

      // ═══ Paso 1: Componer v1 ═══
      log("── Paso 1: Componer v1 ──");
      const v1 = await composeVersion("v1");
      const nodeId = firstNodeId(v1.tree);
      log(`nodeId real extraído del árbol v1 (tree.nodes[0].nodeId): "${nodeId}"`);

      // ═══ Paso 2: QA #1 ═══
      log("── Paso 2: QA #1 ──");
      const qa1 = await runQaUntilDecided("#1", "v (recompuesta tras fail de QA #1)");
      await passExistingQaGateIfNeeded(qa1.qaRunId, qa1.verdict, "QA #1");
      const projectAfterQa1 = await db.select().from(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fixture.projectId));
      check(
        "gate F9 abrió: current_station del proyecto es 'revision' tras QA #1",
        projectAfterQa1[0]?.currentStation === "revision",
        `currentStation=${projectAfterQa1[0]?.currentStation}, verdict=${qa1.verdict}`
      );

      // ═══ Paso 3: Abrir revisión (ronda 1) ═══
      log("── Paso 3: Abrir revisión (ronda 1) ──");
      const openRound1 = await apiPost(jar, "/api/pixelforge/reviews", { projectId: fixture.projectId });
      check(
        "POST /api/pixelforge/reviews abrió ronda 1 (200, roundNumber=1, status=in_review)",
        openRound1.status === 200 && openRound1.json?.review?.roundNumber === 1 && openRound1.json?.review?.status === "in_review",
        JSON.stringify(openRound1.json)
      );
      const review1Id = openRound1.json.review.id as string;
      const review1RowsAfterOpen = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review1Id));
      log(`Query directa — pixelforge_reviews (ronda 1 recién abierta): ${JSON.stringify(review1RowsAfterOpen[0])}`);
      check(
        "query directa: fila pixelforge_reviews ronda 1 con qa_run_id = QA #1",
        review1RowsAfterOpen[0]?.qaRunId === qa1.qaRunId,
        `qaRunId fila=${review1RowsAfterOpen[0]?.qaRunId}, qa1.qaRunId=${qa1.qaRunId}`
      );
      const eventsAfterOpen1 = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const reviewOpenedEvent = eventsAfterOpen1.find((e: any) => e.type === "review_opened");
      log(`Query directa — evento review_opened: ${JSON.stringify(reviewOpenedEvent)}`);
      check("evento review_opened insertado", Boolean(reviewOpenedEvent));

      // ═══ Paso 4: Comentario de sección con nodeId real ═══
      log("── Paso 4: Comentario de sección (nodeId real, blocking) ──");
      const commentRes = await apiPost(jar, `/api/pixelforge/reviews/${review1Id}/comments`, {
        anchorType: "section",
        nodeId,
        body: "Smoke PF-F9 T7 — este bloque necesita ajuste antes de publicar (comentario bloqueante de prueba).",
        blocking: true,
      });
      check(
        "POST comentario de sección (200, status open)",
        commentRes.status === 200 && commentRes.json?.comment?.status === "open",
        JSON.stringify(commentRes.json)
      );
      const comment1Id = commentRes.json.comment.id as string;
      const eventsAfterComment = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const commentAddedEvent = eventsAfterComment.find((e: any) => e.type === "comment_added" && e.snapshot?.commentId === comment1Id);
      log(`Query directa — evento comment_added: ${JSON.stringify(commentAddedEvent)}`);
      check("evento comment_added insertado", Boolean(commentAddedEvent));

      // ═══ Paso 5: Solicitar cambios (changeKind: composicion → regress_station a produccion) ═══
      log("── Paso 5: Solicitar cambios (changeKind='composicion') ──");
      const requestChangesRes = await apiPost(jar, `/api/pixelforge/reviews/${review1Id}/decision`, {
        action: "request_changes",
        changeKind: "composicion",
        reason: "Smoke PF-F9 T7 — se requiere recomponer la landing con ajustes de estructura.",
      });
      check("POST decision request_changes devolvió ok (200)", requestChangesRes.status === 200 && requestChangesRes.json?.ok === true, JSON.stringify(requestChangesRes.json));
      const review1AfterRequest = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review1Id));
      log(`Query directa — pixelforge_reviews ronda 1 tras request_changes: ${JSON.stringify(review1AfterRequest[0])}`);
      check("review ronda 1 status === 'changes_requested'", review1AfterRequest[0]?.status === "changes_requested");
      const projectAfterRequest = await db.select().from(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fixture.projectId));
      check(
        "current_station regresó a 'produccion' tras request_changes",
        projectAfterRequest[0]?.currentStation === "produccion",
        `currentStation=${projectAfterRequest[0]?.currentStation}`
      );
      const eventsAfterRequest = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const changesRequestedEvent = eventsAfterRequest.find((e: any) => e.type === "changes_requested") as any;
      log(`Query directa — evento changes_requested: ${JSON.stringify(changesRequestedEvent)}`);
      check(
        "evento changes_requested con targetStation:'produccion' en el snapshot",
        changesRequestedEvent?.snapshot?.targetStation === "produccion",
        `snapshot=${JSON.stringify(changesRequestedEvent?.snapshot)}`
      );

      // ═══ Paso 6: Nueva versión (v2) — el supersede SÍ debe ocurrir (brief actualizado) ═══
      log("── Paso 6: Recomponer (v2) — supersede de la ronda 1 (changes_requested → superseded) ──");
      const v2 = await composeVersion("v2");
      const review1AfterV2 = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review1Id));
      log(`Query directa — pixelforge_reviews ronda 1 tras componer v2: ${JSON.stringify(review1AfterV2[0])}`);
      check(
        "review ronda 1 pasó a status === 'superseded' (supersedeActiveReviewsInTx cubre changes_requested, GO de Miguel/ampliación sobre el plan base)",
        review1AfterV2[0]?.status === "superseded",
        `status=${review1AfterV2[0]?.status}`
      );
      const eventsAfterV2 = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const reviewSupersededEvent = eventsAfterV2.find((e: any) => e.type === "review_superseded" && e.snapshot?.reviewId === review1Id) as any;
      log(`Query directa — evento review_superseded: ${JSON.stringify(reviewSupersededEvent)}`);
      check(
        "evento review_superseded (no approval_superseded, porque el status previo era changes_requested) con newPageVersionId/newVersion → v2",
        reviewSupersededEvent?.snapshot?.previousStatus === "changes_requested" &&
          reviewSupersededEvent?.snapshot?.newPageVersionId === v2.pageVersionId &&
          reviewSupersededEvent?.snapshot?.newVersion === v2.version,
        `snapshot=${JSON.stringify(reviewSupersededEvent?.snapshot)}`
      );

      // ═══ Paso 7: QA #2 sobre v2 ═══
      log("── Paso 7: QA #2 sobre v2 ──");
      const qa2 = await runQaUntilDecided("#2", "v (recompuesta tras fail de QA #2)");
      await passExistingQaGateIfNeeded(qa2.qaRunId, qa2.verdict, "QA #2");
      const projectAfterQa2 = await db.select().from(schema.pixelforgeProjects).where(eq(schema.pixelforgeProjects.id, fixture.projectId));
      check(
        "gate F9 abrió de nuevo: current_station del proyecto es 'revision' tras QA #2",
        projectAfterQa2[0]?.currentStation === "revision",
        `currentStation=${projectAfterQa2[0]?.currentStation}, verdict=${qa2.verdict}`
      );

      // ═══ Paso 8: Resolver el comentario bloqueante (de la ronda 1, superseded pero conservado) ═══
      log("── Paso 8: Resolver el comentario bloqueante de la ronda 1 (superseded) ──");
      const resolveRes = await apiPost(jar, `/api/pixelforge/reviews/${review1Id}/comments/${comment1Id}/resolution`, {
        finalStatus: "resolved",
        reason: "Smoke PF-F9 T7 — ajuste aplicado en v2, comentario ya no aplica.",
      });
      check("POST resolución de comentario devolvió ok (200)", resolveRes.status === 200 && resolveRes.json?.ok === true, JSON.stringify(resolveRes.json));
      const comment1AfterResolve = await db.select().from(schema.pixelforgeReviewComments).where(eq(schema.pixelforgeReviewComments.id, comment1Id));
      log(`Query directa — pixelforge_review_comments comentario bloqueante tras resolver: ${JSON.stringify(comment1AfterResolve[0])}`);
      check("comentario status === 'resolved'", comment1AfterResolve[0]?.status === "resolved");
      const eventsAfterResolve = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const commentResolvedEvent = eventsAfterResolve.find((e: any) => e.type === "comment_resolved" && e.snapshot?.commentId === comment1Id);
      log(`Query directa — evento comment_resolved: ${JSON.stringify(commentResolvedEvent)}`);
      check("evento comment_resolved insertado", Boolean(commentResolvedEvent));
      const openBlockingAfterResolve = await db
        .select()
        .from(schema.pixelforgeReviewComments)
        .where(eq(schema.pixelforgeReviewComments.projectId, fixture.projectId));
      const stillOpenBlocking = openBlockingAfterResolve.filter((c: any) => c.blocking && c.status === "open");
      check(
        "0 comentarios bloqueantes 'open' en el proyecto tras resolver (precondición de §12.5 para poder aprobar)",
        stillOpenBlocking.length === 0,
        `abiertos bloqueantes restantes=${stillOpenBlocking.length}`
      );

      // ═══ Paso 9: Abrir ronda 2 ═══
      log("── Paso 9: Abrir ronda 2 ──");
      const openRound2 = await apiPost(jar, "/api/pixelforge/reviews", { projectId: fixture.projectId });
      check(
        "POST /api/pixelforge/reviews abrió ronda 2 (200, roundNumber=2, status=in_review)",
        openRound2.status === 200 && openRound2.json?.review?.roundNumber === 2 && openRound2.json?.review?.status === "in_review",
        JSON.stringify(openRound2.json)
      );
      const review2Id = openRound2.json.review.id as string;
      const review2RowsAfterOpen = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review2Id));
      log(`Query directa — pixelforge_reviews (ronda 2 recién abierta): ${JSON.stringify(review2RowsAfterOpen[0])}`);
      check(
        "ronda 2 ancla al QA #2 (qa_run_id coincide)",
        review2RowsAfterOpen[0]?.qaRunId === qa2.qaRunId,
        `qaRunId fila=${review2RowsAfterOpen[0]?.qaRunId}, qa2.qaRunId=${qa2.qaRunId}`
      );

      // ═══ Paso 10: Aceptar riesgos (si hay majors) y aprobar ═══
      log("── Paso 10: Aceptar riesgos y aprobar (ronda 2) ──");
      const qa2Detail = await apiGet(jar, `/api/pixelforge/qa/runs/${qa2.qaRunId}`);
      check("GET qa run #2 con findings devolvió 200", qa2Detail.status === 200, JSON.stringify(qa2Detail.json?.run ?? qa2Detail.json));
      const findings2: any[] = qa2Detail.json?.findings ?? [];
      const majorFindings = findings2.filter((f) => f.severity === "major");
      log(
        `QA #2 verdict=${qa2.verdict} — findings totales=${findings2.length}, majors (requieren riesgo aceptado)=${majorFindings.length}: ` +
          JSON.stringify(majorFindings.map((f) => ({ id: f.id, checkCode: f.checkCode, severity: f.severity, blocking: f.blocking })))
      );
      if (qa2.verdict === "pass") {
        check("verdict 'pass' → 0 findings major obligatorios (esperado, requiredRiskFindings)", majorFindings.length === 0, `majors=${majorFindings.length}`);
      }
      const risks = majorFindings.map((f) => ({
        findingId: f.id as string,
        rationale: "Smoke PF-F9 T7 — riesgo revisado y aceptado explícitamente en entorno desechable.",
      }));

      const approveRes = await apiPost(jar, `/api/pixelforge/reviews/${review2Id}/decision`, {
        action: "approve",
        reason: "Smoke PF-F9 T7 — aprobación humana tras revisar hallazgos y resolver bloqueantes.",
        risks,
      });
      check("POST decision approve (ronda 2) devolvió ok (200)", approveRes.status === 200 && approveRes.json?.ok === true, JSON.stringify(approveRes.json));

      const review2AfterApprove = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review2Id));
      log(`Query directa — pixelforge_reviews ronda 2 tras aprobar: ${JSON.stringify(review2AfterApprove[0])}`);
      check("review ronda 2 status === 'approved'", review2AfterApprove[0]?.status === "approved");

      const eventsAfterApprove = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const riskAcceptedEvents = eventsAfterApprove.filter((e: any) => e.type === "risk_accepted");
      const approvalGrantedEvent = eventsAfterApprove.find((e: any) => e.type === "approval_granted");
      log(`Query directa — eventos risk_accepted (${riskAcceptedEvents.length}): ${JSON.stringify(riskAcceptedEvents.map((e: any) => e.snapshot))}`);
      log(`Query directa — evento approval_granted: ${JSON.stringify(approvalGrantedEvent)}`);
      check(
        `eventos risk_accepted (uno por finding major, ${majorFindings.length} esperado(s)) + approval_granted`,
        riskAcceptedEvents.length === majorFindings.length && Boolean(approvalGrantedEvent),
        `risk_accepted=${riskAcceptedEvents.length}, approval_granted=${Boolean(approvalGrantedEvent)}`
      );

      // ═══ Paso 11: Release-ready visible ═══
      log("── Paso 11: Release-ready visible (isReleaseReady, dominio puro) ──");
      const latestPageVersionRow = await db
        .select()
        .from(schema.pixelforgePageVersions)
        .where(eq(schema.pixelforgePageVersions.projectId, fixture.projectId))
        .orderBy(desc(schema.pixelforgePageVersions.version))
        .limit(1);
      const releaseReady = isReleaseReady(
        review2AfterApprove[0]
          ? { id: review2AfterApprove[0].id, pageVersionId: review2AfterApprove[0].pageVersionId, status: review2AfterApprove[0].status as any }
          : null,
        latestPageVersionRow[0]?.id ?? null
      );
      log(
        `isReleaseReady({review ronda 2}, latestVersionId=${latestPageVersionRow[0]?.id}) → ${releaseReady} ` +
          `(review.pageVersionId=${review2AfterApprove[0]?.pageVersionId}, review.status=${review2AfterApprove[0]?.status})`
      );
      check("release-ready === true (review ronda 2 aprobada, anclada a la versión vigente v2)", releaseReady === true);

      // ═══ Paso 12: Componer v3 — la aprobación de ronda 2 debe quedar superseded ═══
      log("── Paso 12: Componer v3 — supersede de la aprobación (approved → superseded) ──");
      const v3 = await composeVersion("v3");
      const review2AfterV3 = await db.select().from(schema.pixelforgeReviews).where(eq(schema.pixelforgeReviews.id, review2Id));
      log(`Query directa — pixelforge_reviews ronda 2 tras componer v3: ${JSON.stringify(review2AfterV3[0])}`);
      check("review ronda 2 pasó a status === 'superseded' tras componer v3", review2AfterV3[0]?.status === "superseded", `status=${review2AfterV3[0]?.status}`);
      const eventsAfterV3 = await db.select().from(schema.pixelforgeEvents).where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
      const approvalSupersededEvent = eventsAfterV3.find((e: any) => e.type === "approval_superseded" && e.snapshot?.reviewId === review2Id) as any;
      log(`Query directa — evento approval_superseded: ${JSON.stringify(approvalSupersededEvent)}`);
      check(
        "evento approval_superseded (previousStatus=approved) con newPageVersionId/newVersion → v3",
        approvalSupersededEvent?.snapshot?.previousStatus === "approved" &&
          approvalSupersededEvent?.snapshot?.newPageVersionId === v3.pageVersionId &&
          approvalSupersededEvent?.snapshot?.newVersion === v3.version,
        `snapshot=${JSON.stringify(approvalSupersededEvent?.snapshot)}`
      );

      console.log("\n── IDs para el reporte ──");
      console.log(
        JSON.stringify(
          {
            projectId: fixture.projectId,
            directionChosenId: fixture.directionChosenId,
            v1: { id: v1.pageVersionId, version: v1.version },
            v2: { id: v2.pageVersionId, version: v2.version },
            v3: { id: v3.pageVersionId, version: v3.version },
            qa1RunId: qa1.qaRunId,
            qa1Verdict: qa1.verdict,
            qa2RunId: qa2.qaRunId,
            qa2Verdict: qa2.verdict,
            review1Id,
            review2Id,
            comment1Id,
            releaseReady,
          },
          null,
          2
        )
      );
    } catch (err) {
      if (err instanceof SmokeBlockedError) {
        check("secuencia completa sin bloqueos (política de reintento de verdict fail)", false, err.message);
        console.error(`\n[smoke] BLOCKED: ${err.message}`);
      } else {
        throw err;
      }
    } finally {
      console.log("\n── Resumen de checks ──");
      const failed = results.filter((r) => !r.ok);
      console.log(`${results.length - failed.length}/${results.length} checks OK.`);
      if (failed.length > 0) {
        console.error(`\n${failed.length} check(s) fallaron:`);
        failed.forEach((f) => console.error(`   - ${f.label}${f.detail ? ` (${f.detail})` : ""}`));
      }
      console.log("\n── Timings (ms) ──");
      console.log(JSON.stringify(timings, null, 2));
      await db.$client.end().catch(() => {});
    }
  } finally {
    log("Derribando entorno de smoke (dev server, qa-runner, Postgres, .env.smoke)...");
    if (qaRunner) {
      qaRunner.kill("SIGTERM");
    }
    if (devServer) {
      devServer.kill("SIGTERM");
    }
    await new Promise((r) => setTimeout(r, 2000));
    if (qaRunner && !qaRunner.killed) qaRunner.kill("SIGKILL");
    if (devServer && !devServer.killed) devServer.kill("SIGKILL");
    execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
    if (fs.existsSync(ENV_SMOKE_PATH)) fs.unlinkSync(ENV_SMOKE_PATH);
    log("Entorno derribado.");
  }

  const anyFailed = results.some((r) => !r.ok);
  if (anyFailed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("\nError inesperado en el smoke de PF-F9 T7:", err);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  process.exit(1);
});
