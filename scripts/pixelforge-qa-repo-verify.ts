/**
 * Verificación del repo de QA de PixelForge — PF-F8 T1 (Gate 2, condición 2).
 *
 * Qué hace: levanta un Postgres 16 DESECHABLE vía Docker en un puerto libre
 * (nunca toca la DB de dev 5437 ni de prod), aplica TODAS las migraciones del
 * repo (`./drizzle`, 0000–0025) con el migrador programático de
 * `drizzle-orm/postgres-js`, siembra un par de proyectos mínimos, y ejercita
 * el repo (`src/lib/db/repos/pixelforge.ts`) contra la DB real para verificar
 * 6 propiedades que NO se pueden probar con vitest puro (no hay infra de
 * tests contra DB real en este repo — ver `pixelforge.test.ts`):
 *
 *   1. Unique parcial "un solo QA activo por proyecto": el 2do `createQaRun`
 *      sobre un proyecto con un QA `queued`/`running` lanza
 *      `QaRunAlreadyActiveError` (no el 23505 crudo de Postgres).
 *   2. `claimQaBrowserJob` bajo concurrencia real: con 2 jobs disponibles y
 *      3 llamadas concurrentes, exactamente 2 ganan (una por job, sin
 *      doble-claim) y la 3ra recibe `null`.
 *   3. `finalizeQaRun` es idempotente bajo concurrencia real: 2 llamadas
 *      concurrentes sobre el MISMO run, solo 1 gana (devuelve `true`) y
 *      queda exactamente 1 evento `qa_finished` en `pixelforge_events`.
 *   4. `insertQaFindings` deduplica: el mismo hallazgo exacto
 *      (mismo `qaRunId`+`checkCode`+`locationKey`) insertado 2 veces deja
 *      UNA sola fila (`onConflictDoNothing` sobre el unique del catálogo).
 *   5. `attachQaAdvisoryRuns` bajo concurrencia real (review PF-F8 T5): 2
 *      invocaciones concurrentes sobre el MISMO `qa_run` (`running`, sin FKs
 *      advisory) — vía `SELECT ... FOR UPDATE` + UPDATE final condicionado a
 *      rowcount, exactamente UNA gana (devuelve los 3 ids) y la otra es un
 *      no-op (`null`); quedan EXACTAMENTE 3 `pixelforge_ai_runs` en total
 *      (nunca 6) y las 3 FKs del `qa_run` apuntan a los ids que devolvió la
 *      ganadora — cero huérfanos ejecutando contra Anthropic.
 *   6. `openQaGate` cierra la ventana TOCTOU real (review final PF-F8,
 *      finding 1): un `qa_run` con verdict `pass` sobre v1, con una v2 que
 *      aterriza (simulando `compose_page_tree`, F7) ANTES de invocar
 *      `openQaGate` — el gate NO avanza `current_station`, NO inserta el
 *      evento `qa_gate_opened`, y devuelve `{opened:false,
 *      reason:'stale-version'}`; antes de este fix, el `IN
 *      ('produccion','qa')` de `openQaGate` no veía esta carrera y avanzaba
 *      igual a `revision` sobre una versión que nunca pasó QA.
 *
 * IMPORTANTE — trampa de imports: el cliente de `@/lib/db` es un singleton
 * que lee `process.env.DATABASE_URL` en el momento en que el MÓDULO se
 * importa (no en cada query). Como este script necesita apuntar esa
 * conexión al Postgres desechable (no al `.env` real), `@/lib/db`,
 * `@/lib/db/schema` y `@/lib/db/repos/pixelforge` se importan con `import()`
 * DINÁMICO recién después de fijar `process.env.DATABASE_URL` — un import
 * estático de esos 3 módulos en la cabecera del archivo se evaluaría ANTES
 * (hoisting) y conectaría contra el `.env` real. Los `import type` de más
 * abajo sí son estáticos porque se borran en compilación (no ejecutan nada).
 *
 * Uso (requiere Docker; no requiere ninguna variable de entorno propia —
 * el script arma su propia DATABASE_URL efímera):
 *
 *   npx tsx scripts/pixelforge-qa-repo-verify.ts
 *
 * Se destruye el contenedor al terminar (éxito o error) — `finally` con
 * `docker rm -f`. Se re-ejecuta en T8 (cierre de fase) contra el estado
 * final del repo.
 */
