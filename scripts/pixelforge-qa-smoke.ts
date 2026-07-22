/**
 * Smoke e2e completo de PF-F8 (capa QA de PixelForge) — PF-F8 T8.
 *
 * SOLO SMOKE, entorno 100% desechable: NUNCA toca la DB de prod (5437) ni la
 * de dev (5437 también, mismo puerto) — levanta su propio Postgres 16 en el
 * puerto 5499 (`pf-f8-smoke-db`), aplica las migraciones 0000-0025 desde
 * cero, siembra un proyecto hasta blueprint sellado + dirección chosen (vía
 * inserts directos — opción (b) del brief, ver docstring de `seedFixture`),
 * dispara `compose_page_tree` REAL vía la API HTTP contra un Next dev server
 * bare (puerto 9007), arranca el qa-runner LOCAL (no Docker) apuntando a ese
 * dev server, y corre 2 corridas de QA reales: una con tokens contrastantes
 * (honesto: pass o pass_with_warnings, lo que salga) y otra tras mutar la
 * dirección chosen a una paleta monocromática (debe cerrar FAIL vía
 * QA-DI-001 blocking).
 *
 * Al terminar (éxito o error) el `finally` derriba TODO: mata dev server +
 * qa-runner, destruye el contenedor Postgres, borra el `.env.smoke` temporal
 * (vive en el scratchpad, fuera del árbol versionado).
 *
 * Uso: ./node_modules/.bin/tsx scripts/pixelforge-qa-smoke.ts
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
const CONTAINER_NAME = "pf-f8-smoke-db";
const PG_PORT = 5499;
const DB_URL = `postgres://pfsmoke:pfsmoke@127.0.0.1:${PG_PORT}/pixelforge_smoke`;
const DEV_PORT = 9007;
const APP_BASE_URL = `http://localhost:${DEV_PORT}`;
const REAL_ENV_PATH = "/home/ubuntu/pixeltec-os/.env";
const SCRATCHPAD_DIR = "/tmp/claude-1000/-home-ubuntu/2d92a318-a116-4f66-9608-9195d23e2f29/scratchpad";
const ENV_SMOKE_PATH = path.join(SCRATCHPAD_DIR, ".env.smoke-f8");
const DEV_LOG_PATH = path.join(SCRATCHPAD_DIR, "pf-f8-dev-server.log");
const RUNNER_LOG_PATH = path.join(SCRATCHPAD_DIR, "pf-f8-qa-runner.log");
const REPO_ROOT = "/home/ubuntu/pixeltec-os/.claude/worktrees/pixelforge-f1";

const SMOKE_EMAIL = "qa-smoke-f8@example.com";
const SMOKE_PASSWORD = "SmokeF8-" + randomBytes(6).toString("hex");
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
  log("Aplicando migraciones 0000-0025 (drizzle-orm/postgres-js migrator)...");
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
    // Nunca disparar notificaciones reales (WhatsApp/email) desde el smoke —
    // el dominio QA no las usa, pero se limpian por seguridad.
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

// ─── Fase 3: seed de fixture (opción b — inserts directos, artifacts sellados realistas) ──
interface SeededFixture {
  userId: string;
  userName: string;
  clientId: string;
  projectId: string;
  directionChosenId: string;
}

/**
 * Siembra el proyecto hasta blueprint sellado + dirección chosen, SIN correr
 * la cadena IA upstream (analyze_context→...→build_narrative) — opción (b)
 * del brief: inserta los artifacts sellados con contenido realista
 * directamente en Postgres. Documentado: se eligió (b) sobre (a) por
 * costo/tiempo (la cadena completa son 5 llamadas IA reales adicionales que
 * no aportan nada nuevo al smoke de QA — el smoke de F7 ya las cubrió e2e).
 * La dirección `chosen` (slot 2) usa una paleta CONTRASTANTE realista para
 * el caso PASS/WARNINGS; el caso FAIL muta esos mismos designTokens más
 * adelante (ver `mutateChosenDirectionToMonochrome`).
 */
async function seedFixture(schema: typeof SchemaModule, db: any, eq: any): Promise<SeededFixture> {
  log("Sembrando fixture (usuario/cliente/proyecto/artifacts sellados/direcciones)...");
  const passwordHash = await bcrypt.hash(SMOKE_PASSWORD, 10);
  const userId = randomUUID();
  const userName = "QA Smoke F8";
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
    name: "Cliente QA Smoke F8",
  });

  const projectId = randomUUID();
  await db.insert(schema.pixelforgeProjects).values({
    id: projectId,
    ownerId: userId,
    clientId,
    clientCrmId: "crm-qa-smoke-f8",
    title: "Landing QA Smoke F8",
    brainDump:
      "Taller de reparación de bicicletas urbanas en Guadalajara, servicio a domicilio, quiere " +
      "transmitir velocidad y confianza técnica para captar clientes que no quieren perder tiempo.",
    currentStation: "produccion",
    status: "in_progress",
  });

  const now = new Date();
  const sealedBase = { sealedAt: now, sealedById: userId, sealedByName: userName, status: "sealed" as const };

  // ── context_brief ──
  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "context_brief",
    ...sealedBase,
    sealedContent: {
      confirmados: [
        {
          titulo: "Servicio a domicilio",
          detalle: "El taller repara bicicletas directamente en el domicilio del cliente.",
          confianza: "alta",
          evidencias: [{ sourceRef: "braindump", cita: "servicio a domicilio" }],
        },
      ],
      inferidos: [
        {
          titulo: "Audiencia urbana con poco tiempo",
          detalle: "Clientes que valoran no perder tiempo llevando la bici a un taller físico.",
          confianza: "media",
          evidencias: [{ sourceRef: "braindump", cita: "no quieren perder tiempo" }],
        },
      ],
      faltantes: [
        {
          titulo: "Precios de referencia",
          detalle: "No hay tarifario explícito en el brain dump.",
          confianza: "baja",
          evidencias: [],
        },
      ],
      contradicciones: [],
      resumen:
        "Taller de bicicletas urbanas en Guadalajara con servicio a domicilio, orientado a clientes " +
        "que buscan rapidez y confianza técnica sin sacrificar tiempo.",
    },
    currentDraft: null,
  });

  // ── landing_dna ──
  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "landing_dna",
    ...sealedBase,
    sealedContent: {
      propuestaValor: "Reparamos tu bici donde estés, el mismo día.",
      audiencia: {
        descripcion: "Ciclistas urbanos de 25-45 años con poco tiempo libre.",
        dolores: ["Perder medio día llevando la bici al taller", "Talleres poco transparentes con el diagnóstico"],
        objeciones: ["¿De verdad vienen a mi casa?", "¿Es más caro que un taller normal?"],
      },
      tono: { voz: "directo, técnico pero cercano", atributos: ["rápido", "confiable", "técnico"] },
      mensajesClave: [
        {
          mensaje: "Servicio a domicilio el mismo día",
          evidencias: [{ sourceRef: "braindump", cita: "servicio a domicilio" }],
        },
      ],
      llamadosAccion: [{ texto: "Agenda tu reparación", intencion: "agenda" }],
      evidencias: [{ sourceRef: "braindump", cita: "servicio a domicilio" }],
    },
    currentDraft: null,
  });

  // ── visual_dna ──
  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "visual_dna",
    ...sealedBase,
    sealedContent: {
      direccionGeneral: "Técnico y veloz, con acentos de taller mecánico moderno.",
      paleta: { estrategia: "azul técnico sobre blanco, acento naranja para CTAs", contraste: "alto" },
      tipografia: { caracterTitulos: "geométrica y firme", caracterCuerpo: "legible, neutra" },
      espaciado: "equilibrado",
      motivosVisuales: ["engranaje", "línea de velocidad", "rueda de bicicleta"],
      antiPatrones: ["gradientes genéricos de startup", "ilustraciones stock de bicicletas felices"],
      influencias: [],
    },
    currentDraft: null,
  });

  // ── 3 direcciones creativas (slot 2 = chosen, tokens CONTRASTANTES) ──
  // NOTA (re-smoke F8): `valor` del acento subido de #f97316 a #c2410c — el
  // primer re-smoke detectó (QA-DI-002 + axe QA-AX-001, ambos reales, NO
  // relacionados con BUG-1/BUG-2) que #f97316 sobre blanco solo da 2.80:1 de
  // contraste (bajo el 4.5:1 que exige texto pequeño en negrita ~18px) — un
  // defecto del FIXTURE de smoke (paleta elegida por este script), no del
  // producto. #c2410c da 5.18:1 contra blanco (verificado con la fórmula WCAG
  // de luminancia relativa) manteniendo el mismo primario/fondo/texto.
  const CONTRASTING_PALETA = [
    { token: "Fondo General", uso: "fondo general de la pagina, superficie base", valor: "#ffffff" },
    { token: "Color Primario", uso: "marca, botones principales", valor: "#1d4ed8" },
    { token: "Color Acento", uso: "CTA, destacados", valor: "#c2410c" },
    { token: "Texto Principal", uso: "texto de cuerpo, contenido oscuro", valor: "#0f172a" },
    { token: "Gris Sutil", uso: "bordes, elementos muted", valor: "#64748b" },
  ];

  function buildDirection(slot: number, chosen: boolean, paleta: typeof CONTRASTING_PALETA) {
    return {
      id: randomUUID(),
      projectId,
      slot,
      title: chosen ? "Velocidad Técnica" : `Alternativa ${slot}`,
      concept: chosen
        ? "Landing que transmite velocidad de servicio y solidez técnica a la vez."
        : `Concepto alternativo ${slot} descartado en la elección.`,
      designTokens: {
        paleta,
        tipografia: { display: "Space Grotesk", body: "Inter", escala: "modular 1.25, base 16px" },
        radios: "suaves" as const,
        espaciado: "equilibrado" as const,
        sombra: "sutil" as const,
      },
      motionDna: {
        personalidad: "preciso y mecánico",
        ritmo: "moderado" as const,
        intensidadGlobal: 2 as const,
        firmas: ["barrido de engranaje", "conteo ascendente de stats"],
      },
      signatureMotif: {
        nombre: "La Rueda",
        descripcion: "Motivo circular recurrente inspirado en la rueda de bicicleta.",
        aplicaciones: ["separadores de sección", "icono de carga", "bullets de features"],
      },
      signatureComponent: {
        status: "custom-development-required" as const,
        concept: "Calculadora de tiempo estimado de reparación por tipo de falla.",
        businessValue: "Reduce fricción al mostrar expectativa realista antes de agendar.",
        requiredData: ["tipo de falla", "tiempo promedio por falla"],
        estimatedComplexity: "medium" as const,
      },
      scores: {
        originalidadConceptual: 72,
        independenciaDeReferencias: 80,
        especificidadDelMotif: 75,
        utilidadDelSignature: 70,
        riesgoGenericidadIA: 25,
      },
      scoreTotal: chosen ? 78 : 60,
      scoresRazones: { porCriterio: "Puntajes estimados de fixture de smoke — no generados por IA." },
      status: chosen ? ("chosen" as const) : ("discarded" as const),
      risks: chosen ? ["El motif circular puede sentirse repetitivo si se sobreusa"] : [],
    };
  }

  const directionSlot1 = buildDirection(1, false, CONTRASTING_PALETA);
  const directionSlot2 = buildDirection(2, true, CONTRASTING_PALETA);
  const directionSlot3 = buildDirection(3, false, CONTRASTING_PALETA);

  for (const d of [directionSlot1, directionSlot2, directionSlot3]) {
    await db.insert(schema.pixelforgeCreativeDirections).values(d);
  }

  // ── direction_decision (sealed) — chosenDirectionId debe coincidir con la
  // fila `chosen` real (invariante `assertDirectionDecisionStillCurrent`) ──
  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "direction_decision",
    ...sealedBase,
    sealedContent: {
      chosenDirectionId: directionSlot2.id,
      rationale: "Se eligió por transmitir mejor la velocidad de servicio sin perder solidez técnica.",
      acceptedRisks: ["El motif circular puede sentirse repetitivo si se sobreusa"],
      combinedFromDirectionIds: [],
    },
    currentDraft: null,
  });

  // ── narrative_blueprint (sealed) — leído por compose_page_tree (F7) ──
  await db.insert(schema.pixelforgeArtifacts).values({
    id: randomUUID(),
    projectId,
    kind: "narrative_blueprint",
    ...sealedBase,
    sealedContent: {
      historia:
        "El visitante llega frustrado por no tener tiempo para llevar su bici al taller; descubre que " +
        "el taller viene a él, con la misma calidad técnica, el mismo día.",
      actos: [
        {
          orden: 1,
          proposito: "Capturar atención con la promesa central",
          mensaje: "Reparamos tu bici donde estés, el mismo día.",
          tension: "No tengo tiempo de llevar la bici a ningún lado",
          resolucion: "El taller viene a ti",
        },
        {
          orden: 2,
          proposito: "Construir confianza técnica",
          mensaje: "Mecánicos certificados con diagnóstico transparente",
          tension: "¿Puedo confiar en un mecánico a domicilio?",
          resolucion: "Diagnóstico transparente antes de cobrar",
        },
        {
          orden: 3,
          proposito: "Mostrar el proceso simple",
          mensaje: "Agenda, diagnóstico, reparación — todo en una visita",
          tension: "Parece complicado agendar un servicio a domicilio",
          resolucion: "Proceso de 3 pasos, agenda en menos de 2 minutos",
        },
        {
          orden: 4,
          proposito: "Cerrar con llamado a la acción",
          mensaje: "Agenda tu reparación hoy",
          tension: "Podría posponerlo indefinidamente",
          resolucion: "Agenda ahora, mismo día si es antes del mediodía",
        },
      ],
      cinematicMoments: [
        {
          actoOrden: 2,
          descripcion: "La rueda gira lentamente mientras se revela el diagnóstico técnico paso a paso.",
          motifConnection: "La Rueda — el motif circular acompaña el momento de mayor confianza técnica.",
        },
      ],
      notasProduccion: [
        "Usar iconografía de engranaje/rueda en separadores de sección.",
        "El CTA final debe repetir la promesa 'el mismo día'.",
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

    // Import dinámico — process.env.DATABASE_URL debe apuntar al desechable
    // ANTES de importar @/lib/db (singleton que lee la env al importarse).
    process.env.DATABASE_URL = DB_URL;
    const schema = (await import("@/lib/db/schema")) as typeof SchemaModule;
    const { db } = await import("@/lib/db");
    const { eq } = await import("drizzle-orm");

    const tSeed = Date.now();
    const fixture = await seedFixture(schema, db, eq);
    timings.seed = Date.now() - tSeed;
    log(`Fixture sembrado: proyecto ${fixture.projectId}, dirección chosen ${fixture.directionChosenId}`);

    const smokeEnv = buildSmokeEnv();
    writeEnvSmokeFile(smokeEnv);

    log(`Arrancando dev server (puerto ${DEV_PORT})...`);
    // A partir de acá, cualquier excepción todavía debe imprimir el resumen
    // de checks acumulado hasta el momento (no solo en el éxito completo) —
    // el `finally` interno lo garantiza; el `finally` externo (fuera de
    // `main`'s try principal) sigue haciendo el derribo del entorno.
    devServer = spawnLogged(
      path.join(REPO_ROOT, "node_modules/.bin/next"),
      ["dev", "-p", String(DEV_PORT)],
      smokeEnv,
      DEV_LOG_PATH,
      "dev-server"
    );
    await waitForHttp(`${APP_BASE_URL}/api/auth/csrf`, 90_000, "dev server");
    check("dev server bare (9007) arrancó y respondió", true);

    log("Login HTTP vía NextAuth credentials...");
    const jar = await loginViaHttp(SMOKE_EMAIL, SMOKE_PASSWORD);
    check("login HTTP real (NextAuth credentials) obtuvo cookie de sesión", true);

    // Pre-calienta la compilación on-demand de la ruta /preview (Next dev sin
    // turbopack puede tardar >30s en compilar una página compleja la PRIMERA
    // vez que se pide) — evita que el primer hit real de Playwright (con
    // timeout duro de 30s en run-job.ts, código de producto, no tocar) muera
    // por un cold-compile en vez de un problema real. Se ignora el resultado
    // (auth/token todavía no aplican, solo importa que Next compile el módulo).
    log("Pre-calentando compilación de la ruta /preview...");
    const tWarm = Date.now();
    try {
      await fetch(`${APP_BASE_URL}/proyectos/pixelforge/${"00000000-0000-0000-0000-000000000000"}/preview`, {
        headers: { Cookie: cookieHeader(jar) },
      });
    } catch {
      // best-effort — si falla, el pre-warm no cuenta, pero no bloquea el smoke.
    }
    timings.previewPrewarm = Date.now() - tWarm;
    check("pre-warm de /preview disparado (compilación on-demand adelantada)", true, `${timings.previewPrewarm}ms`);

    // A partir de acá cualquier excepción todavía debe imprimir el resumen de
    // checks acumulado (el `finally` de abajo lo garantiza) — así un throw a
    // mitad de camino (p.ej. compose_page_tree no llega a succeeded) no deja
    // el reporte vacío.
    try {
    // ── compose_page_tree REAL ──
    log("Disparando compose_page_tree REAL (v1)...");
    const tCompose = Date.now();
    const composeStart = await apiPost(jar, "/api/pixelforge/runs", {
      projectId: fixture.projectId,
      operation: "compose_page_tree",
    });
    check(
      "POST /api/pixelforge/runs compose_page_tree arrancó (200, status running)",
      composeStart.status === 200 && composeStart.json?.status === "running",
      JSON.stringify(composeStart.json)
    );
    const runId = composeStart.json.runId as string;

    const composeFinal = await pollUntil(
      () => apiGet(jar, `/api/pixelforge/runs/${runId}`),
      (r) => r.json?.status === "succeeded" || r.json?.status === "failed",
      6 * 60_000,
      3000,
      "compose_page_tree"
    );
    timings.composePageTree = Date.now() - tCompose;
    check(
      "compose_page_tree terminó succeeded",
      composeFinal.json?.status === "succeeded",
      `status=${composeFinal.json?.status}, failureKind=${composeFinal.json?.failureKind ?? "-"}, tokensIn/Out=${composeFinal.json?.tokensIn}/${composeFinal.json?.tokensOut}`
    );

    if (composeFinal.json?.status !== "succeeded") {
      throw new Error("compose_page_tree no llegó a succeeded — no se puede continuar con QA. Ver detalle arriba.");
    }

    // Verifica page_version v1 en DB
    const pageVersions = await db
      .select()
      .from(schema.pixelforgePageVersions)
      .where(eq(schema.pixelforgePageVersions.projectId, fixture.projectId));
    check(
      "creación correcta de page_versions: fila v1 con tree válido",
      pageVersions.length === 1 && pageVersions[0]!.version === 1 && pageVersions[0]!.tree !== null,
      `filas=${pageVersions.length}, version=${pageVersions[0]?.version}`
    );
    const pageComposedEvents = await db
      .select()
      .from(schema.pixelforgeEvents)
      .where(eq(schema.pixelforgeEvents.projectId, fixture.projectId));
    const hasPageComposedEvent = pageComposedEvents.some((e: any) => e.type === "page_composed");
    check("evento page_composed insertado", hasPageComposedEvent);

    // ── CSP directo sobre la ruta /preview (checkpoint QA-TE-008 / frame-ancestors) ──
    // Verificación independiente del qa-runner: firma un token pfqa válido a
    // mano (mismo HMAC que usa el runner) y golpea la ruta real para
    // inspeccionar el header crudo — así el checkpoint no depende SOLO de que
    // el check QA-TE-008 (nav) haya corrido o no.
    log("Verificando header CSP directo sobre /preview (token pfqa firmado a mano)...");
    const { signQaPreviewToken } = (await import("@/lib/pixelforge/qa/preview-token")) as typeof import("@/lib/pixelforge/qa/preview-token");
    const cspProbeToken = signQaPreviewToken(
      {
        qaRunId: "00000000-0000-0000-0000-000000000000",
        projectId: fixture.projectId,
        pageVersionId: pageVersions[0]!.id,
        ownerId: fixture.userId,
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      QA_PREVIEW_TOKEN_SECRET
    );
    const cspProbeRes = await fetch(
      `${APP_BASE_URL}/proyectos/pixelforge/${fixture.projectId}/preview?pfqa=${cspProbeToken}`
    );
    const cspHeaderValue = cspProbeRes.headers.get("content-security-policy") ?? "";
    const cspHasFrameAncestorsSelf = /frame-ancestors[^;]*'self'/i.test(cspHeaderValue);
    check(
      "CSP de /preview trae frame-ancestors 'self' (probado directo, sin qa-runner)",
      cspHasFrameAncestorsSelf,
      `status=${cspProbeRes.status}, csp="${cspHeaderValue}"`
    );

    // ── qa-runner local ──
    log("Arrancando qa-runner LOCAL...");
    qaRunner = spawnLogged(
      path.join(REPO_ROOT, "node_modules/.bin/tsx"),
      ["scripts/qa-runner/index.ts"],
      { ...smokeEnv, QA_INTERNAL_APP_URL: APP_BASE_URL },
      RUNNER_LOG_PATH,
      "qa-runner"
    );
    await new Promise((r) => setTimeout(r, 3000)); // deja arrancar el loop antes del primer QA

    // ── BUG-2 (re-smoke): probeo directo del preview MIENTRAS el qa_run sigue
    // `running` — firma un token pfqa válido con el qaRunId REAL recién
    // arrancado (no un id dummy: `verifyQaPreviewToken` exige qa_run vivo con
    // status running Y misma pageVersionId) y golpea la ruta antes de que el
    // qa-runner o el poll la deje terminar. Prueba en un solo fetch que (a) el
    // middleware YA NO redirige a /login (antes: 307 a /login), (b) la CSP
    // trae frame-ancestors 'self', y (c) el BODY es la landing real (título
    // "Vista previa — PixelForge", sin form de login) — no basta con el
    // header CSP solo, porque un /login que por accidente compartiera esa CSP
    // igual pasaría el checkpoint QA-TE-008 sin medir la página correcta.
    async function probeRealPreviewMidRun(qaRunId: string, pageVersionId: string): Promise<void> {
      const midRunToken = signQaPreviewToken(
        { qaRunId, projectId: fixture.projectId, pageVersionId, ownerId: fixture.userId, exp: Math.floor(Date.now() / 1000) + 600 },
        QA_PREVIEW_TOKEN_SECRET
      );
      const res = await fetch(`${APP_BASE_URL}/proyectos/pixelforge/${fixture.projectId}/preview?pfqa=${midRunToken}`, {
        redirect: "manual",
      });
      const body = res.status < 400 ? await res.text().catch(() => "") : "";
      const csp = res.headers.get("content-security-policy") ?? "";
      check(
        "BUG-2: preview con pfqa (qa_run REAL en curso) NO redirige a /login (status < 300, sin Location)",
        res.status < 300 && !res.headers.get("location"),
        `status=${res.status}, location=${res.headers.get("location") ?? "-"}`
      );
      check(
        "BUG-2: CSP de esa misma respuesta trae frame-ancestors 'self'",
        /frame-ancestors[^;]*'self'/i.test(csp),
        `csp="${csp}"`
      );
      check(
        "BUG-2: el BODY es la landing real (título 'Vista previa — PixelForge'), NO el formulario de /login",
        body.includes("Vista previa") && !body.includes('type="password"'),
        `bodyLen=${body.length}, contieneVistaPrevia=${body.includes("Vista previa")}, contienePasswordField=${body.includes('type="password"')}`
      );
    }

    // ── Caso 1: tokens contrastantes — PASS o PASS_WITH_WARNINGS honesto ──
    // Con reintento: un `run.status==='failed'` cuyo `browserStatus` sea
    // `failed`/`timed_out` (infraestructura — p.ej. cold-compile de Next dev,
    // NUNCA visto en prod donde la build ya está compilada) NO es un veredicto
    // real — se reintenta una vez sobre la MISMA versión antes de reportarlo
    // como el resultado honesto del caso.
    async function runQaAndPoll(
      label: string,
      midRunProbe?: (qaRunId: string) => Promise<void>
    ): Promise<{ qaRunId: string; final: { status: number; json: any } }> {
      const start = await apiPost(jar, "/api/pixelforge/qa/runs", { projectId: fixture.projectId });
      check(
        `POST /api/pixelforge/qa/runs ${label} arrancó (200, running)`,
        start.status === 200 && start.json?.status === "running",
        JSON.stringify(start.json)
      );
      const qaRunId = start.json.qaRunId as string;
      if (midRunProbe) {
        await midRunProbe(qaRunId).catch((err) => check(`mid-run probe (BUG-2) de ${label} no lanzó`, false, String(err)));
      }
      const final = await pollUntil(
        () => apiGet(jar, `/api/pixelforge/qa/runs/${qaRunId}`),
        (r) => r.json?.run?.status === "succeeded" || r.json?.run?.status === "failed",
        6 * 60_000,
        3000,
        `QA run ${label}`
      );
      return { qaRunId, final };
    }

    log("Corriendo QA #1 (tokens contrastantes)...");
    const tQa1 = Date.now();
    let { qaRunId: qaRun1Id, final: qa1Final } = await runQaAndPoll("#1", (qaRunId) =>
      probeRealPreviewMidRun(qaRunId, pageVersions[0]!.id)
    );
    const isInfraFailure = (r: { json: any }) =>
      r.json?.run?.status === "failed" &&
      r.json?.run?.verdict === null &&
      (r.json?.run?.browserStatus === "failed" || r.json?.run?.browserStatus === "timed_out");
    if (isInfraFailure(qa1Final)) {
      log(
        `QA #1 (${qaRun1Id}) falló por infraestructura del entorno de smoke (browserStatus=${qa1Final.json?.run?.browserStatus}, no un veredicto) — reintentando UNA vez...`
      );
      const retry = await runQaAndPoll("#1 (reintento)");
      qaRun1Id = retry.qaRunId;
      qa1Final = retry.final;
    }
    timings.qaRun1 = Date.now() - tQa1;
    const verdict1 = qa1Final.json?.run?.verdict;
    check(
      "QA #1 terminó (status succeeded, verdict real reportado sin forzar)",
      qa1Final.json?.run?.status === "succeeded",
      `status=${qa1Final.json?.run?.status}, verdict=${verdict1}, score=${qa1Final.json?.run?.scoreTotal}, browserStatus=${qa1Final.json?.run?.browserStatus}`
    );

    if (verdict1 === "pass_with_warnings") {
      log("Verdict pass_with_warnings — ejerciendo aprobación humana...");
      const decisionRes = await apiPost(jar, `/api/pixelforge/qa/runs/${qaRun1Id}/decision`, {
        decision: "approved",
        reason: "Aprobado en smoke controlado PF-F8 T8 — hallazgos revisados y aceptados.",
      });
      check("POST decision approved (reason >=5) devolvió ok", decisionRes.status === 200 && decisionRes.json?.ok === true);
    }

    const projectAfterQa1 = await db
      .select()
      .from(schema.pixelforgeProjects)
      .where(eq(schema.pixelforgeProjects.id, fixture.projectId));
    const stationAfterQa1 = projectAfterQa1[0]?.currentStation;
    if (verdict1 === "pass" || verdict1 === "pass_with_warnings") {
      check(
        "gate abrió: current_station avanzó a 'revision'",
        stationAfterQa1 === "revision",
        `currentStation=${stationAfterQa1}`
      );
    } else {
      check(
        "caso 1 no dio pass/pass_with_warnings (reportado honestamente, no forzado)",
        false,
        `verdict real=${verdict1}`
      );
    }

    // ── Caso 2: mutar dirección chosen a monocromática — FAIL vía QA-DI-001 ──
    log("Mutando designTokens de la dirección chosen a paleta monocromática...");
    const MONOCHROME_PALETA = [
      { token: "Fondo Principal", uso: "fondo general de la pagina", valor: "#0f172a" },
      { token: "Color Marca", uso: "marca", valor: "#0f172a" },
      { token: "Acento", uso: "cta", valor: "#0f172a" },
    ];
    await db
      .update(schema.pixelforgeCreativeDirections)
      .set({
        designTokens: {
          paleta: MONOCHROME_PALETA,
          tipografia: { display: "Space Grotesk", body: "Inter", escala: "modular 1.25, base 16px" },
          radios: "suaves",
          espaciado: "equilibrado",
          sombra: "sutil",
        },
      })
      .where(eq(schema.pixelforgeCreativeDirections.id, fixture.directionChosenId));

    log("Corriendo QA #2 (colisión B1 forzada)...");
    const tQa2 = Date.now();
    let { qaRunId: qaRun2Id, final: qa2Final } = await runQaAndPoll("#2");
    if (isInfraFailure(qa2Final)) {
      log(
        `QA #2 (${qaRun2Id}) falló por infraestructura del entorno de smoke (browserStatus=${qa2Final.json?.run?.browserStatus}) — reintentando UNA vez...`
      );
      const retry2 = await runQaAndPoll("#2 (reintento)");
      qaRun2Id = retry2.qaRunId;
      qa2Final = retry2.final;
    }
    timings.qaRun2 = Date.now() - tQa2;
    const verdict2 = qa2Final.json?.run?.verdict;
    check(
      "QA #2 cerró FAIL (forzado por colisión B1 QA-DI-001 blocking)",
      qa2Final.json?.run?.status === "succeeded" && verdict2 === "fail",
      `status=${qa2Final.json?.run?.status}, verdict=${verdict2}, score=${qa2Final.json?.run?.scoreTotal}`
    );
    const findings2: any[] = qa2Final.json?.findings ?? [];
    const hasDi001 = findings2.some((f) => f.checkCode === "QA-DI-001" && f.severity === "critical" && f.blocking === true);
    check("QA-DI-001 presente en findings de QA #2 (critical, blocking)", hasDi001);

    const projectAfterQa2 = await db
      .select()
      .from(schema.pixelforgeProjects)
      .where(eq(schema.pixelforgeProjects.id, fixture.projectId));
    check(
      "gate NO se abrió más allá de lo que ya estaba (FAIL no avanza estación)",
      projectAfterQa2[0]?.currentStation === stationAfterQa1,
      `currentStation antes=${stationAfterQa1}, después=${projectAfterQa2[0]?.currentStation}`
    );

    // ── Persistencia / estructura de QA runs y findings ──
    const allQaRunsRows = await db
      .select()
      .from(schema.pixelforgeQaRuns)
      .where(eq(schema.pixelforgeQaRuns.projectId, fixture.projectId));
    // `qaRunsRows` = SOLO los 2 runs finales reportados (qaRun1Id/qaRun2Id) —
    // puede haber filas EXTRA en la tabla si algún intento fue reintentado por
    // infraestructura (ver `runQaAndPoll`), documentado aparte, no contado
    // como corrida "real" del smoke.
    const qaRunsRows = allQaRunsRows.filter((r: any) => r.id === qaRun1Id || r.id === qaRun2Id);
    check(
      "2 filas finales en pixelforge_qa_runs (una por corrida reportada)",
      qaRunsRows.length === 2,
      `filas totales en la tabla=${allQaRunsRows.length} (incl. reintentos si los hubo), finales reportadas=${qaRunsRows.length}`
    );
    if (allQaRunsRows.length !== 2) {
      log(
        `Nota: ${allQaRunsRows.length} filas totales en pixelforge_qa_runs para este proyecto — ` +
          `${allQaRunsRows.length - 2} intento(s) descartado(s) por infraestructura (browser cold-compile), ver diagnóstico abajo.`
      );
    }

    for (const run of qaRunsRows) {
      const fksSet = run.critiqueRunId && run.originalityRunId && run.likenessRunId;
      check(
        `qa_run ${run.id.slice(0, 8)}: FKs critique/originality/likeness seteados`,
        Boolean(fksSet),
        `critique=${run.critiqueRunId}, originality=${run.originalityRunId}, likeness=${run.likenessRunId}`
      );
    }

    console.log("\n── qa_runs finales (verdict/score/categoryScores/summary) ──");
    for (const run of qaRunsRows) {
      console.log(
        `  [${run.id.slice(0, 8)}] verdict=${run.verdict} scoreTotal=${run.scoreTotal} ` +
          `categoryScores=${JSON.stringify(run.categoryScores)} summary=${JSON.stringify(run.summary)}`
      );
    }

    // ── Responsive: los 3 viewports corrieron de verdad (evidencia dura, no
    // solo grep de log) — `engine.screenshots` lo arma `finishQaBrowserJob`
    // con un full-page por viewport (`screenshots.ts`), fuente de verdad
    // independiente de si algún finding disparó en ese viewport o no.
    for (const run of qaRunsRows) {
      const engine = run.engine as { screenshots?: { viewport: string; assetId: string; url: string }[] } | null;
      const viewportsSeen = new Set((engine?.screenshots ?? []).map((s) => s.viewport));
      check(
        `qa_run ${run.id.slice(0, 8)}: los 3 viewports (desktop/tablet/mobile) corrieron (engine.screenshots)`,
        ["desktop", "tablet", "mobile"].every((v) => viewportsSeen.has(v)),
        `viewports=${[...viewportsSeen].join(",")}, screenshots=${engine?.screenshots?.length ?? 0}`
      );
    }

    const allAiRuns = await db
      .select()
      .from(schema.pixelforgeAiRuns)
      .where(eq(schema.pixelforgeAiRuns.projectId, fixture.projectId));
    const finalResultRefs = new Set([`qa_run:${qaRun1Id}`, `qa_run:${qaRun2Id}`]);
    // SOLO los advisory ai_runs de los 2 qa_runs FINALES reportados — un
    // reintento de infraestructura descartado también dispara sus propios 3
    // advisory (fire-and-forget), así que la tabla puede tener más de 6 en
    // total; lo que el checkpoint exige (3 por qa_run REAL) se mide sobre los
    // finales, el resto se reporta aparte como descartado.
    const advisoryRunsAll = allAiRuns.filter((r: any) =>
      ["critique_design", "score_originality", "detect_ai_likeness"].includes(r.operation)
    );
    const advisoryRuns = advisoryRunsAll.filter((r: any) => finalResultRefs.has(r.resultRef));
    check(
      "6 ai_runs advisory (3 por qa_run x 2 corridas FINALES), todos con resultRef qa_run:<id>",
      advisoryRuns.length === 6 && advisoryRuns.every((r: any) => typeof r.resultRef === "string" && r.resultRef.startsWith("qa_run:")),
      `advisoryRuns finales=${advisoryRuns.length}, total en la tabla (incl. reintentos descartados)=${advisoryRunsAll.length}`
    );
    const advisoryTerminal = advisoryRuns.every((r: any) => r.status === "succeeded" || r.status === "failed");
    check("los 3 ai_runs advisory llegaron a estado terminal (succeeded/failed) en cada corrida", advisoryTerminal);
    // Diagnóstico completo (operation/status/failureKind/error/tokens) — SIEMPRE
    // se imprime (no solo si algo falla) para que el reporte tenga evidencia
    // dura de las 6 llamadas IA advisory reales, no solo un booleano agregado.
    console.log("\n── ai_runs advisory (diagnóstico completo, incl. reintentos descartados si los hubo) ──");
    for (const r of advisoryRunsAll) {
      console.log(
        `  ${r.operation} [${r.id.slice(0, 8)}] status=${r.status} failureKind=${r.failureKind ?? "-"} ` +
          `tokensIn/Out=${r.tokensIn ?? "-"}/${r.tokensOut ?? "-"} durationMs=${r.durationMs ?? "-"} ` +
          `error=${r.error ? JSON.stringify(r.error).slice(0, 200) : "-"}`
      );
    }

    // ── BUG-1 (re-smoke): las 6 corridas advisory FINALES deben cerrar
    // `succeeded` de verdad (no autobloqueadas por el guard) e invocar
    // Anthropic real (tokens_in/out > 0). Antes del fix, las 6 cerraban
    // `failed` con "ya se lanzó para este QA" — se verifica explícitamente la
    // AUSENCIA de ese mensaje como guarda de regresión.
    check(
      "BUG-1: las 6 corridas advisory FINALES cerraron succeeded (no autobloqueo del guard)",
      advisoryRuns.length === 6 && advisoryRuns.every((r: any) => r.status === "succeeded"),
      advisoryRuns.map((r: any) => `${r.operation}=${r.status}`).join(", ")
    );
    const anyStillAutoblocked = advisoryRunsAll.some(
      (r: any) => typeof r.error === "string" ? r.error.includes("ya se lanzó") : JSON.stringify(r.error ?? "").includes("ya se lanzó")
    );
    check(
      "BUG-1: ninguna corrida advisory (ni descartada) trae el mensaje de autobloqueo 'ya se lanzó'",
      !anyStillAutoblocked
    );
    check(
      "BUG-1: las 6 corridas advisory FINALES invocaron Anthropic real (tokensIn>0 y tokensOut>0)",
      advisoryRuns.every((r: any) => (r.tokensIn ?? 0) > 0 && (r.tokensOut ?? 0) > 0),
      advisoryRuns.map((r: any) => `${r.operation}:in=${r.tokensIn}/out=${r.tokensOut}`).join(", ")
    );

    // ── Findings: catálogo de códigos que aparecieron + ejemplos ──
    const findings1 = await db.select().from(schema.pixelforgeQaFindings).where(eq(schema.pixelforgeQaFindings.qaRunId, qaRun1Id));
    const findings2Rows = await db.select().from(schema.pixelforgeQaFindings).where(eq(schema.pixelforgeQaFindings.qaRunId, qaRun2Id));
    const allCodes = new Set([...findings1, ...findings2Rows].map((f: any) => f.checkCode));
    log(`Códigos QA-* que aparecieron: ${[...allCodes].sort().join(", ")}`);

    // ── Diagnóstico completo por checkCode+severity (para post-mortem si el
    // verdict de una corrida sorprende, p.ej. FAIL por categoría < 50 en vez
    // de por blocking) — cuenta ocurrencias, no solo el catálogo de códigos.
    function breakdownByCode(rows: any[]): string {
      const counts = new Map<string, number>();
      for (const f of rows) {
        const key = `${f.checkCode}(${f.severity}/${f.category})`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.entries()].sort().map(([k, n]) => `${k}=${n}`).join(", ");
    }
    console.log(`  [#1] desglose: ${breakdownByCode(findings1)}`);
    console.log(`  [#2] desglose: ${breakdownByCode(findings2Rows)}`);

    const navFinding = [...findings1, ...findings2Rows].find((f: any) => f.checkCode.startsWith("QA-") && f.source === "nav");
    const iaFinding = [...findings1, ...findings2Rows].find((f: any) => f.source === "ia");
    const detFinding = [...findings1, ...findings2Rows].find((f: any) => f.source === "det");
    check("al menos 1 finding fuente 'nav' con estructura completa", Boolean(navFinding));
    check("al menos 1 finding fuente 'ia' con estructura completa (rúbrica en evidence)", Boolean(iaFinding));

    // ── BUG-1: QA-IA-001/002/003 con rúbrica real en evidence ──
    // QA-IA-001 (critique_design) y QA-IA-002 (score_originality) SIEMPRE se
    // persisten (uno por corrida, severidad minor/info según score) —
    // QA-IA-003 (detect_ai_likeness) SOLO si el modelo detectó al menos una
    // señal (`senalesDetectadas.length > 0`, ver `advisory-operations.ts`), así
    // que su ausencia es legítima y NO se reporta como falla, solo se documenta.
    for (const run of [
      { label: "#1", rows: findings1 },
      { label: "#2", rows: findings2Rows },
    ]) {
      const ia001 = run.rows.find((f: any) => f.checkCode === "QA-IA-001") as { evidence?: any } | undefined;
      const ia002 = run.rows.find((f: any) => f.checkCode === "QA-IA-002") as { evidence?: any } | undefined;
      const ia003 = run.rows.filter((f: any) => f.checkCode === "QA-IA-003");
      check(
        `BUG-1: QA-IA-001 (critique_design) presente en corrida ${run.label} con rúbrica real en evidence (score/veredicto/criteria)`,
        Boolean(ia001 && typeof ia001.evidence?.score === "number" && typeof ia001.evidence?.veredicto === "string" && Array.isArray(ia001.evidence?.criteria)),
        ia001 ? `score=${ia001.evidence?.score}, veredicto="${ia001.evidence?.veredicto}", criteria=${ia001.evidence?.criteria?.length}` : "ausente"
      );
      check(
        `BUG-1: QA-IA-002 (score_originality) presente en corrida ${run.label} con rúbrica real en evidence`,
        Boolean(ia002 && typeof ia002.evidence?.score === "number" && typeof ia002.evidence?.veredicto === "string" && Array.isArray(ia002.evidence?.criteria)),
        ia002 ? `score=${ia002.evidence?.score}, veredicto="${ia002.evidence?.veredicto}", criteria=${ia002.evidence?.criteria?.length}` : "ausente"
      );
      log(
        `QA-IA-003 (detect_ai_likeness) en corrida ${run.label}: ${ia003.length} señal(es) detectada(s) por el modelo — ` +
          `${ia003.length > 0 ? "presente" : "ausente (legítimo: el modelo no reportó señales de IA en esta landing)"}`
      );
      check(
        `BUG-1: ninguno de QA-IA-001/002 en corrida ${run.label} es 'critical'/'major' ni 'blocking' (regla de oro advisory)`,
        [ia001, ia002].every((f: any) => !f || (f.severity !== "critical" && f.severity !== "major" && f.blocking === false))
      );
    }

    // ── BUG-2: QA-TE-008 (frame-ancestors ausente) NO debe disparar en ninguna corrida ──
    const te008Findings = [...findings1, ...findings2Rows].filter((f: any) => f.checkCode === "QA-TE-008");
    check(
      "BUG-2: QA-TE-008 (CSP sin frame-ancestors 'self') AUSENTE de los findings — antes disparaba porque el navegador medía /login",
      te008Findings.length === 0,
      te008Findings.length > 0 ? JSON.stringify(te008Findings.map((f: any) => f.description)) : "ausente, como se espera"
    );

    console.log("\n── Ejemplos reales de findings (evidencia checkpoint) ──");
    for (const [tag, f] of [
      ["det", detFinding],
      ["nav", navFinding],
      ["ia", iaFinding],
    ] as const) {
      console.log(`  [${tag}] ${f ? JSON.stringify(f, null, 2) : "(ninguno de esta clase en esta corrida)"}`);
    }

    // ── Diff entre las 2 corridas (mismo criterio que QaStationPanel: checkCode+locationKey) ──
    const keyOf = (f: any) => `${f.checkCode}|${f.locationKey}`;
    const keys1 = new Set(findings1.map(keyOf));
    const keys2 = new Set(findings2Rows.map(keyOf));
    const nuevos = findings2Rows.filter((f: any) => !keys1.has(keyOf(f)));
    const resueltos = findings1.filter((f: any) => !keys2.has(keyOf(f)));
    const persistentes = findings2Rows.filter((f: any) => keys1.has(keyOf(f)));
    check(
      "comparación entre corridas por check_code+location_key calculada (nuevos/resueltos/persistentes)",
      true,
      `nuevos=${nuevos.length}, resueltos=${resueltos.length}, persistentes=${persistentes.length}`
    );
    check("QA-DI-001 aparece como NUEVO en la corrida #2 vs #1 (la colisión no existía antes)", nuevos.some((f: any) => f.checkCode === "QA-DI-001"));

    // ── CSP / navegación / responsive / reduced-motion — vía el log del qa-runner (evidencia indirecta) ──
    const runnerLog = fs.existsSync(RUNNER_LOG_PATH) ? fs.readFileSync(RUNNER_LOG_PATH, "utf8") : "";
    check("qa-runner reclamó y procesó job(s) (log muestra 'arrancando fase navegador')", runnerLog.includes("arrancando fase navegador"));
    check("qa-runner reportó al menos un job succeeded", runnerLog.includes("succeeded"));

    console.log("\n── IDs para el reporte ──");
    console.log(
      JSON.stringify(
        {
          projectId: fixture.projectId,
          directionChosenId: fixture.directionChosenId,
          runId,
          qaRun1Id,
          qaRun2Id,
          verdict1,
          verdict2,
          stationAfterQa1,
        },
        null,
        2
      )
    );
    } finally {
      // Imprime SIEMPRE lo acumulado hasta el momento — incluso si una fase
      // intermedia lanzó (p.ej. compose_page_tree no llegó a succeeded) — así
      // el reporte final no queda vacío por un throw a mitad de camino.
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
}

main().catch((err) => {
  console.error("\nError inesperado en el smoke de PF-F8:", err);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  process.exit(1);
});