import { execSync } from "node:child_process";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type * as SchemaModule from "@/lib/db/schema";
import type * as PixelforgeRepoModule from "@/lib/db/repos/pixelforge";

const CONTAINER_NAME = "pf-qa-repo-verify";
const PORT = 5499;
const DB_URL = `postgres://verify:verify@127.0.0.1:${PORT}/verify`;

interface CheckResult {
  label: string;
  ok: boolean;
  detail?: string;
}

const results: CheckResult[] = [];

function check(label: string, ok: boolean, detail?: string): void {
  results.push({ label, ok, detail });
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
}

function startDisposablePostgres(): void {
  console.log(`Levantando Postgres desechable (${CONTAINER_NAME}, puerto ${PORT})...`);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  execSync(
    `docker run --rm -d --name ${CONTAINER_NAME} ` +
      `-e POSTGRES_USER=verify -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=verify ` +
      `-p 127.0.0.1:${PORT}:5432 postgres:16-alpine`,
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
  console.log("Aplicando migraciones 0000-0025 (drizzle-orm/postgres-js migrator)...");
  const migrationClient = postgres(DB_URL, { max: 1 });
  const migrationDb = drizzle(migrationClient);
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  await migrationClient.end();
}

async function main(): Promise<void> {
  startDisposablePostgres();
  try {
    await waitForPostgres();
    await applyMigrations();

    // Import DINÁMICO — ver nota de cabecera. process.env.DATABASE_URL ya
    // apunta al desechable en este punto.
    process.env.DATABASE_URL = DB_URL;
    const schema = (await import("@/lib/db/schema")) as typeof SchemaModule;
    const { db } = await import("@/lib/db");
    const repo = (await import("@/lib/db/repos/pixelforge")) as typeof PixelforgeRepoModule;
    const { eq, and, inArray } = await import("drizzle-orm");

    interface Fixture {
      ownerId: string;
      projectId: string;
      pageVersionId: string;
      actor: { id: string; name: string };
    }

    let fixtureCounter = 0;
    async function createFixture(): Promise<Fixture> {
      fixtureCounter += 1;
      const n = fixtureCounter;
      const [user] = await db
        .insert(schema.users)
        .values({
          email: `qa-verify-${n}@example.com`,
          passwordHash: "x",
          name: `QA Verify ${n}`,
          role: "staff",
        })
        .returning({ id: schema.users.id, name: schema.users.name });

      const [client] = await db
        .insert(schema.clients)
        .values({ ownerId: user.id, source: "portal", name: `Cliente QA Verify ${n}` })
        .returning({ id: schema.clients.id });

      const [project] = await db
        .insert(schema.pixelforgeProjects)
        .values({
          ownerId: user.id,
          clientId: client.id,
          clientCrmId: `crm-verify-${n}`,
          title: `Proyecto QA Verify ${n}`,
          brainDump: "brain dump de verificación",
        })
        .returning({ id: schema.pixelforgeProjects.id });

      const [pageVersion] = await db
        .insert(schema.pixelforgePageVersions)
        .values({
          projectId: project.id,
          version: 1,
          tree: {},
          notas: "",
          warnings: [],
          createdByName: user.name,
        })
        .returning({ id: schema.pixelforgePageVersions.id });

      return {
        ownerId: user.id,
        projectId: project.id,
        pageVersionId: pageVersion.id,
        actor: { id: user.id, name: user.name },
      };
    }

    console.log("\n── 1. Unique parcial: un solo QA activo por proyecto ──");
    const fixtureA = await createFixture();
    const runA1 = await repo.createQaRun(
      fixtureA.projectId,
      fixtureA.ownerId,
      { pageVersionId: fixtureA.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
      fixtureA.actor
    );
    check("1er createQaRun sobre un proyecto sin QA activo devuelve id", typeof runA1.id === "string");

    let secondCreateThrewTypedError = false;
    let secondCreateErrorName = "";
    try {
      await repo.createQaRun(
        fixtureA.projectId,
        fixtureA.ownerId,
        { pageVersionId: fixtureA.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
        fixtureA.actor
      );
    } catch (err) {
      secondCreateThrewTypedError = err instanceof repo.QaRunAlreadyActiveError;
      secondCreateErrorName = err instanceof Error ? err.name : String(err);
    }
    check(
      "2do createQaRun con QA activo lanza QaRunAlreadyActiveError",
      secondCreateThrewTypedError,
      `error: ${secondCreateErrorName}`
    );

    console.log("\n── 2. claimQaBrowserJob bajo concurrencia (2 jobs, 3 claims) ──");
    const fixtureB1 = await createFixture();
    const fixtureB2 = await createFixture();
    const runB1 = await repo.createQaRun(
      fixtureB1.projectId,
      fixtureB1.ownerId,
      { pageVersionId: fixtureB1.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
      fixtureB1.actor
    );
    const runB2 = await repo.createQaRun(
      fixtureB2.projectId,
      fixtureB2.ownerId,
      { pageVersionId: fixtureB2.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
      fixtureB2.actor
    );
    // Simula lo que hará el motor in-process (T2, aún no construido): mueve
    // el run de 'queued' a 'running' antes de que el navegador pueda
    // reclamarlo. browser_status se queda 'pending' (default de la fila).
    await db
      .update(schema.pixelforgeQaRuns)
      .set({ status: "running" })
      .where(inArray(schema.pixelforgeQaRuns.id, [runB1.id, runB2.id]));

    const claims = await Promise.all([
      repo.claimQaBrowserJob(),
      repo.claimQaBrowserJob(),
      repo.claimQaBrowserJob(),
    ]);
    const wonClaims = claims.filter((c): c is NonNullable<typeof c> => c !== null);
    const wonIds = new Set(wonClaims.map((c) => c.id));
    check(
      "exactamente 2 de 3 claims concurrentes ganan un job",
      wonClaims.length === 2,
      `ganaron ${wonClaims.length}`
    );
    check(
      "los 2 jobs ganados son runs DISTINTOS (sin doble-claim del mismo job)",
      wonIds.size === 2,
      `ids ganados: ${[...wonIds].join(", ")}`
    );
    check(
      "los ganadores son EXACTAMENTE los 2 runs sembrados (ninguno de otro proyecto)",
      wonIds.has(runB1.id) && wonIds.has(runB2.id)
    );

    console.log("\n── 3. finalizeQaRun idempotente bajo concurrencia ──");
    const [finalizeFirst, finalizeSecond] = await Promise.all([
      repo.finalizeQaRun(runB1.id, {
        verdict: "pass",
        scoreTotal: 92,
        categoryScores: { accesibilidad: 90 },
        summary: { ok: true },
      }),
      repo.finalizeQaRun(runB1.id, {
        verdict: "pass",
        scoreTotal: 92,
        categoryScores: { accesibilidad: 90 },
        summary: { ok: true },
      }),
    ]);
    const finalizeWins = [finalizeFirst, finalizeSecond].filter(Boolean).length;
    check(
      "exactamente 1 de 2 finalizeQaRun concurrentes gana (devuelve true)",
      finalizeWins === 1,
      `ganaron ${finalizeWins}`
    );

    const finishedEvents = await db
      .select()
      .from(schema.pixelforgeEvents)
      .where(
        and(
          eq(schema.pixelforgeEvents.projectId, fixtureB1.projectId),
          eq(schema.pixelforgeEvents.type, "qa_finished")
        )
      );
    check(
      "queda EXACTAMENTE 1 evento qa_finished (no 2, pese a las 2 llamadas)",
      finishedEvents.length === 1,
      `eventos encontrados: ${finishedEvents.length}`
    );

    console.log("\n── 4. insertQaFindings deduplica ──");
    const duplicateFinding: PixelforgeRepoModule.InsertQaFindingInput = {
      checkCode: "CHK-CONTRASTE-001",
      category: "accesibilidad",
      severity: "major",
      blocking: false,
      source: "det",
      title: "Contraste insuficiente",
      description: "El texto del hero no cumple contraste AA sobre el fondo.",
      recommendation: "Sube el contraste del texto o cambia el color de fondo.",
      locationKey: "seccion:hero",
    };
    await repo.insertQaFindings(runB1.id, [duplicateFinding]);
    await repo.insertQaFindings(runB1.id, [duplicateFinding]); // duplicado EXACTO

    const findingsForRun = await db
      .select()
      .from(schema.pixelforgeQaFindings)
      .where(eq(schema.pixelforgeQaFindings.qaRunId, runB1.id));
    check(
      "insertQaFindings con duplicado exacto deja 1 sola fila (dedupe)",
      findingsForRun.length === 1,
      `filas encontradas: ${findingsForRun.length}`
    );

    console.log("\n── 5. attachQaAdvisoryRuns bajo concurrencia (2 invocaciones, mismo qa_run) ──");
    const fixtureD = await createFixture();
    const runD = await repo.createQaRun(
      fixtureD.projectId,
      fixtureD.ownerId,
      { pageVersionId: fixtureD.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
      fixtureD.actor
    );
    // El UPDATE final de attachQaAdvisoryRuns exige status='running' — igual
    // que la sección 2, simula el paso a 'running' que hará el motor.
    await db
      .update(schema.pixelforgeQaRuns)
      .set({ status: "running" })
      .where(eq(schema.pixelforgeQaRuns.id, runD.id));

    function makeAdvisorySeed(tag: string): PixelforgeRepoModule.AdvisoryRunSeed {
      return {
        operation: "critique_design",
        model: "test-model",
        promptVersion: "v1",
        inputSummary: { tag },
      };
    }
    const attachInput = (tag: string): PixelforgeRepoModule.AttachQaAdvisoryRunsInput => ({
      projectId: fixtureD.projectId,
      actor: fixtureD.actor,
      critique: makeAdvisorySeed(`critique-${tag}`),
      originality: makeAdvisorySeed(`originality-${tag}`),
      likeness: makeAdvisorySeed(`likeness-${tag}`),
    });

    const [attachFirst, attachSecond] = await Promise.all([
      repo.attachQaAdvisoryRuns(runD.id, attachInput("first")),
      repo.attachQaAdvisoryRuns(runD.id, attachInput("second")),
    ]);
    const attachWins = [attachFirst, attachSecond].filter((r) => r !== null);

    const advisoryRunsForRunD = await db
      .select({ id: schema.pixelforgeAiRuns.id })
      .from(schema.pixelforgeAiRuns)
      .where(eq(schema.pixelforgeAiRuns.resultRef, `qa_run:${runD.id}`));

    const [qaRunDRow] = await db
      .select({
        critiqueRunId: schema.pixelforgeQaRuns.critiqueRunId,
        originalityRunId: schema.pixelforgeQaRuns.originalityRunId,
        likenessRunId: schema.pixelforgeQaRuns.likenessRunId,
      })
      .from(schema.pixelforgeQaRuns)
      .where(eq(schema.pixelforgeQaRuns.id, runD.id));

    const winner = attachWins[0];
    const fksMatchWinner =
      attachWins.length === 1 &&
      winner !== null &&
      qaRunDRow.critiqueRunId === winner.critiqueRunId &&
      qaRunDRow.originalityRunId === winner.originalityRunId &&
      qaRunDRow.likenessRunId === winner.likenessRunId;

    check(
      "attachQaAdvisoryRuns concurrentes: exactamente 1 gana, quedan exactamente 3 ai_runs " +
        "en total (no 6) y las 3 FKs del qa_run apuntan a los ids de la ganadora",
      attachWins.length === 1 && advisoryRunsForRunD.length === 3 && fksMatchWinner,
      `ganadores: ${attachWins.length}, ai_runs creados: ${advisoryRunsForRunD.length}, ` +
        `FKs coinciden con ganadora: ${fksMatchWinner}`
    );

    console.log(
      "\n── 6. openQaGate: carrera real con Postgres — v2 aterriza ANTES de la tx (review final PF-F8, finding 1) ──"
    );
    const fixtureE = await createFixture();
    // openQaGate exige current_station IN ('produccion','qa') — createFixture
    // deja el proyecto en su default ('contexto'), así que se fuerza acá,
    // igual que haría el flujo real al llegar a la estación de QA.
    await db
      .update(schema.pixelforgeProjects)
      .set({ currentStation: "qa" })
      .where(eq(schema.pixelforgeProjects.id, fixtureE.projectId));

    const runE = await repo.createQaRun(
      fixtureE.projectId,
      fixtureE.ownerId,
      { pageVersionId: fixtureE.pageVersionId, catalogVersion: "v1", scoringVersion: "v1" },
      fixtureE.actor
    );
    await repo.finalizeQaRun(runE.id, {
      verdict: "pass",
      scoreTotal: 95,
      categoryScores: { accesibilidad: 95 },
      summary: { ok: true },
    });

    // La carrera: una v2 aterriza (compose_page_tree, F7) JUSTO ANTES de que
    // se invoque openQaGate sobre el qa_run que evaluó v1.
    await db.insert(schema.pixelforgePageVersions).values({
      projectId: fixtureE.projectId,
      version: 2,
      tree: {},
      notas: "",
      warnings: [],
      createdByName: fixtureE.actor.name,
    });

    const staleGateResult = await repo.openQaGate(fixtureE.projectId, runE.id, fixtureE.actor);

    const [projectAfterStaleGate] = await db
      .select({ currentStation: schema.pixelforgeProjects.currentStation })
      .from(schema.pixelforgeProjects)
      .where(eq(schema.pixelforgeProjects.id, fixtureE.projectId));

    const gateOpenedEventsAfterStale = await db
      .select()
      .from(schema.pixelforgeEvents)
      .where(
        and(
          eq(schema.pixelforgeEvents.projectId, fixtureE.projectId),
          eq(schema.pixelforgeEvents.type, "qa_gate_opened")
        )
      );

    check(
      "openQaGate sobre un qa_run pass cuya versión (v1) dejó de ser vigente (v2 aterrizó ANTES de la llamada) " +
        "NO avanza current_station, NO inserta qa_gate_opened, y devuelve {opened:false, reason:'stale-version'}",
      staleGateResult.opened === false &&
        staleGateResult.reason === "stale-version" &&
        projectAfterStaleGate.currentStation === "qa" &&
        gateOpenedEventsAfterStale.length === 0,
      `opened=${staleGateResult.opened}, reason=${staleGateResult.reason}, ` +
        `currentStation=${projectAfterStaleGate.currentStation}, eventos qa_gate_opened=${gateOpenedEventsAfterStale.length}`
    );

    await db.$client.end();
  } finally {
    console.log(`\nDestruyendo contenedor ${CONTAINER_NAME}...`);
    execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  }

  console.log("\n── Resumen ──");
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks OK.`);
  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} check(s) fallaron:`);
    failed.forEach((f) => console.error(`   - ${f.label}${f.detail ? ` (${f.detail})` : ""}`));
    process.exit(1);
  }
  console.log("\n✅ Todos los checks de repo QA pasaron.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error inesperado en el verify de repo QA:", err);
  execSync(`docker rm -f ${CONTAINER_NAME} >/dev/null 2>&1 || true`);
  process.exit(1);
});
